import { describe, expect, it } from "bun:test";
import postgres from "postgres";

const databaseUrl = process.env.LIFECYCLE_TEST_DATABASE_URL;
const integrationIt = databaseUrl ? it : it.skip;

describe("lifecycle operation persistence integration", () => {
	integrationIt(
		"enforces idempotency, lease ownership, terminal immutability, and owner RLS as hiai_app",
		async () => {
			const sql = postgres(databaseUrl as string, { max: 1 });
			const actorA = crypto.randomUUID();
			const actorB = crypto.randomUUID();
			const operationA = crypto.randomUUID();
			const operationB = crypto.randomUUID();

			try {
				await sql
					.begin(async (tx) => {
						await tx`INSERT INTO public.users (id, email) VALUES
							(${actorA}::uuid, ${`${actorA}@lifecycle.invalid`}),
							(${actorB}::uuid, ${`${actorB}@lifecycle.invalid`})`;
						await tx`INSERT INTO public.lifecycle_operations
							(id, actor_user_id, idempotency_key, operation_kind)
							VALUES
							(${operationA}::uuid, ${actorA}::uuid, 'same-key', 'purge'),
							(${operationB}::uuid, ${actorB}::uuid, 'same-key', 'purge')`;

						let uniqueRejected = false;
						await tx
							.savepoint(async (savepoint) => {
								await savepoint`INSERT INTO public.lifecycle_operations
									(actor_user_id, idempotency_key, operation_kind)
									VALUES (${actorA}::uuid, 'same-key', 'purge')`;
							})
							.catch(() => {
								uniqueRejected = true;
							});
						expect(uniqueRejected).toBe(true);

						const firstLease = await tx`UPDATE public.lifecycle_operations
							SET status = 'running', lease_owner = 'worker-a',
								lease_expires_at = now() + interval '30 seconds'
							WHERE id = ${operationA}::uuid
								AND status = 'pending'
							RETURNING lease_owner`;
						expect(firstLease).toHaveLength(1);
						const competingLease = await tx`UPDATE public.lifecycle_operations
							SET lease_owner = 'worker-b'
							WHERE id = ${operationA}::uuid
								AND (status IN ('pending', 'retryable') OR lease_expires_at < now())
							RETURNING lease_owner`;
						expect(competingLease).toHaveLength(0);

						await tx`UPDATE public.lifecycle_operations
							SET lease_expires_at = now() - interval '1 second'
							WHERE id = ${operationA}::uuid`;
						const reclaimed = await tx`UPDATE public.lifecycle_operations
							SET lease_owner = 'worker-b', lease_expires_at = now() + interval '30 seconds'
							WHERE id = ${operationA}::uuid AND lease_expires_at < now()
							RETURNING lease_owner`;
						expect(reclaimed[0]?.lease_owner).toBe("worker-b");

						await tx`UPDATE public.lifecycle_operations
							SET status = 'completed', completed_at = now(), lease_owner = NULL
							WHERE id = ${operationA}::uuid`;
						let terminalMutationRejected = false;
						await tx
							.savepoint(async (savepoint) => {
								await savepoint`UPDATE public.lifecycle_operations
									SET safe_error_code = 'should_not_persist'
									WHERE id = ${operationA}::uuid`;
							})
							.catch(() => {
								terminalMutationRejected = true;
							});
						expect(terminalMutationRejected).toBe(true);

						await tx.unsafe("SET LOCAL ROLE hiai_app");
						await tx`SELECT set_config('app.current_user_id', ${actorA}, true)`;
						const visible = await tx`SELECT actor_user_id
							FROM public.lifecycle_operations ORDER BY actor_user_id`;
						expect(visible.map((row) => row.actor_user_id)).toEqual([actorA]);
						await tx.unsafe("RESET ROLE");

						throw new Error("ROLLBACK_LIFECYCLE_OPERATION_TEST");
					})
					.catch((error: Error) => {
						if (error.message !== "ROLLBACK_LIFECYCLE_OPERATION_TEST") throw error;
					});
			} finally {
				await sql.end();
			}
		},
	);
});
