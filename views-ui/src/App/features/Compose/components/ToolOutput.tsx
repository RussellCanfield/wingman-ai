import type { ToolMessage } from "@shared/types/Composer";
import { useMemo } from "react";
import {
    AiOutlineLoading3Quarters,
    AiOutlineCheckCircle,
    AiOutlineCloseCircle,
} from "react-icons/ai";
import { BsTools } from "react-icons/bs";
import { getTruncatedPath, openFile } from "../../../utilities/files";

const ToolNames = {
    list_directory: "Searched: ",
    find_file_dependencies: "Checked Dependencies",
    read_file: "Analyzed: ",
    research: "Researching...",
    semantic_search: "Semantic search..."
};

export interface ToolOutputProps {
    messages: ToolMessage[];
    isLightTheme: boolean;
    loading: boolean;
}

export const ToolOutput = ({
    messages,
    isLightTheme,
    loading
}: ToolOutputProps) => {
    //@ts-expect-error
    const displayName = ToolNames[messages[0].name] ?? messages[0].name;
    const toolIsLoading = messages.length === 1;

    const ToolDetails = useMemo(() => {
        if (!messages) return null;

        try {
            const toolName = messages[0].name;

            if (toolName === "list_directory") {
                let content = messages[0].content;
                content = typeof (content) === "string" ? JSON.parse(content) : content;
                //@ts-expect-error
                return content.directory;
            }

            if (toolName === "read_file") {
                let content = toolIsLoading ? messages[0].content : JSON.parse(String(messages[1].content));
                content = typeof (content) === "string" ? JSON.parse(content) : content;
                return <span
                    className="cursor-pointer hover:underline transition-all"
                    onClick={() => openFile({
                        path: content.path
                    })}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openFile({
                                path: content.path
                            });
                        }
                    }}>{getTruncatedPath(content.path)}</span>
            }
        } catch (error) {
            console.error("Failed to parse tool content:", error);
        }

        return null;
    }, [messages, messages[0].name, messages[0].content, toolIsLoading]);

    const cssClasses = `${isLightTheme
        ? "bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.15)]"
        : "bg-[#1e1e1e] shadow-[0_2px_4px_rgba(0,0,0,0.2),0_8px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_12px_24px_rgba(0,0,0,0.25)]"
        }`;

    return (
        <div
            className={`rounded-lg overflow-hidden shadow-lg ${cssClasses}`}
        >
            <div className="text-[var(--vscode-input-foreground)] flex flex-col">
                <div className="flex items-center justify-between relative p-3">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <BsTools className="text-gray-400/50 flex-shrink-0" size={20} />
                        <div className="overflow-x-auto max-w-full" style={{ scrollbarWidth: 'thin' }}>
                            <h4 className="m-0 text-base whitespace-nowrap text-gray-400/50">
                                {displayName} {ToolDetails}
                            </h4>
                        </div>
                    </div>

                    <div className="flex items-center ml-3 flex-shrink-0">
                        {toolIsLoading && loading && (
                            <div className="flex justify-center">
                                <AiOutlineLoading3Quarters
                                    className="animate-spin text-stone-400"
                                    size={20}
                                />
                            </div>
                        )}
                        {toolIsLoading && !loading && (
                            <div className="flex justify-center">
                                <AiOutlineCloseCircle className="text-gray-400/50" size={20} />
                            </div>
                        )}
                        {!toolIsLoading && (
                            <div className="flex justify-center">
                                <AiOutlineCheckCircle className="text-gray-400/50" size={20} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};