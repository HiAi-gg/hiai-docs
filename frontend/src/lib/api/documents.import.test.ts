import { describe, expect, test } from "bun:test";
import { ApiError } from "./client";
import {
	type ImportResult,
	importDocument,
	importDocuments,
} from "./documents";

function okImport(filename: string, id: string): Response {
	return Response.json(
		{
			items: [
				{
					filename,
					status: "ok",
					document: {
						id,
						title: filename.replace(/\.[^.]+$/, ""),
						content: "",
						createdAt: "2026-01-01T00:00:00.000Z",
						updatedAt: "2026-01-01T00:00:00.000Z",
					},
				},
			],
			imported: 1,
			failed: 0,
		},
		{ status: 201 },
	);
}

describe("importDocuments", () => {
	test("settles files independently while preserving input order", async () => {
		const files = [
			new File(["slow"], "slow.md"),
			new File(["broken"], "broken.docx"),
			new File(["fast"], "fast.txt"),
		];
		const delays = new Map([
			["slow.md", 30],
			["broken.docx", 15],
			["fast.txt", 1],
		]);
		const settled: string[] = [];

		const fetcher = (async (_path: RequestInfo | URL, init?: RequestInit) => {
			const file = (init?.body as FormData).get("file") as File;
			await Bun.sleep(delays.get(file.name) ?? 0);
			if (file.name === "broken.docx") {
				return Response.json(
					{ error: `Failed to parse DOCX "${file.name}"` },
					{ status: 422 },
				);
			}
			return okImport(file.name, `id-${file.name}`);
		}) as typeof fetch;

		const response = await importDocuments(files, undefined, fetcher, {
			concurrency: 3,
			onItemSettled: (result) => settled.push(result.filename),
		});

		expect(settled).toEqual(["fast.txt", "broken.docx", "slow.md"]);
		expect(response.items.map((item) => item.filename)).toEqual([
			"slow.md",
			"broken.docx",
			"fast.txt",
		]);
		expect(response.items.map((item) => item.status)).toEqual([
			"ok",
			"error",
			"ok",
		]);
		expect(response.imported).toBe(2);
		expect(response.failed).toBe(1);
	});

	test("limits concurrent requests", async () => {
		const files = Array.from(
			{ length: 7 },
			(_, index) => new File([`${index}`], `file-${index}.md`),
		);
		let active = 0;
		let peak = 0;

		const fetcher = (async (_path: RequestInfo | URL, init?: RequestInit) => {
			const file = (init?.body as FormData).get("file") as File;
			active += 1;
			peak = Math.max(peak, active);
			await Bun.sleep(5);
			active -= 1;
			return okImport(file.name, `id-${file.name}`);
		}) as typeof fetch;

		const response = await importDocuments(files, undefined, fetcher, {
			concurrency: 3,
		});

		expect(peak).toBe(3);
		expect(response.imported).toBe(7);
		expect(response.failed).toBe(0);
	});

	test("hard-caps caller-requested concurrency at three", async () => {
		const files = Array.from(
			{ length: 7 },
			(_, index) => new File([`${index}`], `file-${index}.md`),
		);
		let active = 0;
		let peak = 0;

		const fetcher = (async (_path: RequestInfo | URL, init?: RequestInit) => {
			const file = (init?.body as FormData).get("file") as File;
			active += 1;
			peak = Math.max(peak, active);
			await Bun.sleep(5);
			active -= 1;
			return okImport(file.name, `id-${file.name}`);
		}) as typeof fetch;

		await importDocuments(files, undefined, fetcher, { concurrency: 100 });

		expect(peak).toBe(3);
	});

	test("preserves ApiError status for the single-file helper", async () => {
		const fetcher = (async (_path: RequestInfo | URL, _init?: RequestInit) =>
			Response.json(
				{ error: "Invalid file type" },
				{ status: 415 },
			)) as typeof fetch;

		try {
			await importDocument(new File(["MZ"], "binary.exe"), undefined, fetcher);
			throw new Error("Expected importDocument to reject");
		} catch (error) {
			expect(error).toBeInstanceOf(ApiError);
			expect((error as ApiError).status).toBe(415);
		}
	});

	test("normalizes fetch failures into per-file errors", async () => {
		const files = [new File(["ok"], "ok.md"), new File(["fail"], "network.md")];
		const settled: ImportResult[] = [];

		const fetcher = (async (_path: RequestInfo | URL, init?: RequestInit) => {
			const file = (init?.body as FormData).get("file") as File;
			if (file.name === "network.md") {
				throw new Error("Network unavailable");
			}
			return okImport(file.name, "ok-id");
		}) as typeof fetch;

		const response = await importDocuments(files, undefined, fetcher, {
			onItemSettled: (result) => settled.push(result),
		});

		expect(response.imported).toBe(1);
		expect(response.failed).toBe(1);
		expect(response.items[1]).toEqual({
			filename: "network.md",
			status: "error",
			error: "Network unavailable",
		});
		expect(settled).toHaveLength(2);
	});
});
