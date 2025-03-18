import { useState } from "react";
import { VscFile, VscFolderOpened, VscChevronDown, VscChevronRight, VscRefresh } from "react-icons/vsc";
import { vscode } from "./utilities/vscode";

export type IndexedFilesProgressProps = {
  indexedFiles?: string[];
};

export const IndexedFilesProgress = ({ indexedFiles = [] }: IndexedFilesProgressProps) => {
  const [expanded, setExpanded] = useState(false);
  const [expandedDirectories, setExpandedDirectories] = useState<Record<string, boolean>>({});
  const [isResyncing, setIsResyncing] = useState(false);

  // Group files by directory for better visualization
  const groupedFiles = indexedFiles.reduce<Record<string, string[]>>((acc, file) => {
    const parts = file.split("/");
    const directory = parts.slice(0, -1).join("/") || "/";

    if (!acc[directory]) {
      acc[directory] = [];
    }

    acc[directory].push(file);
    return acc;
  }, {});

  // Get unique directories
  const directories = Object.keys(groupedFiles).sort();

  // Calculate total files
  const totalFiles = indexedFiles.length;

  const toggleDirectory = (directory: string) => {
    setExpandedDirectories(prev => ({
      ...prev,
      [directory]: !prev[directory]
    }));
  };

  const handleResync = () => {
    setIsResyncing(true);
    vscode.postMessage({
      command: "resync"
    });

    // Reset resyncing state after a delay (simulating completion)
    setTimeout(() => {
      setIsResyncing(false);
    }, 2000);
  };

  return (
    <div className="w-full">
      <div className="flex flex-col mb-3">
        <div className="flex justify-between items-center mb-2 gap-2 flex-col">
          <div className="flex items-center gap-2 w-full">
            <h3 className="text-sm font-medium text-[var(--vscode-foreground)]">
              Indexed Files
            </h3>
            <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
              {totalFiles}
            </span>
          </div>

          {/* Action buttons in a separate row for better spacing */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleResync}
              disabled={isResyncing}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md 
                ${isResyncing
                  ? "bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]"
                  : "bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                } 
                focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)] transition-colors duration-150`}
              title="Resync Index"
            >
              <VscRefresh className={isResyncing ? "animate-spin" : ""} size={14} />
              {isResyncing ? "Resyncing..." : "Resync Index"}
            </button>

            {totalFiles > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-[var(--vscode-textLink-foreground)] hover:text-[var(--vscode-textLink-activeForeground)] flex items-center text-xs px-2 py-1 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)] transition-colors duration-150"
              >
                {expanded ? (
                  <>
                    <VscChevronDown className="mr-1.5" /> Collapse
                  </>
                ) : (
                  <>
                    <VscChevronRight className="mr-1.5" /> Expand
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-[var(--vscode-progressBar-background)] rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${isResyncing ? 'animate-pulse' : ''} bg-[var(--vscode-progressBar-foreground)] transition-all duration-500 ease-in-out`}
          style={{ width: totalFiles > 0 || isResyncing ? "100%" : "0%" }}
        />
      </div>

      {/* Status message */}
      <div className="text-xs text-[var(--vscode-descriptionForeground)] mb-3">
        {isResyncing ? (
          <span>Resyncing files...</span>
        ) : totalFiles === 0 ? (
          <span>No files indexed yet.</span>
        ) : (
          <span>{totalFiles} files indexed</span>
        )}
      </div>

      {/* File list or empty state */}
      {expanded && totalFiles > 0 && (
        <div className="mt-2 border border-[var(--vscode-editorWidget-border)] rounded-md overflow-hidden shadow-sm">
          <div
            className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--vscode-scrollbarSlider-background)] scrollbar-track-transparent hover:scrollbar-thumb-[var(--vscode-scrollbarSlider-hoverBackground)]"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--vscode-scrollbarSlider-background) transparent'
            }}
          >
            {directories.map((directory) => (
              <div key={directory} className="border-b border-[var(--vscode-editorWidget-border)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleDirectory(directory)}
                  className="w-full text-left flex items-center gap-2 p-2 bg-[var(--vscode-editorWidget-background)] hover:bg-[var(--vscode-list-hoverBackground)]"
                >
                  {expandedDirectories[directory] ? (
                    <VscChevronDown className="text-[var(--vscode-foreground)] flex-shrink-0" />
                  ) : (
                    <VscChevronRight className="text-[var(--vscode-foreground)] flex-shrink-0" />
                  )}
                  <VscFolderOpened className="text-[var(--vscode-terminal-ansiYellow)] flex-shrink-0" />
                  <span className="text-xs font-medium truncate">{directory}</span>
                  <span className="text-xs text-[var(--vscode-descriptionForeground)] ml-auto">
                    ({groupedFiles[directory].length})
                  </span>
                </button>
                {expandedDirectories[directory] && (
                  <div className="pl-6">
                    {groupedFiles[directory].map((file) => (
                      <div
                        key={file}
                        className="flex items-center gap-2 p-1.5 hover:bg-[var(--vscode-list-hoverBackground)]"
                        title={file}
                      >
                        <VscFile className="text-[var(--vscode-terminal-ansiBlue)] flex-shrink-0" />
                        <span className="text-xs truncate">
                          {file.split("/").pop()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state - only shown when expanded and no files */}
      {expanded && totalFiles === 0 && !isResyncing && (
        <div className="flex flex-col items-center justify-center p-6 border border-dashed border-[var(--vscode-editorWidget-border)] rounded-md">
          <VscFile size={24} className="text-[var(--vscode-descriptionForeground)] mb-2" />
          <p className="text-sm text-[var(--vscode-descriptionForeground)]">
            No files have been indexed yet
          </p>
        </div>
      )}
    </div>
  );
};