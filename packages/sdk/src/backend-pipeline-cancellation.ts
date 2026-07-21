export type AccountPipelineCancellation = Readonly<{
  cancelActorPipeline(actorUserId: string, signal?: AbortSignal): Promise<{ runs: number; jobs: number }>;
  close(): Promise<void>;
}>;
export declare function createAccountPipelineCancellation(options: { redisUrl: string; databaseUrl: string }): AccountPipelineCancellation;
