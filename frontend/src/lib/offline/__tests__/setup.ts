import "fake-indexeddb/auto";
import { mock } from "bun:test";

mock.module("$lib/auth-client", () => ({
	getSession: mock(async () => {
		throw new TypeError("offline test session");
	}),
}));
