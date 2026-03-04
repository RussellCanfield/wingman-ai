import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import type { FsListResponse, FsMkdirResponse, FsRootResponse } from "../types";

type WorkdirModalProps = {
	open: boolean;
	currentWorkdir?: string | null;
	outputRoot?: string;
	onClose: () => void;
	onSave: (workdir: string | null) => Promise<boolean>;
};

const TOKEN_KEY = "wingman_webui_token";
const PASSWORD_KEY = "wingman_webui_password";

function withGatewayAuthHeaders(initHeaders?: HeadersInit): Headers {
	const headers = new Headers(initHeaders || undefined);
	try {
		const token = (window.localStorage.getItem(TOKEN_KEY) || "").trim();
		const password = (window.localStorage.getItem(PASSWORD_KEY) || "").trim();
		if (token) {
			headers.set("Authorization", `Bearer ${token}`);
		}
		if (password) {
			headers.set("X-Wingman-Password", password);
		}
	} catch {
		// Ignore localStorage access errors and fall back to anonymous fetch.
	}
	return headers;
}

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
	const [creating, setCreating] = useState<boolean>(false);
	const [error, setError] = useState<string>("");
	const [pathInput, setPathInput] = useState<string>("");
	const [newFolderName, setNewFolderName] = useState<string>("");

	const hasRoots = roots.length > 0;

	const defaultHint = useMemo(() => {
		if (!outputRoot) return "--";
		return outputRoot.replace(/\/+$/, "");
	}, [outputRoot]);

	const loadList = useCallback(async (path: string) => {
		if (!path) return;
		setLoading(true);
		setError("");
		try {
			const params = new URLSearchParams({ path });
			const res = await fetch(`/api/fs/list?${params.toString()}`, {
				headers: withGatewayAuthHeaders(),
			});
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
	}, []);

	const loadRoots = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const res = await fetch("/api/fs/roots", {
				headers: withGatewayAuthHeaders(),
			});
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
	}, [currentWorkdir, outputRoot, loadList]);

	useEffect(() => {
		if (!open) return;
		void loadRoots();
	}, [open, loadRoots]);

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

	const handleCreateFolder = async () => {
		const parentPath = currentPath.trim();
		const folderName = newFolderName.trim();
		if (!parentPath) {
			setError("Select a parent folder before creating a new folder.");
			return;
		}
		if (!folderName) {
			setError("Folder name is required.");
			return;
		}
		setCreating(true);
		setError("");
		try {
			const res = await fetch("/api/fs/mkdir", {
				method: "POST",
				headers: withGatewayAuthHeaders({
					"Content-Type": "application/json",
				}),
				body: JSON.stringify({ path: parentPath, name: folderName }),
			});
			if (!res.ok) {
				const message = (await res.text()) || "Unable to create folder.";
				setError(message);
				return;
			}
			const payload = (await res.json()) as FsMkdirResponse;
			setNewFolderName("");
			await loadList(payload.path || parentPath);
		} catch {
			setError("Unable to create folder.");
		} finally {
			setCreating(false);
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

	const sectionCardClass =
		"rounded-2xl border border-slate-700/70 bg-gradient-to-b from-slate-900/75 to-slate-950/75 p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.1)]";
	const sectionLabelClass =
		"text-[11px] uppercase tracking-[0.2em] text-slate-400";

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
			<div className="glass-edge w-full max-w-3xl overflow-hidden rounded-3xl border border-sky-500/25 bg-gradient-to-b from-[#071327]/95 via-[#050f22]/95 to-[#030819]/95 p-0 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
				<div className="flex items-start justify-between border-b border-slate-700/70 bg-slate-950/35 px-5 py-4 sm:px-6">
					<div className="space-y-1">
						<h3 className="text-xl font-semibold text-slate-100">
							Working Folder
						</h3>
						<p className="text-sm text-slate-400">
							Choose where the agent should write outputs for this session.
						</p>
					</div>
					<button
						className="button-ghost px-3 py-1 text-xs"
						aria-label="Close dialog"
						onClick={onClose}
						type="button"
					>
						<FiX className="h-4 w-4" />
					</button>
				</div>

				<div className="space-y-4 px-5 py-5 sm:px-6">
					{error ? (
						<div className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
							{error}
						</div>
					) : null}

					<section className={sectionCardClass}>
						<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
							<div>
								<label
									className={sectionLabelClass}
									htmlFor="workdir-root-select"
								>
									Root
								</label>
								<select
									id="workdir-root-select"
									className="mt-2 w-full rounded-xl border border-slate-600/70 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-sky-400/60"
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
							<div className="rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2">
								<p className={sectionLabelClass}>Default Output Root</p>
								<p className="mt-1 break-all font-mono text-xs text-slate-200">
									{defaultHint}
								</p>
							</div>
						</div>
					</section>

					<section className={sectionCardClass}>
						<p className={sectionLabelClass}>Browse Path</p>
						<div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
							<input
								className="min-w-0 flex-1 rounded-xl border border-slate-600/70 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400/60"
								value={pathInput}
								onChange={(event) => setPathInput(event.target.value)}
								placeholder="Select or paste a folder path"
							/>
							<button
								className="button-secondary px-4 py-2 text-xs sm:px-3"
								onClick={handleGo}
								type="button"
							>
								Go
							</button>
							{parentPath ? (
								<button
									className="button-ghost px-4 py-2 text-xs sm:px-3"
									onClick={() => void loadList(parentPath)}
									type="button"
								>
									Up
								</button>
							) : null}
						</div>
					</section>

					<section className={sectionCardClass}>
						<p className={sectionLabelClass}>Create New Folder</p>
						<div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
							<input
								className="min-w-0 flex-1 rounded-xl border border-slate-600/70 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400/60"
								value={newFolderName}
								onChange={(event) => setNewFolderName(event.target.value)}
								placeholder="New folder name"
							/>
							<button
								className="button-secondary px-4 py-2 text-xs sm:px-3"
								onClick={handleCreateFolder}
								type="button"
								disabled={
									creating || !currentPath.trim() || !newFolderName.trim()
								}
							>
								{creating ? "Creating..." : "Create Folder"}
							</button>
						</div>
					</section>

					<section className={sectionCardClass}>
						<div className="mb-3 flex items-center justify-between">
							<p className={sectionLabelClass}>Subfolders</p>
							<span className="rounded-full border border-slate-600/70 bg-slate-950/75 px-2.5 py-1 text-[11px] font-mono text-slate-300">
								{entries.length}
							</span>
						</div>
						<div className="max-h-64 space-y-2 overflow-auto rounded-xl border border-slate-700/70 bg-slate-950/70 p-2.5">
							{loading ? (
								<div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
									Loading folders...
								</div>
							) : entries.length === 0 ? (
								<div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
									No subfolders found.
								</div>
							) : (
								entries.map((entry) => (
									<button
										key={entry.path}
										type="button"
										className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition ${
											entry.path === currentPath
												? "border-sky-500/55 bg-sky-500/15 text-sky-200"
												: "border-slate-700/70 bg-slate-950/55 text-slate-300 hover:border-sky-400/50"
										}`}
										onClick={() => void loadList(entry.path)}
									>
										<span>{entry.name}</span>
										<span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
											Open
										</span>
									</button>
								))
							)}
						</div>
					</section>
				</div>

				<div className="flex flex-col gap-3 border-t border-slate-700/70 bg-slate-950/35 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
					<div className="min-w-0 rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 py-2">
						<p className={sectionLabelClass}>Current Selection</p>
						<p className="mt-1 break-all font-mono text-xs text-slate-200">
							{currentPath || "--"}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button
							className="button-secondary px-4 py-2"
							onClick={handleClear}
							type="button"
							disabled={saving}
						>
							Clear
						</button>
						<button
							className="button-primary px-4 py-2"
							onClick={handleSave}
							type="button"
							disabled={saving || !currentPath}
						>
							Use Folder
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
