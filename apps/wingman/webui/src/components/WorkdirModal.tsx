import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiChevronRight, FiFolderPlus, FiX } from "react-icons/fi";
import type { FsListResponse, FsMkdirResponse, FsRootResponse } from "../types";

type WorkdirModalProps = {
	open: boolean;
	currentWorkdir?: string | null;
	defaultWorkdir?: string;
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
	defaultWorkdir,
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
	const trimmedCurrentPath = currentPath.trim();

	const normalizedDefaultWorkdir = useMemo(() => {
		if (!defaultWorkdir) return "";
		return defaultWorkdir.replace(/\/+$/, "");
	}, [defaultWorkdir]);

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
				normalizedDefaultWorkdir ||
				(resolved.length > 0 ? resolved[0] : "");
			if (initial) {
				await loadList(initial);
			}
		} catch {
			setError("Unable to load folder roots.");
		} finally {
			setLoading(false);
		}
	}, [currentWorkdir, normalizedDefaultWorkdir, loadList]);

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
		const nextPath = pathInput.trim();
		if (!nextPath) return;
		void loadList(nextPath);
	};

	const handlePathInputKeyDown = (
		event: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (event.key !== "Enter") return;
		event.preventDefault();
		handleGo();
	};

	const handleCreateFolder = async () => {
		const parentPathValue = trimmedCurrentPath;
		const folderName = newFolderName.trim();
		if (!parentPathValue) {
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
				body: JSON.stringify({ path: parentPathValue, name: folderName }),
			});
			if (!res.ok) {
				const message = (await res.text()) || "Unable to create folder.";
				setError(message);
				return;
			}
			const payload = (await res.json()) as FsMkdirResponse;
			setNewFolderName("");
			await loadList(payload.path || parentPathValue);
		} catch {
			setError("Unable to create folder.");
		} finally {
			setCreating(false);
		}
	};

	const handleNewFolderNameKeyDown = (
		event: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (event.key !== "Enter") return;
		event.preventDefault();
		void handleCreateFolder();
	};

	const handleSave = async () => {
		if (!trimmedCurrentPath) return;
		setSaving(true);
		const ok = await onSave(trimmedCurrentPath);
		setSaving(false);
		if (ok) {
			onClose();
		}
	};

	const handleUseDefault = async () => {
		setSaving(true);
		const ok = await onSave(null);
		setSaving(false);
		if (ok) {
			onClose();
		}
	};

	if (!open) return null;

	const sectionCardClass =
		"rounded-[24px] border border-slate-700/70 bg-gradient-to-b from-slate-900/75 to-slate-950/75 p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.1)] sm:p-5";
	const contentCardClass =
		"rounded-2xl border border-slate-700/70 bg-slate-950/65 px-4 py-3";
	const sectionLabelClass =
		"text-[11px] uppercase tracking-[0.2em] text-slate-400";
	const sectionTitleClass = "text-sm font-semibold text-slate-100";
	const helperTextClass = "text-xs leading-5 text-slate-400";
	const browserButtonClass =
		"inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-sky-400/45 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-50";
	const inputClass =
		"min-w-0 w-full rounded-xl border border-slate-600/70 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400/60";
	const footerActionClass = "inline-flex w-full items-center justify-center";

	return (
		<div className="fixed inset-0 z-50 bg-slate-950/80 p-3 backdrop-blur-sm sm:p-4">
			<div className="flex h-full items-center justify-center">
				<div className="glass-edge flex max-h-[min(92vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-sky-500/25 bg-gradient-to-b from-[#071327]/95 via-[#050f22]/95 to-[#030819]/95 p-0 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
					<div className="flex items-start justify-between gap-4 border-b border-slate-700/70 bg-slate-950/35 px-4 py-4 sm:px-6">
						<div className="min-w-0 space-y-1">
							<h3 className="text-lg font-semibold text-slate-100 sm:text-xl">
								Working Folder
							</h3>
							<p className="pr-2 text-sm text-slate-400">
								Choose where the agent should write outputs for this session.
							</p>
						</div>
						<button
							className="button-ghost shrink-0 px-3 py-1 text-xs"
							aria-label="Close dialog"
							onClick={onClose}
							type="button"
						>
							<FiX className="h-4 w-4" />
						</button>
					</div>

					<div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
						{error ? (
							<div className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
								{error}
							</div>
						) : null}

						<section className={sectionCardClass}>
							<p className={sectionLabelClass}>Current Folder</p>
							<p className="mt-3 break-all font-mono text-xs leading-5 text-slate-100 sm:text-sm">
								{currentWorkdir || normalizedDefaultWorkdir || "--"}
							</p>
							<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
								<div className="min-w-0">
									<p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
										Default Folder
									</p>
									<p className="mt-1 break-all font-mono text-xs leading-5 text-slate-300">
										{normalizedDefaultWorkdir || "--"}
									</p>
								</div>
								<button
									className="button-secondary w-full px-4 py-2 sm:w-auto sm:min-w-[180px]"
									onClick={handleUseDefault}
									type="button"
									disabled={saving || !normalizedDefaultWorkdir}
								>
									Revert to Default
								</button>
							</div>
						</section>

						<section className={sectionCardClass}>
							<div className="space-y-1">
								<p className={sectionTitleClass}>Browse Folders</p>
								<p className={helperTextClass}>
									Start from an allowed root, then navigate or create a subfolder
									for this thread.
								</p>
							</div>

							<div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
								<div className="min-w-0">
									<label
										className={sectionLabelClass}
										htmlFor="workdir-root-select"
									>
										Allowed Root
									</label>
									<select
										id="workdir-root-select"
										className={`${inputClass} mt-2`}
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

								<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 xl:self-end">
									<button
										className={browserButtonClass}
										onClick={() => parentPath && void loadList(parentPath)}
										type="button"
										disabled={!parentPath || loading}
									>
										Up One Level
									</button>
									<button
										className={browserButtonClass}
										onClick={handleGo}
										type="button"
										disabled={loading || !pathInput.trim()}
									>
										Go to Path
									</button>
								</div>
							</div>

							<div className="mt-4">
								<label className={sectionLabelClass} htmlFor="workdir-path-input">
									Location
								</label>
								<div className="mt-2">
									<input
										id="workdir-path-input"
										className={inputClass}
										value={pathInput}
										onChange={(event) => setPathInput(event.target.value)}
										onKeyDown={handlePathInputKeyDown}
										placeholder="Paste a folder path or browse below"
									/>
								</div>
							</div>

							<div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
								<div className="min-w-0 rounded-2xl border border-slate-700/70 bg-slate-950/65">
									<div className="flex items-start justify-between gap-3 border-b border-slate-700/70 px-4 py-3">
										<div className="min-w-0">
											<p className={sectionLabelClass}>Folders in This Location</p>
											<p className="mt-1 break-all font-mono text-xs leading-5 text-slate-300">
												{trimmedCurrentPath || "--"}
											</p>
										</div>
										<span className="shrink-0 rounded-full border border-slate-600/70 bg-slate-950/75 px-2.5 py-1 text-[11px] font-mono text-slate-300">
											{entries.length}
										</span>
									</div>
									<div className="max-h-72 min-h-[176px] space-y-2 overflow-auto p-3">
										{loading ? (
											<div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
												Loading folders...
											</div>
										) : entries.length === 0 ? (
											<div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
												No subfolders found here.
											</div>
										) : (
											entries.map((entry) => (
												<button
													key={entry.path}
													type="button"
													className="flex w-full items-center justify-between rounded-xl border border-slate-700/70 bg-slate-950/55 px-3 py-2.5 text-left text-xs font-semibold text-slate-300 transition hover:border-sky-400/50 hover:bg-sky-500/10 hover:text-sky-100"
													onClick={() => void loadList(entry.path)}
												>
													<span className="min-w-0 truncate">{entry.name}</span>
													<FiChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
												</button>
											))
										)}
									</div>
								</div>

								<div className={`${contentCardClass} flex h-full flex-col gap-3`}>
									<div className="flex items-center gap-2">
										<FiFolderPlus className="h-4 w-4 text-slate-400" />
										<p className={sectionLabelClass}>Create Folder Here</p>
									</div>
									<p className={helperTextClass}>
										New folders are created inside the current location.
									</p>
									<input
										className={inputClass}
										value={newFolderName}
										onChange={(event) => setNewFolderName(event.target.value)}
										onKeyDown={handleNewFolderNameKeyDown}
										placeholder="New folder name"
									/>
									<button
										className="button-secondary mt-auto w-full px-4 py-2"
										onClick={handleCreateFolder}
										type="button"
										disabled={
											creating || !trimmedCurrentPath || !newFolderName.trim()
										}
									>
										{creating ? "Creating..." : "Create Folder"}
									</button>
								</div>
							</div>
						</section>
					</div>

					<div className="border-t border-slate-700/70 bg-slate-950/35 px-4 py-4 sm:px-6">
						<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
							<div className="min-w-0 flex-1 rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3">
								<p className={sectionLabelClass}>Selected Folder</p>
								<p className="mt-2 break-all font-mono text-xs leading-5 text-slate-200">
									{trimmedCurrentPath || "--"}
								</p>
							</div>
							<div className="grid gap-2 sm:grid-cols-2 lg:min-w-[300px]">
								<button
									className={`button-ghost px-4 py-2 ${footerActionClass}`}
									onClick={onClose}
									type="button"
									disabled={saving}
								>
									Cancel
								</button>
								<button
									className={`button-primary px-4 py-2 ${footerActionClass}`}
									onClick={handleSave}
									type="button"
									disabled={saving || !trimmedCurrentPath}
								>
									Use Selected Folder
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
