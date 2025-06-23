import { useState, useMemo, useCallback, memo } from "react";
import {
    AiOutlineLoading3Quarters,
    AiOutlineCheckCircle,
    AiOutlineCloseCircle
} from "react-icons/ai";
import { BsTools } from "react-icons/bs";
import { FaPlay, FaTimes, FaChevronDown, FaChevronRight } from "react-icons/fa";
import type { CommandMetadata } from "@shared/types/Message";
import { vscode } from "../../../utilities/vscode";
import { useComposerContext } from "../../../context/composerContext";
import type { UpdateCommandEvent } from "@shared/types/Events";
import type { ToolMessage } from "@shared/types/Composer";

interface CommandExecuteOutputProps {
    messages: ToolMessage[];
    isLightTheme: boolean;
    onAccept?: (command: string) => void;
    onReject?: (command: string) => void;
}

export const CommandExecuteOutput = memo(({
    messages,
    isLightTheme,
}: CommandExecuteOutputProps) => {
    const { activeThread } = useComposerContext();
    const [isResultExpanded, setIsResultExpanded] = useState(false);

    if (!messages) return null;

    // Memoize the command extraction logic
    const command = useMemo(() => {
        let extractedCommand: CommandMetadata | undefined;

        if (messages.length === 1) {
            if ((messages[0].content as Record<string, unknown>).accepted) {
                extractedCommand = {
                    id: messages[0].id,
                    //@ts-expect-error
                    ...(messages[0].content as Record<string, unknown>) as CommandMetadata
                }
            } else {
                extractedCommand = {
                    id: messages[0].id,
                    command: String((messages[0].content as Record<string, unknown>).command)
                };
            }
        } else {
            extractedCommand = messages[messages.length - 1].metadata?.command as unknown as CommandMetadata;
        }

        return extractedCommand;
    }, [messages]);

    // Memoize handlers to prevent recreation on each render
    const handleAccept = useCallback(() => {
        vscode.postMessage({
            command: "accept-command",
            value: {
                command,
                threadId: activeThread?.id!
            } satisfies UpdateCommandEvent
        });
    }, [command, activeThread?.id]);

    const handleReject = useCallback(() => {
        vscode.postMessage({
            command: "reject-command",
            value: {
                command,
                threadId: activeThread?.id!
            } satisfies UpdateCommandEvent
        });
    }, [command, activeThread?.id]);

    const toggleResultExpansion = useCallback(() => {
        setIsResultExpanded(prev => !prev);
    }, []);

    // Memoize UI-related values
    const cssClasses = useMemo(() => 
        `${isLightTheme
            ? "bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.15)]"
            : "bg-[#1e1e1e] shadow-[0_2px_4px_rgba(0,0,0,0.2),0_8px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_12px_24px_rgba(0,0,0,0.25)]"
        }`
    , [isLightTheme]);

    const buttonStyles = useMemo(() => {
        const buttonBaseClasses = "flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-all";
        return {
            accept: `${buttonBaseClasses} bg-green-600 text-white hover:bg-green-700 active:bg-green-800`,
            reject: `${buttonBaseClasses} bg-red-600 text-white hover:bg-red-700 active:bg-red-800`
        };
    }, []);

    // Memoize derived state
    const { 
        commandLoading, 
        shouldShowButtons,
        resultSectionClasses,
        resultContentClasses
    } = useMemo(() => {
        const isLoading = command?.accepted && command.success === undefined && command.result === undefined;
        const showButtons = !command?.accepted && !command?.rejected && !command?.success && !command?.failed;
        
        const sectionClasses = `px-4 pb-4 pt-0 ${isLightTheme ? 'bg-gray-50' : 'bg-[#252525]'} border-t ${isLightTheme ? 'border-gray-200' : 'border-gray-700'}`;
        const contentClasses = `mt-2 p-3 rounded font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[400px] ${isLightTheme ? 'bg-gray-100 text-gray-800' : 'bg-[#1a1a1a] text-gray-300'}`;
        
        return { 
            commandLoading: isLoading, 
            shouldShowButtons: showButtons,
            resultSectionClasses: sectionClasses,
            resultContentClasses: contentClasses
        };
    }, [command, isLightTheme]);

    if (!command) return null;

    return (
        <div
            className={`rounded-lg overflow-hidden shadow-lg ${cssClasses}`}
        >
            <div className="text-[var(--vscode-input-foreground)] flex flex-col">
                <div className="flex items-center justify-between relative p-3">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <BsTools className="text-gray-400/50 flex-shrink-0" size={20} />
                        <div className="overflow-x-auto max-w-full" style={{ scrollbarWidth: 'thin' }}>
                            <h4 className="m-0 text-base whitespace-nowrap text-gray-400/50 flex items-center gap-2">
                                {command.result && (
                                    <button
                                        type="button"
                                        onClick={toggleResultExpansion}
                                        className="text-gray-400/70 hover:text-gray-400 transition-colors"
                                        aria-label={isResultExpanded ? "Collapse result" : "Expand result"}
                                    >
                                        {isResultExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                                    </button>
                                )}
                                <span>
                                    {command?.accepted ? "Executed" : "Execute"}: {command.command}
                                </span>
                            </h4>
                        </div>
                    </div>
                    <div className="flex items-center ml-3">
                        {(command.success || command.failed) && (
                            <span className={`ml-2 mr-1 flex items-center ${command.success ? "text-green-500" : "text-red-500"}`}>
                                {command.success ? (
                                    <AiOutlineCheckCircle className="text-gray-400/50" size={20} />
                                ) : (
                                    <AiOutlineCloseCircle className="text-gray-400/50" size={20} />
                                )}
                            </span>
                        )}
                        {commandLoading ? (
                            <div className="flex justify-center">
                                <AiOutlineLoading3Quarters
                                    className="animate-spin text-stone-400"
                                    size={20}
                                />
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Collapsible result section */}
                {command.result && isResultExpanded && (
                    <div className={resultSectionClasses}>
                        <div className={resultContentClasses} style={{ scrollbarWidth: 'thin' }}>
                            {command.result}
                        </div>
                    </div>
                )}

                {/* Action buttons moved underneath */}
                {shouldShowButtons && (
                    <div className={resultSectionClasses}>
                        <div className="py-3 flex justify-end gap-2">
                            <button
                                type="button"
                                className={buttonStyles.reject}
                                onClick={handleReject}
                                disabled={command.accepted || command.rejected}
                            >
                                <FaTimes size={12} />
                                Reject
                            </button>
                            <button
                                type="button"
                                className={buttonStyles.accept}
                                onClick={handleAccept}
                                disabled={command.rejected || command.accepted}
                            >
                                <FaPlay size={12} />
                                Run
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

// Display name for debugging
CommandExecuteOutput.displayName = 'CommandExecuteOutput';