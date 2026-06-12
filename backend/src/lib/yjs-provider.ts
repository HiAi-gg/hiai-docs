import { Redis } from "ioredis";
import * as Y from "yjs";
import { logger } from "./logger";
import { redis } from "./redis";

const docs = new Map<string, Y.Doc>();
const saveIntervals = new Map<string, ReturnType<typeof setInterval>>();
const clientCounts = new Map<string, number>();

const SAVE_INTERVAL_MS = 30_000;
const DOC_PREFIX = "yjs:doc:";
const CHANNEL_PREFIX = "yjs:channel:";

let pubSubRedis: Redis | null = null;
let subRedis: Redis | null = null;

function getPubSub(): Redis {
	if (!pubSubRedis) {
		pubSubRedis = new Redis(
			redis.options?.lazyConnect === false
				? (redis.options?.host ?? "redis://localhost:6380")
				: "redis://localhost:6380",
			{
				maxRetriesPerRequest: 3,
			},
		);
	}
	return pubSubRedis;
}

function getSub(): Redis {
	if (!subRedis) {
		subRedis = new Redis(
			redis.options?.lazyConnect === false
				? (redis.options?.host ?? "redis://localhost:6380")
				: "redis://localhost:6380",
			{
				maxRetriesPerRequest: 3,
			},
		);
	}
	return subRedis;
}

export async function getYjsDoc(documentId: string): Promise<Y.Doc> {
	const existing = docs.get(documentId);
	if (existing) return existing;

	const doc = new Y.Doc();

	try {
		const state = await redis.get(`${DOC_PREFIX}${documentId}`);
		if (state) {
			const update = Buffer.from(state, "base64");
			Y.applyUpdate(doc, update);
		}
	} catch (err) {
		logger.error({ err, documentId }, "Failed to load Yjs doc from Redis");
	}

	docs.set(documentId, doc);
	clientCounts.set(documentId, 0);
	startSaveInterval(documentId);
	subscribeToChannel(documentId);

	return doc;
}

export async function saveYjsDoc(documentId: string): Promise<void> {
	const doc = docs.get(documentId);
	if (!doc) return;

	try {
		const state = Y.encodeStateAsUpdate(doc);
		const base64 = Buffer.from(state).toString("base64");
		await redis.set(`${DOC_PREFIX}${documentId}`, base64);
	} catch (err) {
		logger.error({ err, documentId }, "Failed to save Yjs doc to Redis");
	}
}

export function broadcastUpdate(
	documentId: string,
	update: Uint8Array,
	excludeClientId?: number,
): void {
	const base64 = Buffer.from(update).toString("base64");

	try {
		getPubSub().publish(
			`${CHANNEL_PREFIX}${documentId}`,
			JSON.stringify({
				update: base64,
				excludeClientId,
			}),
		);
	} catch (err) {
		logger.error({ err, documentId }, "Failed to broadcast Yjs update");
	}
}

export function addClient(documentId: string): number {
	const count = (clientCounts.get(documentId) ?? 0) + 1;
	clientCounts.set(documentId, count);
	return count;
}

export function removeClient(documentId: string): number {
	const count = Math.max(0, (clientCounts.get(documentId) ?? 1) - 1);
	clientCounts.set(documentId, count);

	if (count === 0) {
		cleanupDoc(documentId);
	}

	return count;
}

function startSaveInterval(documentId: string): void {
	if (saveIntervals.has(documentId)) return;

	const interval = setInterval(() => {
		saveYjsDoc(documentId);
	}, SAVE_INTERVAL_MS);

	saveIntervals.set(documentId, interval);
}

function subscribeToChannel(documentId: string): void {
	const sub = getSub();
	const channel = `${CHANNEL_PREFIX}${documentId}`;

	sub.subscribe(channel).catch((err) => {
		logger.error({ err, documentId }, "Failed to subscribe to Yjs channel");
	});

	sub.on("message", (ch: string, message: string) => {
		if (ch !== channel) return;

		try {
			const { update, excludeClientId } = JSON.parse(message);
			const doc = docs.get(documentId);
			if (!doc) return;

			const updateBuffer = Buffer.from(update, "base64");
			const uint8Update = new Uint8Array(updateBuffer);

			Y.applyUpdate(doc, uint8Update, { clientFilter: excludeClientId });
		} catch (err) {
			logger.error({ err, documentId }, "Failed to apply Yjs broadcast update");
		}
	});
}

function cleanupDoc(documentId: string): void {
	const interval = saveIntervals.get(documentId);
	if (interval) {
		clearInterval(interval);
		saveIntervals.delete(documentId);
	}

	saveYjsDoc(documentId);

	const doc = docs.get(documentId);
	if (doc) {
		doc.destroy();
		docs.delete(documentId);
	}

	clientCounts.delete(documentId);

	try {
		const sub = getSub();
		sub.unsubscribe(`${CHANNEL_PREFIX}${documentId}`);
	} catch (err) {
		logger.error({ err, documentId }, "Failed to unsubscribe from Yjs channel");
	}
}

export function getConnectedUsers(documentId: string): number {
	return clientCounts.get(documentId) ?? 0;
}
