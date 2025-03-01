import type { StreamEvent } from "@shared/types/v2/Composer";
import { useMemo } from "react";
import {
    AiOutlineLoading3Quarters,
    AiOutlineCheckCircle,
} from "react-icons/ai";
import { getTruncatedPath, openFile } from "../../../utilities/files";

const ToolNames = {
    list_directory: "Searched: ",
    command_execute: "Executed: ",
    find_file_dependencies: "Checked Dependencies",
    read_file: "Analyzed: "
};

export const ToolOutput = ({
    event,
    isLightTheme,
    loading,
}: { event: StreamEvent; isLightTheme: boolean; loading: boolean }) => {
    //@ts-expect-error
    const displayName = ToolNames[event.metadata?.tool] ?? event.metadata.tool;

    const ToolDetails = useMemo(() => {
        if (!event.content) return null;

        try {
            const parsedContent = JSON.parse(event.content);

            if (event.metadata?.tool === 'command_execute' && parsedContent.command) {
                return parsedContent.command;
            }

            if (event.metadata?.tool === "list_directory") {
                return parsedContent.directory;
            }

            if (event.metadata?.tool === "read_file") {
                return <span
                    className="cursor-pointer hover:underline transition-all"
                    onClick={() => openFile({
                        path: parsedContent.filePath
                    })}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openFile({
                                path: parsedContent.filePath
                            });
                        }
                    }}>{getTruncatedPath(parsedContent.filePath)}</span>
            }
        } catch (error) {
            console.error("Failed to parse tool content:", error);
        }

        return null;
    }, [event]);

    const cssClasses = `${isLightTheme
        ? "bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.15)]"
        : "bg-[#1e1e1e] shadow-[0_2px_4px_rgba(0,0,0,0.2),0_8px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_12px_24px_rgba(0,0,0,0.25)]"
        }`;

    return (
        <div
            className={`rounded-lg overflow-hidden shadow-lg mb-4 mt-4 ${cssClasses}`}
        >
            <div className="text-[var(--vscode-input-foreground)] flex flex-col">
                <div className="flex items-center justify-between relative p-3">
                    <h4
                        className="m-0 text-base truncate"
                        style={{ flex: "0 1 auto", minWidth: "0" }}
                    >
                        {displayName} {ToolDetails}
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
            </div>
        </div>
    );
};