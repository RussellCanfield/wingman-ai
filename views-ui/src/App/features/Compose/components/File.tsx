import { FileMetadata } from "@shared/types/v2/Message";
import { AiOutlineCheckCircle, AiOutlineLoading3Quarters } from "react-icons/ai";
import { FaUndo } from "react-icons/fa";
import { GrCheckmark } from "react-icons/gr";
import { HiOutlineXMark } from "react-icons/hi2";
import { PiGitDiff } from "react-icons/pi";
import { Tooltip } from "react-tooltip";
import { vscode } from "../../../utilities/vscode";
import { DiffViewCommand, StreamEvent } from "@shared/types/v2/Composer";
import { useComposerContext } from "../../../context/composerContext";
import { AcceptFileEvent, RejectFileEvent, UndoFileEvent } from "@shared/types/Events";

const mergeIntoFile = (file: FileMetadata, threadId: string) => {
    if (file) {
        vscode.postMessage({
            command: "accept-file",
            value: {
                file,
                threadId
            } satisfies AcceptFileEvent,
        });
    }
};

const rejectFile = (file: FileMetadata, threadId: string) => {
    if (file) {
        vscode.postMessage({
            command: "reject-file",
            value: {
                file,
                threadId
            } satisfies RejectFileEvent,
        });
    }
}

const showDiffview = (file: FileMetadata, threadId: string) => {
    if (file) {
        vscode.postMessage({
            command: "diff-view",
            value: {
                file,
                threadId
            } satisfies DiffViewCommand,
        });
    }
};

const undoFile = (file: FileMetadata, threadId: string) => {
    if (file) {
        vscode.postMessage({
            command: "undo-file",
            value: {
                file,
                threadId
            } satisfies UndoFileEvent
        });
    }
}

const openFile = (file: FileMetadata) => {
    if (file) {
        vscode.postMessage({
            command: "open-file",
            value: {
                path: file.path,
                id: file.id
            } satisfies FileMetadata,
        });
    }
}

const getTruncatedPath = (path: string) => {
    const parts = path.split('/');
    const fileName = parts.pop() ?? '';
    const lastFolder = parts.pop();

    const shortPath = lastFolder
        ? `${lastFolder}/${fileName}`
        : fileName;

    return parts.length > 0
        ? `.../${shortPath}`
        : shortPath;
};

export const ChatArtifact = ({
    event,
    loading,
    isLightTheme
}: {
    event?: StreamEvent,
    loading: boolean,
    isLightTheme: boolean
}) => {
    const { activeThread } = useComposerContext();

    let file: FileMetadata = {
        path: event?.metadata?.path!,
        id: crypto.randomUUID()
    }

    const isEdit = event?.metadata?.tool === 'write_file';
    if (isEdit) {
        file = {
            ...file,
            ...JSON.parse(event?.content!)
        }
    }

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
                    <Tooltip id={`${file.path}-tooltip`} />
                    <h4
                        className="m-0 p-3 font-medium truncate cursor-pointer hover:underline transition-all text-sm group"
                        data-tooltip-id={`${file.path}-tooltip`}
                        data-tooltip-content={file.path}
                        onClick={() => openFile(file)}
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
                    {(isEdit && !file.diff) || loading && (
                        <div className="flex justify-center mr-4">
                            <AiOutlineLoading3Quarters
                                className="animate-spin text-stone-400"
                                size={24}
                            />
                        </div>
                    )}
                    {!isEdit && !loading && (
                        <div className="flex justify-center mr-4">
                            <AiOutlineCheckCircle
                                className="text-green-500"
                                size={24}
                            />
                        </div>
                    )}
                    {isEdit && !loading && !file.accepted && !file.rejected && (
                        <div className="flex flex-nowrap gap-1 ml-auto mr-4">
                            {/* Reject Button */}
                            <div className="flex items-center rounded z-10 transition-colors text-red-600 hover:bg-red-600/10 hover:shadow-lg focus:ring focus:ring-red-400">
                                <button
                                    type="button"
                                    title="Reject changes"
                                    className="p-2"
                                    onClick={() => rejectFile(file, activeThread!.id)}
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
                                    onClick={() => mergeIntoFile(file, activeThread!.id)}
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
                                    onClick={() => undoFile(file, activeThread!.id)}
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