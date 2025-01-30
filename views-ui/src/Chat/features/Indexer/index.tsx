import { vscode } from "../../utilities/vscode";
import { useEffect } from "react";
import { Loader } from "../../Loader";
import { IndexerSettings } from "@shared/types/Indexer";
import { useSettingsContext } from "../../context/settingsContext";
import { FiTrash2 } from 'react-icons/fi';

let interval: NodeJS.Timeout;

export default function Indexer() {
	const { indexFilter, exclusionFilter, setIndexFilter, totalFileCount, indexStats, setIndex } =
		useSettingsContext();

	useEffect(() => {
		vscode.postMessage({
			command: "check-index",
		});
		interval = setInterval(() => {
			vscode.postMessage({
				command: "check-index",
			});
		}, 3000);

		return () => {
			clearInterval(interval);
		};
	}, []);

	const buildIndex = () => {
		vscode.postMessage({
			command: "build-index",
			value: {
				indexFilter,
				exclusionFilter,
			} satisfies IndexerSettings,
		});
		setIndex((idx) => ({ ...idx, processing: true }));
	};

	const deleteIndex = () => {
		vscode.postMessage({
			command: "delete-index",
		});
	};

	const deleteFileFromIndex = (filePath: string) => {
		vscode.postMessage({
			command: "delete-indexed-file",
			value: filePath,
		});
	};

	return (
		<div className="flex flex-col h-full overflow-hidden text-[var(--vscode-input-foreground)]">
			<div className="flex-1 overflow-y-auto p-6">
				<div className="flex flex-col gap-8">
					{/* Indexer Status */}
					<div className="space-y-6 bg-[var(--vscode-input-background)] p-6 rounded-lg shadow-md">
						<p className="text-2xl font-semibold text-blue-400">
							Status:{" "}
							<span className="text-[var(--vscode-input-foreground)]">
								{indexStats.exists
									? indexStats.processing
										? "Processing..."
										: "Ready"
									: "Not Found"}
							</span>
						</p>
						<p className="text-sm leading-relaxed">
							The indexer processes your codebase to use as context in chat or the composer.
							It scans your workspace for files that match the inclusion filter below. By default,
							`.gitignore` is used as an exclusion filter.
						</p>
						<p className="text-sm leading-relaxed">
							You can disable the indexer in settings. When enabled, files are re-indexed on save
							if their contents have changed.
						</p>

						{/* Inclusion Filter with Examples */}
						<section className="flex flex-col gap-4">
							<label className="text-sm font-medium">Inclusion Filter:</label>
							<input
								type="text"
								className="w-full p-3 border bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								value={indexFilter || ""}
								onChange={(e) => setIndexFilter(e.target.value)}
								placeholder="Enter file patterns..."
							/>
							<div className="text-xs text-[var(--vscode-descriptionForeground)]">
								<p>Example patterns:</p>
								<ul className="list-disc pl-5 space-y-1">
									<li>**/*.{'{ts,tsx,js,jsx}'} - All TypeScript and JavaScript files</li>
									<li>src/**/*.ts - All TypeScript files in the `src` directory</li>
									<li>**/*.{'{py,go}'} - All Python and Go files</li>
									<li>{'{src,lib}/**/*.ts'} - TypeScript files in `src` or `lib` directories</li>
								</ul>
							</div>
							{!indexStats.processing && (
								<button
									className="bg-blue-500 text-white px-5 py-2 rounded-md shadow transition-all duration-300 hover:bg-blue-600 disabled:opacity-50"
									disabled={indexStats.processing || !indexFilter}
									onClick={() => buildIndex()}
								>
									Build Index
								</button>
							)}
						</section>
					</div>

					{!indexStats.processing && (
						<button
							className="bg-red-500 text-white px-5 py-2 rounded-md shadow transition-all duration-300 hover:bg-red-600"
							onClick={() => deleteIndex()}
						>
							Delete Index
						</button>
					)}

					{/* Indexed Files Section */}
					{indexStats.exists && (
						<div className="flex flex-col gap-6 bg-[var(--vscode-input-background)] p-6 rounded-lg shadow-md">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-semibold">Indexed Files</h3>
								<span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
									{indexStats.files.length} / {totalFileCount}
								</span>
							</div>
							<div className="w-full bg-stone-400 rounded-full h-2.5">
								<div
									className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
									style={{
										width: `${(indexStats.files.length / (totalFileCount === 0 ? 1 : totalFileCount)) * 100}%`,
									}}
								/>
							</div>
							{/* View All Files - Expandable */}
							<details className="group">
								<summary className="cursor-pointer list-none">
									<div className="flex items-center gap-2 text-sm text-[var(--vscode-input-foreground)]">
										<svg
											className="w-4 h-4 transition-transform group-open:rotate-90"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9 5l7 7-7 7"
											/>
										</svg>
										View all files
									</div>
								</summary>
								<div className="mt-2 pl-6">
									<ul className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
										{indexStats.files.map((file, idx) => (
											<li
												key={idx}
												className="text-sm text-[var(--vscode-input-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] rounded flex items-center justify-between px-2 py-1"
											>
												<span className="truncate">{file}</span>
												<button
													className="p-1 rounded hover:bg-stone-400"
													onClick={(e) => {
														e.stopPropagation();
														deleteFileFromIndex(file);
													}}
													title="Remove file from index"
												>
													<FiTrash2 className="w-4 h-4 text-red-600" />
												</button>
											</li>
										))}
									</ul>
								</div>
							</details>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
