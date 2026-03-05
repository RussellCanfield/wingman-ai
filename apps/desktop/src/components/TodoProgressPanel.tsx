import { useState } from "react";
import type { TodoSnapshot, TodoStatus } from "../../../../shared/chat/todos";

type TodoProgressPanelProps = {
	snapshot: TodoSnapshot;
	title?: string;
	attached?: boolean;
};

const STATUS_LABELS: Record<TodoStatus, string> = {
	pending: "Pending",
	in_progress: "Active",
	completed: "Done",
};

const STATUS_BADGE_CLASSNAMES: Record<TodoStatus, string> = {
	pending: "border-white/15 bg-slate-800/80 text-slate-300",
	in_progress: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100",
	completed: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
};

const STATUS_DOT_CLASSNAMES: Record<TodoStatus, string> = {
	pending: "bg-slate-500",
	in_progress: "bg-cyan-300",
	completed: "bg-emerald-300",
};

export function TodoProgressPanel({
	snapshot,
	title = "Task progress",
	attached = false,
}: TodoProgressPanelProps) {
	const [expanded, setExpanded] = useState(false);
	const progressLabel = `${snapshot.completedCount}/${snapshot.totalCount}`;

	return (
		<section
			data-testid="todo-progress-panel"
			className={`overflow-hidden border border-white/10 bg-slate-950/85 shadow-[0_10px_24px_rgba(3,9,28,0.24)] backdrop-blur-sm ${
				attached
					? "mx-3 rounded-t-2xl rounded-b-none border-b-0 sm:mx-4"
					: "rounded-xl"
			}`}
		>
			<div className="flex items-center justify-between gap-3 px-3 py-2.5">
				<div className="flex min-w-0 items-center gap-2">
					<p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
						{title}
					</p>
					<span className="inline-flex shrink-0 items-center self-center rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold leading-none text-cyan-100">
						{progressLabel}
					</span>
				</div>
				<button
					type="button"
					aria-expanded={expanded}
					className="inline-flex shrink-0 items-center self-center rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-100"
					onClick={() => setExpanded((open) => !open)}
				>
					{expanded ? "Hide" : "Show"}
				</button>
			</div>
			<div
				aria-hidden={!expanded}
				className={`grid transition-all duration-200 ease-out ${
					expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
				}`}
			>
				<div className="min-h-0 overflow-hidden">
					<ol className="max-h-44 space-y-1.5 overflow-y-auto border-t border-white/10 px-3 py-2.5">
						{snapshot.todos.map((todo, index) => (
							<li
								key={`${index}-${todo.content}`}
								className="flex items-center gap-2.5 rounded-lg px-1 py-1"
							>
								<span
									aria-hidden="true"
									className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASSNAMES[todo.status]}`}
								/>
								<p
									title={todo.content}
									className={`min-w-0 flex-1 truncate text-sm ${
										todo.status === "completed"
											? "text-slate-400 line-through"
											: todo.status === "in_progress"
												? "text-slate-100"
												: "text-slate-300"
									}`}
								>
									{todo.content}
								</p>
								<span
									className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${STATUS_BADGE_CLASSNAMES[todo.status]}`}
								>
									{STATUS_LABELS[todo.status]}
								</span>
							</li>
						))}
					</ol>
				</div>
			</div>
		</section>
	);
}
