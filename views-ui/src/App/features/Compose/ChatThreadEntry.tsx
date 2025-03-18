import { FaUser } from "react-icons/fa";
import type { ToolMessage, UserMessage, ComposerState } from "@shared/types/Composer";
import { SkeletonLoader } from "../../SkeletonLoader";
import { useSettingsContext } from "../../context/settingsContext";
import { MessageWithMarkdown } from "./components/Markdown";
import { WriteFileOutput } from "./components/WriteFileOutput";
import { ToolOutput } from "./components/ToolOutput";
import { FiClock } from 'react-icons/fi';
import { CommandExecuteOutput } from "./components/CommandExecuteOutput";
import { useTools } from "./hooks/useTools";
import type { PropsWithChildren } from "react";

export function extractCodeBlock(text: string) {
	const regex = /```.*?\n([\s\S]*?)\n```/g;
	const matches = [];
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	while ((match = regex.exec(text)) !== null) {
		matches.push(match[1]);
	}
	return matches.length > 0 ? matches.join("\n") : text;
}

interface ChatThreadProps {
	state: ComposerState,
	loading: boolean
}

export const ChatThread = ({
	state,
	loading = false,
}: ChatThreadProps) => {
	const { isLightTheme } = useSettingsContext();
	const { toolMap } = useTools(state);

	console.log("Tool Map:", toolMap, loading, state);

	const renderedTools = new Set<string>();
	return (<>
		{state.messages.map((message, i) => {
			const fromUser = message.role === "user";
			if (fromUser || message.role === "assistant") {
				return (
					<ChatEntry key={message.id} fromUser={fromUser} message={message as UserMessage}>
						<MessageWithMarkdown message={String(message.content)} fromUser={fromUser} isLightTheme={isLightTheme} />
					</ChatEntry>
				);
			}

			const toolMessage = message as ToolMessage;
			const toolEvents = toolMap.get(toolMessage.toolCallId);
			const isLast = i === state.messages.length - 1;

			if (!toolEvents) {
				console.warn(`No tool events found for toolCallId: ${toolMessage.toolCallId}`);
				return null;
			}

			if (toolMessage.name === "write_file" && !renderedTools.has(toolMessage.toolCallId)) {
				renderedTools.add(toolMessage.toolCallId);
				return (
					<ChatEntry key={toolMessage.toolCallId} fromUser={false}>
						<WriteFileOutput isLightTheme={isLightTheme} messages={toolEvents} key={toolMessage.toolCallId} />
					</ChatEntry>
				);
			}

			if (toolMessage.name === "command_execute" && !renderedTools.has(toolMessage.toolCallId)) {
				renderedTools.add(toolMessage.toolCallId);
				return <ChatEntry key={toolMessage.toolCallId} fromUser={false}>
					<CommandExecuteOutput messages={toolEvents} isLightTheme={isLightTheme} />
				</ChatEntry>
			}

			if (!renderedTools.has(toolMessage.toolCallId)) {
				renderedTools.add(toolMessage.toolCallId);
				return <ChatEntry key={toolMessage.toolCallId} fromUser={false}>
					<ToolOutput isLightTheme={isLightTheme} messages={toolEvents} loading={isLast && loading} />
				</ChatEntry>
			}

			return null;
		})}
		{loading && !state.canResume && (
			<ChatEntry fromUser={false} key="loading">
				<div className="mt-4 flex justify-center items-center">
					<SkeletonLoader isDarkTheme={!isLightTheme} />
				</div>
			</ChatEntry>
		)}
		{state.canResume && (
			<div className="mt-4 flex justify-center items-center gap-2 text-gray-400/50">
				<FiClock className="border-amber-200 text-amber-700" /> Paused - pending approval
			</div>
		)}
	</>)
};

interface ChatEntryProps {
	message?: UserMessage;
	fromUser: boolean;
}

const ChatEntry = ({ fromUser, message, children }: PropsWithChildren<ChatEntryProps>) => {
	const bgClasses = fromUser ? "bg-stone-800 rounded-lg overflow-hidden w-full" : "";
	const textColor = fromUser ? "text-gray-200" : "text-[var(--vscode-input-foreground)]";

	return (
		<li
			className="tracking-wide leading-relaxed text-md message mt-4 mb-4"
		>
			<div className={`${fromUser ? "" : "pl-[48px]"} pr-[16px] flex items-center ${textColor}`}>
				<div className="relative flex items-center gap-4 flex-grow w-full">
					{fromUser && (
						<div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center">
							<FaUser className="text-stone-200" size={16} />
						</div>
					)}
					<div className={`${bgClasses} flex-grow w-full justify-center items-center ${fromUser ? "shadow-lg" : ""}`}>
						{children}
						{fromUser && message?.image && (
							<div className="p-3">
								<img
									src={(message as UserMessage).image?.data}
									alt="Attached Preview"
									className="max-w-full h-auto rounded-lg"
									style={{ maxHeight: "512px" }}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		</li>
	)
}