import type { FileMetadata } from "@shared/types/Message";
import { FaUndo } from "react-icons/fa";
import { GrCheckmark } from "react-icons/gr";
import { HiOutlineXMark } from "react-icons/hi2";
import { PiGitDiff } from "react-icons/pi";
import { FaRegFileLines } from "react-icons/fa6";
import { useComposerContext } from "../../../context/composerContext";
import { acceptFile, getTruncatedPath, openFile, rejectFile, showDiffview, undoFile } from "../../../utilities/files";
import type { ToolMessage } from "@shared/types/Composer";
import { Tooltip } from 'react-tooltip'

export const WriteFileOutput = ({
    messages,
    isLightTheme
}: {
    messages: ToolMessage[],
    isLightTheme: boolean
}) => {
    const { activeThread } = useComposerContext();

    let file: FileMetadata | undefined;
    if (messages.length === 1) {
        file = messages[0].metadata?.file as unknown as FileMetadata;
    } else {
        file = messages[1].metadata?.file as unknown as FileMetadata;
    }

    if (!file) return null;

    const diffParts = file.diff?.split(',');
    const truncatedPath = getTruncatedPath(file.path);

    const cssClasses = `${isLightTheme
        ? 'bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.15)]'
        : 'bg-[#1e1e1e] shadow-[0_2px_4px_rgba(0,0,0,0.2),0_8px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_12px_24px_rgba(0,0,0,0.25)]'
        }`

    return (
        <div className={`rounded-lg overflow-hidden shadow-lg ${cssClasses}`}>
            <div className="text-[var(--vscode-input-foreground)] flex flex-col">
                <div className="flex items-center justify-start relative">
                    <FaRegFileLines size={16} className="ml-3" />
                    <Tooltip id={`${file.path}-tooltip`} place="top" />
                    <h4
                        className="m-0 p-3 font-medium truncate cursor-pointer hover:underline transition-all text-sm group"
                        data-tooltip-id={`${file.path}-tooltip`}
                        data-tooltip-content={file.path}
                        onClick={() => openFile(file)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openFile(file);
                            }
                        }}
                        style={{ flex: '0 1 auto', minWidth: '0' }}
                    >
                        {truncatedPath}
                    </h4>
                    {diffParts && (
                        <div className="flex items-center justify-evenly text-sm gap-2 mr-4">
                            <span className="flex items-center text-green-400">
                                <span>{diffParts[0]}</span>
                            </span>
                            <span className="flex items-center text-red-400">
                                <span>{diffParts[1]}</span>
                            </span>
                        </div>
                    )}
                    {!file.accepted && !file.rejected && (
                        <div className="flex flex-nowrap gap-1 ml-auto mr-3">
                            {/* Reject Button */}
                            <div className="flex items-center rounded z-10 transition-colors text-red-600 hover:bg-red-600/10 hover:shadow-lg focus:ring focus:ring-red-400">
                                <button
                                    type="button"
                                    title="Reject changes"
                                    className="p-2"
                                    onClick={() => rejectFile({ files: [file], threadId: activeThread?.id!, toolId: messages[0]?.toolCallId! })}
                                >
                                    <HiOutlineXMark size={16} />
                                </button>
                            </div>
                            {/* Show Diff Button */}
                            <div className="flex items-center rounded z-10 transition-colors hover:bg-yellow-500/10 hover:shadow-lg focus:ring focus:ring-yellow-400" style={{ color: '#ffaf38' }}>
                                <button
                                    type="button"
                                    title="Show diff"
                                    className="p-2"
                                    onClick={() => showDiffview({ file, threadId: activeThread!.id, toolId: messages[0]?.toolCallId! })}
                                >
                                    <PiGitDiff size={16} />
                                </button>
                            </div>
                            {/* Accept Button */}
                            <div className="flex items-center rounded z-10 transition-colors text-green-400 hover:bg-green-400/10 hover:shadow-lg focus:ring focus:ring-green-400">
                                <button
                                    type="button"
                                    title="Accept changes"
                                    className="p-2"
                                    onClick={() => acceptFile({ files: [file], threadId: activeThread?.id!, toolId: messages[0]?.toolCallId! })}
                                >
                                    <GrCheckmark size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                    {(file.rejected || file.accepted) && (
                        <div className="flex items-center gap-3 ml-auto mr-4">
                            {/* Undo Button */}
                            <div className="flex items-center rounded z-10 transition-colors text-stone-400 hover:bg-stone-700/50 hover:shadow-lg focus:ring focus:ring-stone-400">
                                <button
                                    type="button"
                                    title="Undo changes"
                                    className="p-2"
                                    onClick={() => undoFile({ files: [file], threadId: activeThread?.id!, toolId: messages[0]?.toolCallId! })}
                                >
                                    <FaUndo size={16} />
                                </button>
                            </div>
                            <div className="flex items-center rounded z-10 transition-colors hover:bg-yellow-500/10 hover:shadow-lg focus:ring focus:ring-yellow-400" style={{ color: '#ffaf38' }}>
                                <button
                                    type="button"
                                    title="Show diff"
                                    className="p-2"
                                    onClick={() => showDiffview({ file, threadId: activeThread!.id, toolId: messages[0]?.toolCallId! })}
                                >
                                    <PiGitDiff size={16} />
                                </button>
                            </div>
                            {file.rejected && (
                                <span className="flex items-center gap-1 text-sm text-red-400">
                                    <span>Rejected</span>
                                </span>
                            )}
                            {file.accepted && (
                                <span className="flex items-center gap-1 text-sm text-green-400">
                                    <span>Accepted</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};