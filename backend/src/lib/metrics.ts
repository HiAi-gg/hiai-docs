/**
 * In-memory metrics registry.
 *
 * Provides lightweight counters and a duration histogram for the embedding
 * pipeline. Zero external dependencies, zero allocations on the hot path
 * beyond an object lookup, and trivially snapshotable via `getMetrics()`.
 *
 * Scope: process-local only. Intended for `/api/admin/metrics` operator
 * dashboards and health checks — NOT a substitute for a real metrics
 * pipeline (Prometheus, OTLP, etc.). Restart the process to reset.
 *
 * Module boundaries: this file lives in `lib/` and MUST NOT import from
 * `api/` or `embedding/`. Callers (embedding pipeline, admin route) import
 * from here.
 */

interface CounterState {
	count: number;
}

/**
 * Internal registry. Keys are metric names; values are either:
 *   - `{ count: number }` for monotonic counters
 *   - `{ durations: number[] }` for the duration histogram
 *
 * We use a discriminated shape (no class) so `JSON.stringify` on the
 * `getMetrics()` snapshot produces a clean operator-facing payload.
 */
type MetricEntry =
	| { kind: "counter"; count: number }
	| { kind: "histogram"; durations: number[] };

const REGISTRY: Map<string, MetricEntry> = new Map();

/**
 * Names of the known counters. Kept as a typed enum-like object so
 * callers and the admin route share the same string identities without
 * having to repeat string literals across files. The runtime shape is
 * plain — no enum, since this is ESM and we want the keys to be plain
 * string properties on the value object.
 */
export const METRIC_NAMES = {
	EMBEDDING_SUCCESS: "embedding_success",
	EMBEDDING_FALLBACK: "embedding_fallback",
	EMBEDDING_ZERO: "embedding_zero",
	EMBEDDING_DURATION_MS: "embedding_duration_ms",
	EMBEDDING_CHUNKS_TOTAL: "embedding_chunks_total",
	EMBEDDING_DOCS_TOTAL: "embedding_docs_total",
} as const;

export type MetricName = (typeof METRIC_NAMES)[keyof typeof METRIC_NAMES];

/**
 * Get-or-create a counter entry. Counters are monotonic and identified by
 * their name. Centralised so the increment path stays a single Map
 * lookup and we never accidentally double-allocate.
 */
function getOrCreateCounter(name: string): CounterState {
	const existing = REGISTRY.get(name);
	if (existing?.kind === "counter") {
		return { count: existing.count };
	}
	REGISTRY.set(name, { kind: "counter", count: 0 });
	const entry = REGISTRY.get(name);
	if (entry?.kind !== "counter") {
		// Unreachable: we just inserted it.
		throw new Error(`metrics: counter ${name} missing after create`);
	}
	return { count: entry.count };
}

/**
 * Get-or-create the duration histogram entry. Stored as a plain array so
 * `getMetrics()` can return it directly without copying.
 */
function getOrCreateHistogram(name: string): number[] {
	const existing = REGISTRY.get(name);
	if (existing?.kind === "histogram") {
		return existing.durations;
	}
	REGISTRY.set(name, { kind: "histogram", durations: [] });
	const entry = REGISTRY.get(name);
	if (entry?.kind !== "histogram") {
		// Unreachable: we just inserted it.
		throw new Error(`metrics: histogram ${name} missing after create`);
	}
	return entry.durations;
}

/**
 * Increment a counter by 1. Idempotent w.r.t. metric identity — calling
 * with a previously-unknown name creates a new counter at 0 then bumps
 * it to 1.
 *
 * Non-positive increments are not supported; this is a counter API and
 * monotonic semantics keep `/api/admin/metrics` honest.
 */
export function incrementCounter(name: string): void {
	const entry = getOrCreateCounter(name);
	entry.count += 1;
	const stored = REGISTRY.get(name);
	if (stored && stored.kind === "counter") {
		stored.count = entry.count;
	}
}

/**
 * Add a duration sample to the named histogram. Samples are stored as a
 * plain array so `getMetrics()` can return them directly. The array is
 * unbounded — operators can `resetMetrics()` between probes if they want
 * a clean window.
 */
export function recordDuration(name: string, ms: number): void {
	const durations = getOrCreateHistogram(name);
	durations.push(ms);
}

/**
 * Snapshot all metrics as a plain JSON-serialisable object. Counters
 * surface as their integer count; the duration histogram surfaces as
 * the raw sample array (operators can compute p50/p95 externally).
 *
 * The map iteration order matches insertion order so the output is
 * stable across calls — helpful for log diffing and golden tests.
 */
export function getMetrics(): Record<string, number | number[]> {
	const out: Record<string, number | number[]> = {};
	for (const [name, entry] of REGISTRY) {
		if (entry.kind === "counter") {
			out[name] = entry.count;
		} else {
			out[name] = entry.durations.slice();
		}
	}
	return out;
}

/**
 * Clear all metrics. Intended for tests — the admin route never calls
 * this. After reset, `getMetrics()` returns `{}` and the next
 * `incrementCounter` / `recordDuration` re-creates the entries lazily.
 */
export function resetMetrics(): void {
	REGISTRY.clear();
}
