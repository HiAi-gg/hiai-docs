export type AccountRuntimeCleanup = Readonly<{
	removeCollaborationState(
		actorUserId: string,
		signal?: AbortSignal,
	): Promise<number>;
	clearAccountRedisState(
		actorUserId: string,
		signal?: AbortSignal,
	): Promise<number>;
	close(): Promise<void>;
}>;

export declare function createAccountRuntimeCleanup(options: {
	redisUrl: string;
	databaseUrl: string;
}): AccountRuntimeCleanup;
