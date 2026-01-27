import React, { useEffect, useMemo, useRef } from "react";
import type { Thread, ToolEvent } from "../types";
import { ToolEventPanel } from "./ToolEventPanel";

type ChatPanelProps = {
	activeThread?: Thread;
	prompt: string;
	isStreaming: boolean;
	connected: boolean;
	loading: boolean;
	toolEvents: ToolEvent[];
	onPromptChange: (value: string) => void;
	onSendPrompt: () => void;
	onClearChat: () => void;
	onOpenCommandDeck: () => void;
};

const QUICK_PROMPTS = [
	"Summarize the latest updates in this thread.",
	"Draft a plan of attack for the next task.",
	"List open questions we need to resolve.",
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
	activeThread,
	prompt,
	isStreaming,
	connected,
	loading,
	toolEvents,
	onPromptChange,
	onSendPrompt,
	onClearChat,
	onOpenCommandDeck,
}) => {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const hasToolEvents = toolEvents.length > 0;

	const activeToolCount = useMemo(
		() => toolEvents.filter((event) => event.status === "running").length,
		[toolEvents],
	);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [activeThread?.messages, isStreaming]);

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			onSendPrompt();
		}
	};

	return (
		<section className="panel-card animate-rise flex h-[calc(100vh-120px)] min-h-[1200px] flex-col gap-6 p-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h2 className="text-lg font-semibold">Mission Stream</h2>
					<p className="mt-1 text-sm text-slate-500">
						Thread: <span className="font-semibold text-slate-700">{activeThread?.name || "--"}</span>
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button className="button-secondary" onClick={onClearChat} type="button">
						Clear
					</button>
				</div>
			</header>

			<div
				ref={scrollRef}
				className="flex-1 min-h-0 space-y-4 overflow-auto rounded-2xl border border-black/10 bg-gradient-to-b from-white/80 to-white/95 p-4"
			>
				{loading ? (
					<div className="grid h-full place-items-center text-sm text-slate-500">
						Loading messages...
					</div>
				) : !activeThread || activeThread.messages.length === 0 ? (
					<div className="grid h-full place-items-center text-sm text-slate-500">
						<div className="max-w-sm text-center">
							<p className="text-base font-semibold text-slate-700">Launch a new mission.</p>
							<p className="mt-2 text-sm text-slate-500">
								Send a prompt to begin, or pick a quick prompt below to shape the session.
							</p>
						</div>
					</div>
				) : (
					activeThread.messages.map((msg) => (
						<div
							key={msg.id}
							className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
						>
							<div
								className={`w-fit max-w-[78%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-[0_10px_18px_rgba(18,14,12,0.08)] ${msg.role === "user"
									? "border-orange-200/60 bg-orange-100/40 text-slate-800"
									: "border-emerald-200/60 bg-emerald-100/30 text-slate-700"
									}`}
							>
								<div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
									<span>{msg.role === "user" ? "You" : "Wingman"}</span>
									<span>{formatTime(msg.createdAt)}</span>
								</div>
								{msg.role === "assistant" && !msg.content ? (
									<div className="mt-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
										<span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
										<span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 [animation-delay:150ms]" />
										<span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 [animation-delay:300ms]" />
										<span>{isStreaming ? "Streaming..." : "Waiting..."}</span>
									</div>
								) : (
									<p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
										{msg.content}
									</p>
								)}
							</div>
						</div>
					))
				)}
			</div>

			{hasToolEvents ? (
				<ToolEventPanel toolEvents={toolEvents} activeCount={activeToolCount} />
			) : null}

			<div className="rounded-2xl border border-black/10 bg-white/80 p-4">
				{!connected ? (
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-xs text-amber-800">
						<div>
							<span className="font-semibold">Gateway not connected.</span>{" "}
							Open the Command Deck to connect before sending prompts.
						</div>
						<button className="button-secondary px-3 py-1 text-xs" type="button" onClick={onOpenCommandDeck}>
							Open Command Deck
						</button>
					</div>
				) : null}
				<label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Prompt</label>
				<textarea
					className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-3 py-3 text-sm focus:shadow-glow"
					rows={3}
					value={prompt}
					onChange={(event) => onPromptChange(event.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Ask Wingman to do something..."
					disabled={isStreaming}
				/>
				<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-2">
						{QUICK_PROMPTS.map((item) => (
							<button
								key={item}
								type="button"
								className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs text-slate-600 transition hover:border-emerald-200/60"
								onClick={() => onPromptChange(item)}
							>
								{item}
							</button>
						))}
					</div>
					<div className="flex items-center gap-3 text-xs text-slate-500">
						{isStreaming ? <span>Streaming response...</span> : null}
						<button
							className="button-primary"
							onClick={onSendPrompt}
							type="button"
							disabled={isStreaming || !connected}
						>
							Send Prompt
						</button>
					</div>
				</div>
			</div>
		</section>
	);
};

function formatTime(timestamp?: number): string {
	if (!timestamp) return "--";
	try {
		return new Date(timestamp).toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "--";
	}
}
