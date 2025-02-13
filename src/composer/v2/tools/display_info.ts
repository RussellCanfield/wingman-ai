import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

interface DisplayInfo {
    width: number;
    height: number;
    scaleFactor: number;
}

const getDisplayInfo = (): DisplayInfo => {
    // Standard desktop resolution with platform-aware DPI
    return {
        width: 1920,
        height: 1080,
        scaleFactor: process.platform === 'darwin' ? 2 : 1
    };
};

export const createDisplayInfoTool = () => {
    return new DynamicStructuredTool({
        name: "get_display_info",
        description: "Gets standard display configuration for testing",
        schema: z.object({
            format: z.string().optional().describe("Output format")
        }),
        func: async () => {
            const displayInfo = getDisplayInfo();

            return `target:
  viewportWidth: ${displayInfo.width}
  viewportHeight: ${displayInfo.height}
  deviceScaleFactor: ${displayInfo.scaleFactor}`;
        }
    });
};