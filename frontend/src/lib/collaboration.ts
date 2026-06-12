import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

export interface CollaborationSession {
	provider: WebsocketProvider;
	doc: Y.Doc;
	destroy: () => void;
}

let activeSession: CollaborationSession | null = null;

export function startCollaboration(
	documentId: string,
	accessToken: string,
	onUpdate?: (update: Uint8Array) => void,
): CollaborationSession {
	stopCollaboration();

	const doc = new Y.Doc();
	const wsUrl = `ws://${window.location.hostname}:${window.location.port}/api/ws/collab/${documentId}?token=${encodeURIComponent(accessToken)}`;

	const provider = new WebsocketProvider(wsUrl, documentId, doc, {
		connect: true,
		params: { token: accessToken },
	});

	provider.on("sync", (_synced: boolean) => {});

	provider.on("status", (_status: { status: string }) => {});

	provider.on("connection-close", () => {});

	const updateHandler = onUpdate;
	if (updateHandler) {
		doc.on("update", updateHandler);
	}

	activeSession = {
		provider,
		doc,
		destroy: () => {
			if (updateHandler) {
				doc.off("update", updateHandler);
			}
			provider.disconnect();
			provider.destroy();
			doc.destroy();
		},
	};

	return activeSession;
}

export function stopCollaboration() {
	if (activeSession) {
		activeSession.destroy();
		activeSession = null;
	}
}

export function getActiveSession(): CollaborationSession | null {
	return activeSession;
}
