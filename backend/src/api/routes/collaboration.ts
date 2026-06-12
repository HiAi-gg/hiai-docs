import { Elysia } from "elysia";
import * as Y from "yjs";
import { auth } from "../../lib/auth";
import { config } from "../../lib/config";
import { logger } from "../../lib/logger";
import {
	addClient,
	broadcastUpdate,
	getYjsDoc,
	removeClient,
} from "../../lib/yjs-provider";

interface CollabSession {
	docId: string;
	clientId: number;
}

interface CollabMessage {
	type: "update" | "ping" | "sync";
	update?: string;
}

interface CollabWebSocket {
	data: { documentId?: string; query?: Record<string, string> };
	send: (data: string) => void;
	close: (code: number, reason: string) => void;
}

const sessions = new WeakMap<CollabWebSocket, CollabSession>();

async function verifyWsAuth(token: string | null): Promise<string | null> {
	if (!token) return null;
	const apiKey = config.HIAI_DOCS_API_KEY;
	if (apiKey && token === apiKey) return config.OWNER_ID;
	try {
		const session = await auth.api.getSession({
			headers: new Headers({ cookie: `better-auth.session_token=${token}` }),
		});
		return session?.user?.id ?? null;
	} catch {
		return null;
	}
}

export const collaborationRoutes = new Elysia();

collaborationRoutes.ws("/ws/collab/:documentId", {
	open: async (rawWs) => {
		const ws = rawWs as unknown as CollabWebSocket;
		const documentId = ws.data.documentId;
		if (!documentId) {
			ws.close(1008, "Missing documentId");
			return;
		}

		const token = ws.data.query?.token ?? null;
		const userId = await verifyWsAuth(token);
		if (!userId) {
			ws.close(1008, "Authentication required");
			return;
		}

		const doc = await getYjsDoc(documentId);
		const clientId = doc.clientID;
		addClient(documentId);
		sessions.set(ws, { docId: documentId, clientId });

		const state = Y.encodeStateAsUpdate(doc);
		ws.send(
			JSON.stringify({
				type: "sync",
				state: Buffer.from(state).toString("base64"),
				clientId,
			}),
		);
		logger.debug({ documentId, clientId }, "WebSocket client connected");
	},

	message: async (rawWs, message) => {
		const ws = rawWs as unknown as CollabWebSocket;
		try {
			const raw =
				typeof message === "string"
					? message
					: Buffer.isBuffer(message)
						? message.toString("utf-8")
						: String(message);
			const data = JSON.parse(raw) as CollabMessage;
			const session = sessions.get(ws);
			if (!session) return;

			const doc = await getYjsDoc(session.docId);

			if (data.type === "update" && data.update) {
				const update = Buffer.from(data.update, "base64");
				Y.applyUpdate(doc, update);
				broadcastUpdate(session.docId, update, session.clientId);
			} else if (data.type === "ping") {
				ws.send(JSON.stringify({ type: "pong" }));
			}
		} catch (err) {
			logger.error({ err }, "WebSocket message error");
		}
	},

	close: (rawWs) => {
		const ws = rawWs as unknown as CollabWebSocket;
		const session = sessions.get(ws);
		if (!session) return;
		removeClient(session.docId);
		sessions.delete(ws);
		logger.debug(
			{ documentId: session.docId, clientId: session.clientId },
			"WebSocket client disconnected",
		);
	},

	drain: () => {
		logger.debug("WebSocket backpressure relieved");
	},
});
