import type { StreamEvent } from "@shared/types/v2/Composer";
import {
    AiOutlineLoading3Quarters,
    AiOutlineCheckCircle,
} from "react-icons/ai";

const ToolNames = {
    list_directory: "Searching workspace",
    command_execute: "Executing command",
    find_file_dependencies: "Checking File Dependencies",
};

export const ToolOutput = ({
    event,
    isLightTheme,
    loading,
}: { event: StreamEvent; isLightTheme: boolean; loading: boolean }) => {
    //@ts-expect-error
    const displayName = ToolNames[event.metadata?.tool];

    const cssClasses = `${isLightTheme
            ? "bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.15)]"
            : "bg-[#1e1e1e] shadow-[0_2px_4px_rgba(0,0,0,0.2),0_8px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_12px_24px_rgba(0,0,0,0.25)]"
        }`;

    return (
        <div
            className={`rounded-lg overflow-hidden shadow-lg mb-4 mt-4 ${cssClasses}`}
        >
            <div className="text-[var(--vscode-input-foreground)] flex flex-col">
                <div className="flex items-center justify-start relative">
                    <h4
                        className="m-0 p-3 font-medium truncate cursor-pointer hover:underline transition-all text-sm group"
                        style={{ flex: "0 1 auto", minWidth: "0" }}
                    >
                        {displayName}
                    </h4>
                    {loading ? (
                        <div className="flex justify-center mr-4">
                            <AiOutlineLoading3Quarters
                                className="animate-spin text-stone-400"
                                size={24}
                            />
                        </div>
                    ) : (
                        <div className="flex justify-center mr-4">
                            <AiOutlineCheckCircle className="text-green-500" size={24} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
