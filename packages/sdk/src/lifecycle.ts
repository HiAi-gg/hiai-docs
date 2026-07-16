/**
 * Server-only account-data lifecycle contract.
 *
 * `actorUserId` is deliberately both the actor and the subject in 0.3.2. A
 * trusted actor deleting another account requires a future, explicit
 * `subjectUserId` contract; callers must not silently overload this field.
 */

export type LifecycleOperationKind = "export" | "purge";

export type LifecycleOperationStatus =
	| "pending"
	| "running"
	| "retryable"
	| "completed"
	| "rejected";

export type LifecycleReason = "account_deletion" | "privacy_request";

export type ExportUserDataContext = Readonly<{
	actorUserId: string;
	requestId: string;
	idempotencyKey: string;
	reason: LifecycleReason;
	signal?: AbortSignal;
}>;

export type PurgeUserDataContext = Readonly<{
	actorUserId: string;
	requestId: string;
	idempotencyKey: string;
	reason: LifecycleReason;
	signal?: AbortSignal;
}>;

export type UserDataExportRecord =
	| Readonly<{
			type: "manifest";
			schemaVersion: 1;
			exportId: string;
			actorUserId: string;
			generatedAt: string;
		}>
	| Readonly<{
			type: "data";
			domain: string;
			resourceType: string;
			resourceId: string | null;
			workspaceId: string | null;
			payload: unknown;
		}>
	| Readonly<{
			type: "attachment";
			attachmentId: string;
			workspaceId: string | null;
			filename: string;
			contentType: string;
			size: number;
			sha256: string | null;
		}>
	| Readonly<{
			type: "complete";
			recordCount: number;
			checksum: string;
		}>;

export type PurgeUserDataResult = Readonly<{
	status: "completed" | "already_completed";
	operationId: string;
	deletedByDomain: Readonly<Record<string, number>>;
}>;

export type AssertPurgeAllowed = (
	ctx: PurgeUserDataContext,
) => Promise<Readonly<{ fenceToken: string }>>;

export type LifecycleHostStep = Readonly<{
	id: string;
	order: number;
	export?: (ctx: ExportUserDataContext) => AsyncIterable<UserDataExportRecord>;
	purge?: (
		ctx: PurgeUserDataContext,
	) => Promise<Readonly<{ deletedCount: number }>>;
}>;

export interface UserDataLifecycleAdapter {
	exportUserData(ctx: ExportUserDataContext): AsyncIterable<UserDataExportRecord>;
	purgeUserData(
		ctx: PurgeUserDataContext,
		gate: Readonly<{ fenceToken: string }>,
	): Promise<PurgeUserDataResult>;
}

export interface UserDataLifecycle {
	exportUserData(ctx: ExportUserDataContext): AsyncIterable<UserDataExportRecord>;
	purgeUserData(ctx: PurgeUserDataContext): Promise<PurgeUserDataResult>;
}

let configuredLifecycle: UserDataLifecycle | undefined;

/** Install a server-only implementation during the host application's bootstrap. */
export function configureUserDataLifecycle(lifecycle: UserDataLifecycle): void {
	configuredLifecycle = lifecycle;
}

function requireLifecycle(): UserDataLifecycle {
	if (!configuredLifecycle) {
		throw new Error("DocsMint user-data lifecycle has not been configured");
	}
	return configuredLifecycle;
}

export function exportUserData(
	ctx: ExportUserDataContext,
): AsyncIterable<UserDataExportRecord> {
	return requireLifecycle().exportUserData(Object.freeze({ ...ctx }));
}

export function purgeUserData(
	ctx: PurgeUserDataContext,
): Promise<PurgeUserDataResult> {
	return requireLifecycle().purgeUserData(Object.freeze({ ...ctx }));
}

/** Construct a lifecycle facade around a durable host-owned implementation. */
export function createUserDataLifecycle(
	adapter: UserDataLifecycleAdapter,
	assertPurgeAllowed: AssertPurgeAllowed,
): UserDataLifecycle {
	return {
		exportUserData: (ctx) => adapter.exportUserData(Object.freeze({ ...ctx })),
		async purgeUserData(ctx) {
			const immutableContext = Object.freeze({ ...ctx });
			throwIfAborted(immutableContext.signal);
			const gate = await assertPurgeAllowed(immutableContext);
			if (!gate.fenceToken) throw new Error("Purge gate returned an empty fence token");
			throwIfAborted(immutableContext.signal);
			return adapter.purgeUserData(immutableContext, gate);
		},
	};
}

/** Validate and deterministically order registered host steps. */
export function orderLifecycleHostSteps(
	steps: readonly LifecycleHostStep[],
): readonly LifecycleHostStep[] {
	const ids = new Set<string>();
	for (const step of steps) {
		if (!step.id || ids.has(step.id)) {
			throw new Error(`Duplicate or empty lifecycle host step ID: ${step.id}`);
		}
		ids.add(step.id);
	}
	return Object.freeze([...steps].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
	if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
}

/**
 * Encode the typed stream as canonical NDJSON. The producer is authoritative
 * for the terminal checksum, while the encoder verifies record sequencing so
 * a partial or malformed stream is never presented as a valid export.
 */
export function encodeUserDataExportNdjson(
	records: AsyncIterable<UserDataExportRecord>,
): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	const iterator = records[Symbol.asyncIterator]();
	let seenManifest = false;
	let seenComplete = false;
	let exhausted = false;

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const next = await iterator.next();
				if (next.done) {
					exhausted = true;
					if (!seenComplete) throw new Error("Lifecycle export ended without complete record");
					controller.close();
					return;
				}
				const record = next.value;
				if (!seenManifest) {
					if (record.type !== "manifest") throw new Error("Lifecycle export must begin with manifest");
					seenManifest = true;
				} else if (seenComplete) {
					throw new Error("Lifecycle export emitted a record after complete");
				}
				if (record.type === "complete") seenComplete = true;
				controller.enqueue(encoder.encode(`${JSON.stringify(record)}\n`));
			} catch (error) {
				controller.error(error);
			}
		},
		async cancel(reason) {
			if (!exhausted) await iterator.return?.(reason);
		},
	});
}
