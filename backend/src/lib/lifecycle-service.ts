import {
	attachments,
	auditLog,
	db,
	documentEmbeddings,
	documents,
	lifecycleOperations,
	shareLinks,
	versions,
} from "@hiai-docs/db";
import type {
	AssertPurgeAllowed,
	ExportUserDataContext,
	LifecycleHostStep,
	PurgeUserDataContext,
	PurgeUserDataResult,
	UserDataExportRecord,
} from "@hiai-docs/sdk";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";

const LEASE_MS = 60_000;
const SAFE_ERROR_CODES = new Set([
	"aborted",
	"fence_rejected",
	"lease_lost",
	"object_storage_failed",
	"queue_failed",
	"redis_failed",
	"graph_failed",
	"host_step_failed",
	"persistence_failed",
]);

type PersistentOperation = typeof lifecycleOperations.$inferSelect;

export type LifecycleRuntimeAdapters = Readonly<{
	/** Checks the host-owned fence immediately before the first mutation. */
	verifyPurgeFence: (
		ctx: PurgeUserDataContext,
		fenceToken: string,
	) => Promise<void>;
	deleteObjects: (
		keys: readonly string[],
		signal?: AbortSignal,
	) => Promise<number>;
	cancelAccountJobs: (
		actorUserId: string,
		signal?: AbortSignal,
	) => Promise<number>;
	clearAccountRedisState: (
		actorUserId: string,
		signal?: AbortSignal,
	) => Promise<number>;
	removeCollaborationState: (
		actorUserId: string,
		signal?: AbortSignal,
	) => Promise<number>;
	removeGraphState: (
		documentIds: readonly string[],
		signal?: AbortSignal,
	) => Promise<number>;
}>;

export type PersistentLifecycleService = Readonly<{
	exportUserData(
		ctx: ExportUserDataContext,
	): AsyncIterable<UserDataExportRecord>;
	purgeUserData(
		ctx: PurgeUserDataContext,
		gate: Readonly<{ fenceToken: string }>,
	): Promise<PurgeUserDataResult>;
}>;

function throwIfAborted(signal: AbortSignal | undefined): void {
	if (signal?.aborted)
		throw signal.reason ?? new DOMException("Aborted", "AbortError");
}

function safeErrorCode(error: unknown): string {
	if (error instanceof DOMException && error.name === "AbortError")
		return "aborted";
	if (error instanceof Error && SAFE_ERROR_CODES.has(error.message))
		return error.message;
	return "persistence_failed";
}

