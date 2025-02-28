import type { StreamEvent } from "@shared/types/v2/Composer";
import { useMemo } from "react";
import {
    AiOutlineLoading3Quarters,
    AiOutlineCheckCircle,
} from "react-icons/ai";

const ToolNames = {
    list_directory: "Searching workspace",
    command_execute: "Executing command",
    find_file_dependencies: "Checking File Dependencies",
    read_file: "Read File"
};

export const ToolOutput = ({
    event,
    isLightTheme,
    loading,
}: { event: StreamEvent; isLightTheme: boolean; loading: boolean }) => {
    //@ts-expect-error
    const displayName = ToolNames[event.metadata?.tool];

    const ToolDetails = useMemo(() => {
        if (!event.content) return null;

        try {
            const parsedContent = JSON.parse(event.content);

            if (event.metadata?.tool === 'command_execute' && parsedContent.command) {
                return (
                    <div className="rounded overflow-hidden border border-[var(--vscode-panel-border)] mb-2">
                        <div className={`px-3 py-2 ${isLightTheme
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-[#252526] text-[var(--vscode-foreground)]'}`}>
                            <div className="flex items-center">
                                <span className="font-medium text-sm whitespace-nowrap">Command:</span>
                                <div className="ml-2 overflow-x-auto max-w-full">
                                    <code className="text-sm font-mono whitespace-pre">{parsedContent.command}</code>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            if (event.metadata?.tool === "list_directory") {
                return (
                    <div className="rounded overflow-hidden border border-[var(--vscode-panel-border)] mb-2">
                        <div className={`px-3 py-2 ${isLightTheme
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-[#252526] text-[var(--vscode-foreground)]'}`}>
                            <div className="flex items-center">
                                <span className="font-medium text-sm whitespace-nowrap">Path:</span>
                                <div className="ml-2 overflow-x-auto max-w-full">
                                    <code className="text-sm font-mono whitespace-pre">{parsedContent.directory}</code>
                                </div>
                            </div>
                            {parsedContent.depth && (
                                <div className="flex items-center mt-1">
                                    <span className="font-medium text-sm whitespace-nowrap">Depth:</span>
                                    <span className="ml-2 text-sm">{parsedContent.depth}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            if (event.metadata?.tool === "read_file") {
                return (
                    <div className="rounded overflow-hidden border border-[var(--vscode-panel-border)] mb-2">
                        <div className={`px-3 py-2 ${isLightTheme
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-[#252526] text-[var(--vscode-foreground)]'}`}>
                            <div className="flex items-center">
                                <div className="ml-2 overflow-x-auto max-w-full">
                                    <code className="text-sm font-mono whitespace-pre">{parsedContent.filePath}</code>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
        } catch (error) {
            console.error("Failed to parse tool content:", error);
        }

        return null;
    }, [event, isLightTheme]);

    const cssClasses = `${isLightTheme
        ? "bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.15)]"
        : "bg-[#1e1e1e] shadow-[0_2px_4px_rgba(0,0,0,0.2),0_8px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_12px_24px_rgba(0,0,0,0.25)]"
        }`;

    const hasToolDetails = !!ToolDetails;

    return (
        <div
            className={`rounded-lg overflow-hidden shadow-lg mb-4 mt-4 ${cssClasses}`}
        >
            <div className="text-[var(--vscode-input-foreground)] flex flex-col">
                <div className="flex items-center justify-between relative p-3">
                    <h4
                        className="m-0 font-medium truncate text-sm"
                        style={{ flex: "0 1 auto", minWidth: "0" }}
                    >
                        {displayName}
                    </h4>

                    <div className="flex items-center ml-3">
                        {loading ? (
                            <div className="flex justify-center">
                                <AiOutlineLoading3Quarters
                                    className="animate-spin text-stone-400"
                                    size={20}
                                />
                            </div>
                        ) : (
                            <div className="flex justify-center">
                                <AiOutlineCheckCircle className="text-green-500" size={20} />
                            </div>
                        )}
                    </div>
                </div>

                {hasToolDetails && (
                    <div className="px-3 pb-3">
                        {ToolDetails}
                    </div>
                )}
            </div>
        </div>
    );
};