import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	getMetrics,
	incrementCounter,
	METRIC_NAMES,
	recordDuration,
	resetMetrics,
} from "../lib/metrics";

describe("metrics registry", () => {
	beforeEach(() => {
		// Clear BEFORE each test so the registry starts empty. The suite
		// is process-shared (bun:test runs files in one process), and the
		// integration tests in `tests/integration/_harness.ts` mock the
		// embedding module — without a reset here, leftover state from
		// earlier tests can mask new writes.
		resetMetrics();
	});

	afterEach(() => {
		resetMetrics();
	});

	test("incrementCounter creates and bumps an unknown counter", () => {
		expect(getMetrics()).toEqual({});
		incrementCounter("custom_counter");
		incrementCounter("custom_counter");
		incrementCounter("custom_counter");
		expect(getMetrics().custom_counter).toBe(3);
	});

	test("recordDuration appends samples to a histogram", () => {
		recordDuration("custom_latency_ms", 10);
		recordDuration("custom_latency_ms", 25);
		recordDuration("custom_latency_ms", 7);
		const samples = getMetrics().custom_latency_ms;
		expect(Array.isArray(samples)).toBe(true);
		expect(samples).toEqual([10, 25, 7]);
	});

	test("getMetrics returns a stable snapshot (defensive copy of histogram)", () => {
		recordDuration("custom_latency_ms", 1);
		const snap = getMetrics();
		// Mutating the snapshot must NOT mutate the underlying registry.
		(snap.custom_latency_ms as number[]).push(999);
		const second = getMetrics();
		expect(second.custom_latency_ms).toEqual([1]);
	});

	test("METRIC_NAMES exposes all six reserved identifiers", () => {
		expect(METRIC_NAMES.EMBEDDING_SUCCESS).toBe("embedding_success");
		expect(METRIC_NAMES.EMBEDDING_FALLBACK).toBe("embedding_fallback");
		expect(METRIC_NAMES.EMBEDDING_ZERO).toBe("embedding_zero");
		expect(METRIC_NAMES.EMBEDDING_DURATION_MS).toBe("embedding_duration_ms");
		expect(METRIC_NAMES.EMBEDDING_CHUNKS_TOTAL).toBe("embedding_chunks_total");
		expect(METRIC_NAMES.EMBEDDING_DOCS_TOTAL).toBe("embedding_docs_total");
	});

	test("resetMetrics clears the registry", () => {
		incrementCounter(METRIC_NAMES.EMBEDDING_SUCCESS);
		recordDuration(METRIC_NAMES.EMBEDDING_DURATION_MS, 5);
		expect(Object.keys(getMetrics()).length).toBeGreaterThan(0);
		resetMetrics();
		expect(getMetrics()).toEqual({});
	});

	test("counters and histograms share the same registry by name (monotonic counters)", () => {
		// Counters are monotonic and never regress — we don't decrement, so
		// this guards against a future refactor that swaps a counter for a
		// histogram under the same key.
		incrementCounter("shared_name");
		incrementCounter("shared_name");
		const snap = getMetrics();
		expect(snap.shared_name).toBe(2);
		expect(typeof snap.shared_name).toBe("number");
	});

	test("counter survives many increments without losing precision", () => {
		for (let i = 0; i < 1000; i++) {
			incrementCounter(METRIC_NAMES.EMBEDDING_CHUNKS_TOTAL);
		}
		expect(getMetrics()[METRIC_NAMES.EMBEDDING_CHUNKS_TOTAL]).toBe(1000);
	});
});

describe("metrics module re-exports", () => {
	// The embedding module imports `METRIC_NAMES`, `incrementCounter`, and
	// `recordDuration` from this module. We verify the names are exported
	// and match the strings we use inside `embedding/index.ts`. The
	// behavioural wiring is covered by the production code path — the
	// integration tests under `tests/integration/_harness.ts` mock
	// `embedding/index` and would interfere with end-to-end assertions,
	// so we stay at the surface level here.

	test("embedding module imports the metrics functions without throwing", async () => {
		// Importing the embedding module executes its top-level statements
		// (the import-time `import { incrementCounter, ... } from
		// "../lib/metrics"`). If the export names ever drift, this throws.
		const mod = await import("../embedding");
		expect(typeof mod.getEmbedding).toBe("function");
		expect(typeof mod.embedDocument).toBe("function");
	});

	test("worker module imports the metrics functions without throwing", async () => {
		// The worker is a long-lived side-effecting module. We just touch
		// its module body to make sure its top-level metrics import is
		// intact (i.e. the import path + named exports still line up).
		// We do NOT call `startEmbeddingWorker` because that would
		// connect to Redis and start a queue listener.
		await expect(import("../embedding/worker")).resolves.toBeDefined();
	});
});