function tokenHash(token: string): string {
	return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

function checksumLine(
	hash: Bun.CryptoHasher,
	record: UserDataExportRecord,
): void {
	hash.update(`${JSON.stringify(record)}\n`, "utf8");
}

function counts(value: unknown): Record<string, number> {
	return typeof value === "object" && value !== null
		? (value as Record<string, number>)
		: {};
}

function operationCounts(
	operation: PersistentOperation,
): Record<string, number> {
	const result = operation.terminalResult as {
		deletedByDomain?: unknown;
	} | null;
	return counts(result?.deletedByDomain);
}

/**
 * Durable OSS-owned lifecycle saga. It does not know workspace membership or
 * billing policy: the caller supplies a host fence and optional host steps.
 */
export function createPersistentLifecycleService(
	runtime: LifecycleRuntimeAdapters,
	hostSteps: readonly LifecycleHostStep[] = [],
): PersistentLifecycleService {
	const orderedSteps = [...hostSteps].sort(
		(a, b) => a.order - b.order || a.id.localeCompare(b.id),
	);
	if (
		new Set(orderedSteps.map((step) => step.id)).size !== orderedSteps.length
	) {
		throw new Error("Lifecycle host step IDs must be globally unique");
	}

	async function getOrCreateOperation(
		ctx: PurgeUserDataContext,
	): Promise<PersistentOperation> {
		await db
			.insert(lifecycleOperations)
			.values({
				actorUserId: ctx.actorUserId,
				idempotencyKey: ctx.idempotencyKey,
				operationKind: "purge",
				status: "pending",
			})
			.onConflictDoNothing();
		const operation = await db.query.lifecycleOperations.findFirst({
			where: and(
				eq(lifecycleOperations.actorUserId, ctx.actorUserId),
				eq(lifecycleOperations.idempotencyKey, ctx.idempotencyKey),
			),
		});
		if (!operation) throw new Error("persistence_failed");
		if (operation.operationKind !== "purge")
			throw new Error("persistence_failed");
		return operation;
	}

	async function acquireLease(
		operation: PersistentOperation,
		owner: string,
	): Promise<boolean> {
		const now = new Date();
		const expiry = new Date(now.getTime() + LEASE_MS);
		const updated = await db
			.update(lifecycleOperations)
			.set({
				status: "running",
				leaseOwner: owner,
				leaseExpiresAt: expiry,
				attemptCount: sql`${lifecycleOperations.attemptCount} + 1`,
				updatedAt: now,
			})
			.where(
				and(
					eq(lifecycleOperations.id, operation.id),
					or(
						eq(lifecycleOperations.status, "pending"),
						eq(lifecycleOperations.status, "retryable"),
						and(
							eq(lifecycleOperations.status, "running"),
							lt(lifecycleOperations.leaseExpiresAt, now),
						),
					),
				),
			)
			.returning({ id: lifecycleOperations.id });
		return updated.length === 1;
	}

	async function persistStep(
		operationId: string,
		leaseOwner: string,
		step: string,
		deletedByDomain: Record<string, number>,
	): Promise<void> {
		const current = await db.query.lifecycleOperations.findFirst({
			where: and(
				eq(lifecycleOperations.id, operationId),
				eq(lifecycleOperations.leaseOwner, leaseOwner),
			),
		});
		if (!current) throw new Error("lease_lost");
		if (
			current.status !== "running" ||
			(current.leaseExpiresAt && current.leaseExpiresAt < new Date())
		) {
			throw new Error("lease_lost");
		}
		const completed = Array.isArray(current.completedSteps)
			? current.completedSteps.filter(
					(value): value is string => typeof value === "string",
				)
			: [];
		if (!completed.includes(step)) completed.push(step);
		await db
			.update(lifecycleOperations)
			.set({
				completedSteps: completed,
				terminalResult: { deletedByDomain },
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(lifecycleOperations.id, operationId),
					eq(lifecycleOperations.leaseOwner, leaseOwner),
				),
			);
	}

	async function runStep(
		operation: PersistentOperation,
		leaseOwner: string,
		step: string,
		deletedByDomain: Record<string, number>,
		action: () => Promise<number>,
	): Promise<void> {
		const completed = Array.isArray(operation.completedSteps)
			? operation.completedSteps
			: [];
		if (completed.includes(step)) return;
		const count = await action();
		deletedByDomain[step] = count;
		await persistStep(operation.id, leaseOwner, step, deletedByDomain);
		operation.completedSteps = [...completed, step];
	}

	return {
		async *exportUserData(ctx) {
			throwIfAborted(ctx.signal);
			const exportId = crypto.randomUUID();
			const hash = new Bun.CryptoHasher("sha256");
			let recordCount = 0;
			const manifest: UserDataExportRecord = {
				type: "manifest",
				schemaVersion: 1,
				exportId,
				actorUserId: ctx.actorUserId,
				generatedAt: new Date().toISOString(),
			};
			checksumLine(hash, manifest);
			recordCount += 1;
			yield manifest;
			const ownedDocuments = await db
				.select()
				.from(documents)
				.where(eq(documents.ownerId, ctx.actorUserId));
			for (const document of ownedDocuments) {
				throwIfAborted(ctx.signal);
				const record: UserDataExportRecord = {
					type: "data",
					domain: "documents",
					resourceType: "document",
					resourceId: document.id,
					workspaceId: document.workspaceId,
					payload: {
						title: document.title,
						content: document.content,
						contentJson: document.contentJson,
						metadata: document.metadata,
						visibility: document.visibility,
						createdAt: document.createdAt,
						updatedAt: document.updatedAt,
					},
				};
				checksumLine(hash, record);
				recordCount += 1;
				yield record;
			}
			const ownedAttachments = await db
				.select({
					id: attachments.id,
					workspaceId: attachments.workspaceId,
					filename: attachments.filename,
					mimeType: attachments.mimeType,
					size: attachments.size,
				})
				.from(attachments)
				.innerJoin(documents, eq(attachments.documentId, documents.id))
				.where(eq(documents.ownerId, ctx.actorUserId));
			for (const attachment of ownedAttachments) {
				throwIfAborted(ctx.signal);
				const record: UserDataExportRecord = {
					type: "attachment",
					attachmentId: attachment.id,
					workspaceId: attachment.workspaceId,
					filename: attachment.filename,
					contentType: attachment.mimeType,
					size: attachment.size,
					sha256: null,
				};
				checksumLine(hash, record);
				recordCount += 1;
				yield record;
			}
			for (const step of orderedSteps) {
				if (!step.export) continue;
				for await (const record of step.export(ctx)) {
					throwIfAborted(ctx.signal);
					if (record.type === "manifest" || record.type === "complete")
						throw new Error("Host export step emitted a reserved record type");
					checksumLine(hash, record);
					recordCount += 1;
					yield record;
				}
			}
			yield { type: "complete", recordCount, checksum: hash.digest("hex") };
		},

		async purgeUserData(ctx, gate) {
			throwIfAborted(ctx.signal);
			let operation = await getOrCreateOperation(ctx);
			if (operation.status === "completed") {
				return {
					status: "already_completed",
					operationId: operation.id,
					deletedByDomain: operationCounts(operation),
				};
			}
			const leaseOwner = crypto.randomUUID();
			if (!(await acquireLease(operation, leaseOwner)))
				throw new Error("lease_lost");
			operation =
				(await db.query.lifecycleOperations.findFirst({
					where: eq(lifecycleOperations.id, operation.id),
				})) ?? operation;
			const deletedByDomain = operationCounts(operation);
			try {
				throwIfAborted(ctx.signal);
				await db
					.update(lifecycleOperations)
					.set({
						fenceTokenHash: tokenHash(gate.fenceToken),
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(lifecycleOperations.id, operation.id),
							eq(lifecycleOperations.leaseOwner, leaseOwner),
						),
					);
				await runtime.verifyPurgeFence(ctx, gate.fenceToken);

				await runStep(
					operation,
					leaseOwner,
					"cancel_account_jobs",
					deletedByDomain,
					() => runtime.cancelAccountJobs(ctx.actorUserId, ctx.signal),
				);
				await runStep(
					operation,
					leaseOwner,
					"remove_collaboration_state",
					deletedByDomain,
					() => runtime.removeCollaborationState(ctx.actorUserId, ctx.signal),
				);
				await runStep(
					operation,
					leaseOwner,
					"remove_subject_created_shares",
					deletedByDomain,
					async () =>
						(
							await db
								.delete(shareLinks)
								.where(eq(shareLinks.createdBy, ctx.actorUserId))
								.returning({ id: shareLinks.id })
						).length,
				);
				const owned = await db
					.select({ id: documents.id })
					.from(documents)
					.where(eq(documents.ownerId, ctx.actorUserId));
				const documentIds = owned.map((row) => row.id);
				await runStep(
					operation,
					leaseOwner,
					"remove_document_versions",
					deletedByDomain,
					async () =>
						documentIds.length
							? (
									await db
										.delete(versions)
										.where(inArray(versions.documentId, documentIds))
										.returning({ id: versions.id })
								).length
							: 0,
				);
				await runStep(
					operation,
					leaseOwner,
					"remove_chunks_and_embeddings",
					deletedByDomain,
					async () =>
						documentIds.length
							? (
									await db
										.delete(documentEmbeddings)
										.where(inArray(documentEmbeddings.documentId, documentIds))
										.returning({ id: documentEmbeddings.id })
								).length
							: 0,
				);
				await runStep(
					operation,
					leaseOwner,
					"remove_graph_state",
					deletedByDomain,
					() => runtime.removeGraphState(documentIds, ctx.signal),
				);
				const objectRows = documentIds.length
					? await db
							.select({
								id: attachments.id,
								storageKey: attachments.storageKey,
							})
							.from(attachments)
							.where(inArray(attachments.documentId, documentIds))
					: [];
				await runStep(
					operation,
					leaseOwner,
					"delete_attachment_objects",
					deletedByDomain,
					() =>
						runtime.deleteObjects(
							objectRows.map((row) => row.storageKey),
							ctx.signal,
						),
				);
				await runStep(
					operation,
					leaseOwner,
					"remove_attachment_rows",
					deletedByDomain,
					async () =>
						objectRows.length
							? (
									await db
										.delete(attachments)
										.where(
											inArray(
												attachments.id,
												objectRows.map((row) => row.id),
											),
										)
										.returning({ id: attachments.id })
								).length
							: 0,
				);
				await runStep(
					operation,
					leaseOwner,
					"remove_subject_documents",
					deletedByDomain,
					async () =>
						(
							await db
								.delete(documents)
								.where(eq(documents.ownerId, ctx.actorUserId))
								.returning({ id: documents.id })
						).length,
				);
				await runStep(
					operation,
					leaseOwner,
					"clear_redis_state",
					deletedByDomain,
					() => runtime.clearAccountRedisState(ctx.actorUserId, ctx.signal),
				);
				for (const step of orderedSteps) {
					if (!step.purge) continue;
					await runStep(
						operation,
						leaseOwner,
						`host:${step.id}`,
						deletedByDomain,
						async () => (await step.purge?.(ctx))?.deletedCount ?? 0,
					);
				}
				await runStep(
					operation,
					leaseOwner,
					"write_deletion_audit",
					deletedByDomain,
					async () => {
						await db.insert(auditLog).values({
							actorId: ctx.actorUserId,
							action: "account_data_purged",
							resourceType: "lifecycle_operation",
							details: {
								operationId: operation.id,
								outcome: "completed",
								deletedByDomain,
							},
						});
						return 1;
					},
				);
				await db
					.update(lifecycleOperations)
					.set({
						status: "completed",
						terminalResult: { deletedByDomain },
						completedAt: new Date(),
						leaseOwner: null,
						leaseExpiresAt: null,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(lifecycleOperations.id, operation.id),
							eq(lifecycleOperations.leaseOwner, leaseOwner),
						),
					);
				return {
					status: "completed",
					operationId: operation.id,
					deletedByDomain,
				};
			} catch (error) {
				const code = safeErrorCode(error);
				await db
					.update(lifecycleOperations)
					.set({
						status: code === "fence_rejected" ? "rejected" : "retryable",
						safeErrorCode: code,
						leaseOwner: null,
						leaseExpiresAt: null,
						completedAt: code === "fence_rejected" ? new Date() : null,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(lifecycleOperations.id, operation.id),
							eq(lifecycleOperations.leaseOwner, leaseOwner),
						),
					);
				throw error;
			}
		},
	};
}

/** Builds the public facade without allowing the OSS service to own membership policy. */
export function bindPersistentLifecycle(
	service: PersistentLifecycleService,
	assertPurgeAllowed: AssertPurgeAllowed,
) {
	return {
		exportUserData: service.exportUserData,
		async purgeUserData(ctx: PurgeUserDataContext) {
			const gate = await assertPurgeAllowed(ctx);
			return service.purgeUserData(ctx, gate);
		},
	};
}
