import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	parseBase64DataUrl,
	type PersistableMessage,
	persistAssistantImagesToDisk,
	resolveImageExtension,
} from "../cli/core/imagePersistence.js";

const PNG_DATA_URL =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3X6S0AAAAASUVORK5CYII=";

describe("imagePersistence", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("persists assistant image data URLs to disk", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-image-store-"));
		tempDirs.push(tempDir);
		const dbPath = join(tempDir, "wingman.db");

		const messages: PersistableMessage[] = [
			{
				role: "assistant" as const,
				attachments: [{ kind: "image" as const, dataUrl: PNG_DATA_URL }],
			},
		];

		persistAssistantImagesToDisk({
			dbPath,
			sessionId: "session-123",
			messages,
		});

		const attachment = messages[0].attachments?.[0];
		expect(typeof attachment?.path).toBe("string");
		expect(attachment?.mimeType).toBe("image/png");
		expect(typeof attachment?.size).toBe("number");
		expect(attachment?.size).toBeGreaterThan(0);
		expect(existsSync(attachment!.path!)).toBe(true);
		expect(readFileSync(attachment!.path!).length).toBe(attachment?.size);
	});

	it("does not persist non-assistant images", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-image-store-"));
		tempDirs.push(tempDir);
		const dbPath = join(tempDir, "wingman.db");

		const messages: PersistableMessage[] = [
			{
				role: "user" as const,
				attachments: [{ kind: "image" as const, dataUrl: PNG_DATA_URL }],
			},
		];

		persistAssistantImagesToDisk({
			dbPath,
			sessionId: "session-123",
			messages,
		});

		expect(messages[0].attachments?.[0].path).toBeUndefined();
	});

	it("keeps remote image URLs untouched", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-image-store-"));
		tempDirs.push(tempDir);
		const dbPath = join(tempDir, "wingman.db");

		const messages: PersistableMessage[] = [
			{
				role: "assistant" as const,
				attachments: [
					{
						kind: "image" as const,
						dataUrl: "https://example.com/image.png",
					},
				],
			},
		];

		persistAssistantImagesToDisk({
			dbPath,
			sessionId: "session-123",
			messages,
		});

		expect(messages[0].attachments?.[0].path).toBeUndefined();
	});

	it("derives deterministic file paths for repeated image payloads", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-image-store-"));
		tempDirs.push(tempDir);
		const dbPath = join(tempDir, "wingman.db");
		const messages: PersistableMessage[] = [
			{
				role: "assistant" as const,
				attachments: [{ kind: "image" as const, dataUrl: PNG_DATA_URL }],
			},
		];

		persistAssistantImagesToDisk({
			dbPath,
			sessionId: "session-123",
			messages,
		});
		const firstPath = messages[0].attachments?.[0].path;

		const nextMessages: PersistableMessage[] = [
			{
				role: "assistant" as const,
				attachments: [{ kind: "image" as const, dataUrl: PNG_DATA_URL }],
			},
		];
		persistAssistantImagesToDisk({
			dbPath,
			sessionId: "session-123",
			messages: nextMessages,
		});
		const secondPath = nextMessages[0].attachments?.[0].path;

		expect(firstPath).toBeTruthy();
		expect(secondPath).toBe(firstPath);
	});

	it("parses base64 data URLs and resolves extensions", () => {
		const parsed = parseBase64DataUrl(PNG_DATA_URL);
		expect(parsed?.mimeType).toBe("image/png");
		expect(typeof parsed?.data).toBe("string");

		expect(resolveImageExtension("image/jpeg")).toBe("jpg");
		expect(resolveImageExtension("image/svg+xml")).toBe("svg");
		expect(resolveImageExtension("image/custom+format")).toBe(
			"customformat",
		);
	});
});
