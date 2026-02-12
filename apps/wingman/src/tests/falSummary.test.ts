import { describe, expect, it } from "vitest";
import {
	buildFalGenerationSummary,
	formatFalPath,
} from "../tools/fal/summary.js";

describe("fal summary", () => {
	it("formats summary text with status, model, and files", () => {
		const summary = buildFalGenerationSummary({
			toolName: "generate_image_or_texture",
			jobId: "job-123",
			status: "completed",
			modelId: "fal-ai/nano-banana-pro",
			reviewState: "accepted",
			media: [
				{
					modality: "image",
					path: "/repo/apps/wingman/generated/images/asset.png",
					mimeType: "image/png",
				},
			],
			cwd: "/repo/apps/wingman",
		});

		expect(summary).toContain("FAL job `job-123`");
		expect(summary).toContain("**completed**");
		expect(summary).toContain("- Model: `fal-ai/nano-banana-pro`");
		expect(summary).toContain("- Assets: 1");
		expect(summary).toContain("[image] ./generated/images/asset.png image/png");
	});

	it("includes review instruction when pending", () => {
		const summary = buildFalGenerationSummary({
			toolName: "generate_video_from_image",
			jobId: "job-456",
			status: "awaiting_review",
			modelId: "fal-ai/kling-video/o3/standard/image-to-video",
			reviewState: "pending",
			media: [],
		});

		expect(summary).toContain("Review required");
		expect(summary).toContain("fal_generation_status");
	});

	it("formats home paths with tilde when outside cwd", () => {
		const formatted = formatFalPath("/Users/demo/Projects/output.mp4", {
			cwd: "/repo/apps/wingman",
			homeDir: "/Users/demo",
		});

		expect(formatted).toBe("~/Projects/output.mp4");
	});
});
