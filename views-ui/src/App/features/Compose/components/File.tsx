import { FileMetadata } from "@shared/types/v2/Message";
import { AiOutlineCheckCircle, AiOutlineLoading3Quarters } from "react-icons/ai";
import { FaUndo } from "react-icons/fa";
import { GrCheckmark } from "react-icons/gr";
import { HiOutlineXMark } from "react-icons/hi2";
import { PiGitDiff } from "react-icons/pi";
import { Tooltip } from "react-tooltip";
import { vscode } from "../../../utilities/vscode";
import { DiffViewCommand, StreamEvent } from "@shared/types/v2/Composer";

const mergeIntoFile = (file: FileMetadata) => {
    if (file) {
        vscode.postMessage({
            command: "accept-file",
            value: file,
        });
    }
};

const rejectFile = (file: FileMetadata) => {
    if (file) {
        vscode.postMessage({
            command: "reject-file",
            value: file,
        });
    }
}

const showDiffview = (file: FileMetadata) => {
    if (file) {
        vscode.postMessage({
            command: "diff-view",
            value: {
                file
            } satisfies DiffViewCommand,
        });
    }
};

const undoFile = (file: FileMetadata) => {
    if (file) {
        vscode.postMessage({
            command: "undo-file",
            value: file
        });
    }
}

const openFile = (file: FileMetadata) => {
    if (file) {
        vscode.postMessage({
            command: "open-file",
            value: {
                path: file.path,
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
    loading
}: {
    event?: StreamEvent,
    loading: boolean,
}) => {
    let file: FileMetadata = {
        path: event?.metadata?.path!
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

    return (
        <div className="border border-stone-700/50 rounded-lg overflow-hidden shadow-lg mb-4 mt-4 bg-stone-800">
            <div className="text-white flex flex-col border-b border-stone-700/50">
                <div className="flex items-center justify-start border-b border-stone-700/50 relative">
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
                                    onClick={() => rejectFile(file)}
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
                                    onClick={() => showDiffview(file)}
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
                                    onClick={() => mergeIntoFile(file)}
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
                                    onClick={() => undoFile(file)}
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