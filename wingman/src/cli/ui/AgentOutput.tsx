import React from "react";
import { Box, Text } from "ink";
import type { ContentBlock, ToolCallBlock, TextBlock } from "../types.js";
import { ToolCallDisplay } from "./components/ToolCallDisplay.js";

export interface AgentOutputProps {
	blocks: ContentBlock[];
	activeTools: Map<string, ToolCallBlock>;
	isStreaming: boolean;
}

export const AgentOutput: React.FC<AgentOutputProps> = ({
	blocks,
	activeTools,
	isStreaming,
}) => {
	if (blocks.length === 0 && !isStreaming) {
		return null;
	}

	return (
		<Box flexDirection="column">
			{blocks.map((block, index) => {
				switch (block.type) {
					case "text": {
						const textData = block.data as TextBlock;
						const isLastBlock = index === blocks.length - 1;
						const showStreamingIndicator =
							isLastBlock && isStreaming && textData.isStreaming;

						return (
							<Box key={block.id} flexDirection="column">
								<Text>{textData.content}</Text>
								{showStreamingIndicator && (
									<Text dimColor italic>
										...
									</Text>
								)}
							</Box>
						);
					}

					case "tool-call": {
						const toolData = block.data as ToolCallBlock;
						// Get updated status from activeTools map
						const activeTool = activeTools.get(block.id);
						const displayTool = activeTool || toolData;

						return <ToolCallDisplay key={block.id} tool={displayTool} />;
					}

					default:
						return null;
				}
			})}
		</Box>
	);
};
