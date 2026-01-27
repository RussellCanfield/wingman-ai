import React, { useEffect, useMemo, useState } from "react";
import type { FsListResponse, FsRootResponse } from "../types";

type WorkdirModalProps = {
	open: boolean;
	currentWorkdir?: string | null;
	outputRoot?: string;
	onClose: () => void;
	onSave: (workdir: string | null) => Promise<boolean>;
};

export const WorkdirModal: React.FC<WorkdirModalProps> = ({
	open,
	currentWorkdir,
	outputRoot,
	onClose,
	onSave,
}) => {
	const [roots, setRoots] = useState<string[]>([]);
	const [currentPath, setCurrentPath] = useState<string>("");
	const [entries, setEntries] = useState<Array<{ name: string; path: string }>>(
		[],
	);
	const [parentPath, setParentPath] = useState<string | null>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const [saving, setSaving] = useState<boolean>(false);
	const [error, setError] = useState<string>("");
	const [pathInput, setPathInput] = useState<string>("");

	const hasRoots = roots.length > 0;

	const defaultHint = useMemo(() => {
		if (!outputRoot) return "--";
		return outputRoot.replace(/\/+$/, "");
	}, [outputRoot]);

	const loadRoots = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await fetch("/api/fs/roots");
			if (!res.ok) {
				setError("Unable to load folder roots.");
				return;
			}
			const data = (await res.json()) as FsRootResponse;
			const resolved = data.roots || [];
			setRoots(resolved);
			const initial =
				currentWorkdir ||
				(resolved.length > 0 ? resolved[0] : outputRoot || "");
			if (initial) {
				await loadList(initial);
			}
		} catch {
			setError("Unable to load folder roots.");
		} finally {
			setLoading(false);
		}
	};

	const loadList = async (path: string) => {
		if (!path) return;
		setLoading(true);
		setError("");
		try {
			const params = new URLSearchParams({ path });
			const res = await fetch(`/api/fs/list?${params.toString()}`);
			if (!res.ok) {
				setError("Folder is not accessible or not allowed.");
				return;
			}
			const data = (await res.json()) as FsListResponse;
			setCurrentPath(data.path);
			setPathInput(data.path);
			setEntries(data.entries || []);
			setParentPath(data.parent ?? null);
		} catch {
			setError("Unable to load folder.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!open) return;
		void loadRoots();
	}, [open]);

	const handleSelectRoot = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const next = event.target.value;
		if (next) {
			void loadList(next);
		}
	};

	const handleGo = () => {
		if (pathInput.trim()) {
			void loadList(pathInput.trim());
		}
	};

	const handleSave = async () => {
		if (!currentPath) return;
		setSaving(true);
		const ok = await onSave(currentPath);
		setSaving(false);
		if (ok) {
			onClose();
		}
	};

	const handleClear = async () => {
		setSaving(true);
		const ok = await onSave(null);
		setSaving(false);
		if (ok) {
			onClose();
		}
	};

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
			<div className="glass-edge w-full max-w-2xl space-y-4 rounded-3xl p-6">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-lg font-semibold">Working Folder</h3>
						<p className="text-xs text-slate-500">
							Choose where the agent should write outputs for this session.
						</p>
					</div>
					<button className="button-ghost px-3 py-1 text-xs" onClick={onClose} type="button">
						Close
					</button>
				</div>

				{error ? (
					<div className="rounded-xl border border-rose-200/60 bg-rose-50/70 px-3 py-2 text-xs text-rose-600">
						{error}
					</div>
				) : null}

				<div className="space-y-3">
					<div className="flex flex-wrap items-center gap-3">
						<div className="flex-1">
							<label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
								Root
							</label>
							<select
								className="mt-2 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm"
								onChange={handleSelectRoot}
								value={
									hasRoots
										? roots.find(
												(root) =>
													currentPath === root ||
													currentPath.startsWith(`${root}/`) ||
													currentPath.startsWith(`${root}\\`),
											) || roots[0]
										: ""
								}
								disabled={!hasRoots}
							>
								{roots.map((root) => (
									<option key={root} value={root}>
										{root}
									</option>
								))}
							</select>
						</div>
						<div className="text-xs text-slate-500">
							Default output root: <span className="font-mono">{defaultHint}</span>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<input
							className="flex-1 rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-sm"
							value={pathInput}
							onChange={(event) => setPathInput(event.target.value)}
							placeholder="Select or paste a folder path"
						/>
						<button className="button-secondary px-3 py-2 text-xs" onClick={handleGo} type="button">
							Go
						</button>
						{parentPath ? (
							<button
								className="button-ghost px-3 py-2 text-xs"
								onClick={() => void loadList(parentPath)}
								type="button"
							>
								Up
							</button>
						) : null}
					</div>

					<div className="max-h-56 space-y-2 overflow-auto rounded-2xl border border-black/10 bg-white/80 p-3">
						{loading ? (
							<div className="text-xs text-slate-500">Loading folders...</div>
						) : entries.length === 0 ? (
							<div className="text-xs text-slate-500">No subfolders found.</div>
						) : (
							entries.map((entry) => (
								<button
									key={entry.path}
									type="button"
									className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition ${
										entry.path === currentPath
											? "border-emerald-500/40 bg-emerald-100/60 text-emerald-700"
											: "border-black/10 bg-white/70 text-slate-600 hover:border-emerald-200/60"
									}`}
									onClick={() => void loadList(entry.path)}
								>
									<span>{entry.name}</span>
									<span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Open</span>
								</button>
							))
						)}
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3 pt-2">
					<div className="text-xs text-slate-500">
						Current selection: <span className="font-mono">{currentPath || "--"}</span>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button className="button-secondary" onClick={handleClear} type="button" disabled={saving}>
							Clear
						</button>
						<button className="button-primary" onClick={handleSave} type="button" disabled={saving || !currentPath}>
							Use Folder
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
