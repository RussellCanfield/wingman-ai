import type { FileMetadata } from "@shared/types/v2/Message";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { FaUndo } from "react-icons/fa";
import { GrCheckmark } from "react-icons/gr";
import { HiOutlineXMark } from "react-icons/hi2";
import { PiGitDiff } from "react-icons/pi";
import { Tooltip } from "react-tooltip";
import { useComposerContext } from "../../../context/composerContext";
import { acceptFile, getTruncatedPath, openFile, rejectFile, showDiffview, undoFile } from "../../../utilities/files";

export const ChatArtifact = ({
    file,
    loading,
    isLightTheme
}: {
    file?: FileMetadata,
    loading: boolean,
    isLightTheme: boolean
}) => {
    const { activeThread } = useComposerContext();

    if (!file) return null;

    const diffParts = file.diff?.split(',');
    const truncatedPath = getTruncatedPath(file.path);

    const cssClasses = `${isLightTheme
        ? 'bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.15)]'
        : 'bg-[#1e1e1e] shadow-[0_2px_4px_rgba(0,0,0,0.2),0_8px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_12px_24px_rgba(0,0,0,0.25)]'
        }`

    return (
        <div className={`rounded-lg overflow-hidden shadow-lg mb-4 mt-4 ${cssClasses}`}>
            <div className="text-[var(--vscode-input-foreground)] flex flex-col">
                <div className="flex items-center justify-start relative">
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
                    {!file.diff || loading && (
                        <div className="flex justify-center mr-4">
                            <AiOutlineLoading3Quarters
                                className="animate-spin text-stone-400"
                                size={24}
                            />
                        </div>
                    )}
                    {!loading && !file.accepted && !file.rejected && (
                        <div className="flex flex-nowrap gap-1 ml-auto mr-4">
                            {/* Reject Button */}
                            <div className="flex items-center rounded z-10 transition-colors text-red-600 hover:bg-red-600/10 hover:shadow-lg focus:ring focus:ring-red-400">
                                <button
                                    type="button"
                                    title="Reject changes"
                                    className="p-2"
                                    onClick={() => rejectFile({ files: [file], threadId: activeThread?.id! })}
                                >
                                    <HiOutlineXMark size={18} />
                                </button>
                            </div>
                            {/* Show Diff Button */}
                            <div className="flex items-center rounded z-10 transition-colors hover:bg-yellow-500/10 hover:shadow-lg focus:ring focus:ring-yellow-400" style={{ color: '#ffaf38' }}>
                                <button
                                    type="button"
                                    title="Show diff"
                                    className="p-2"
                                    onClick={() => showDiffview(file, activeThread!.id)}
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
                                    onClick={() => acceptFile({ files: [file], threadId: activeThread?.id! })}
                                >
                                    <GrCheckmark size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                    {(file.rejected || file.accepted) && (
                        <div className="flex items-center gap-3 ml-auto mr-4">
                            {/* Undo Button */}
                            <div className="flex items-center rounded z-10 transition-colors text-stone-400 hover:bg-stone-800/10 hover:shadow-lg focus:ring focus:ring-stone-400">
                                <button
                                    type="button"
                                    title="Undo changes"
                                    className="p-2"
                                    onClick={() => undoFile({ files: [file], threadId: activeThread?.id! })}
                                >
                                    <FaUndo size={14} />
                                </button>
                            </div>
                            {file.rejected && (
                                <span className="flex items-center gap-1 text-base text-red-400">
                                    <span>Rejected</span>
                                </span>
                            )}
                            {file.accepted && (
                                <span className="flex items-center gap-1 text-base text-green-400">
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