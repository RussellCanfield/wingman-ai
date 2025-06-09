import type { FileMetadata } from "@shared/types/Message";
import { FaUndo } from "react-icons/fa";
import { GrCheckmark } from "react-icons/gr";
import { HiOutlineXMark } from "react-icons/hi2";
import { PiGitDiff } from "react-icons/pi";
import { FaRegFileLines } from "react-icons/fa6";
import { useComposerContext } from "../../../context/composerContext";
import { acceptFile, getTruncatedPath, openFile, rejectFile, showDiffview, undoFile } from "../../../utilities/files";
import type { ToolMessage } from "@shared/types/Composer";
import { Tooltip } from 'react-tooltip';
import { memo, useCallback, useMemo } from 'react';

// File actions button component
const FileActionButton = memo(({
    icon: Icon,
    title,
    onClick,
    className,
    style
}: {
    icon: React.ComponentType<{ size: number }>,
    title: string,
    onClick: () => void,
    className: string,
    style?: React.CSSProperties
}) => (
    <div className={`flex items-center rounded z-10 transition-colors ${className}`} style={{ ...style ?? {} }}>
        <button
            type="button"
            title={title}
            className="p-2"
            onClick={onClick}
        >
            <Icon size={16} />
        </button>
    </div>
));

// Diff stats component
const DiffStats = memo(({ diffParts }: { diffParts: string[] }) => (
    <div className="flex items-center justify-evenly text-sm gap-2 mr-4">
        <span className="flex items-center text-green-400">
            <span>{diffParts[0]}</span>
        </span>
        <span className="flex items-center text-red-400">
            <span>{diffParts[1]}</span>
        </span>
    </div>
));

// File action buttons for pending state
const PendingActions = memo(({
    file,
    threadId,
    toolId
}: {
    file: FileMetadata,
    threadId: string,
    toolId: string
}) => {
    const handleReject = useCallback(() => {
        rejectFile({ files: [file], threadId, toolId });
    }, [file, threadId, toolId]);

    const handleShowDiff = useCallback(() => {
        showDiffview({ file, threadId, toolId });
    }, [file, threadId, toolId]);

    const handleAccept = useCallback(() => {
        acceptFile({ files: [file], threadId, toolId });
    }, [file, threadId, toolId]);

    return (
        <div className="flex flex-nowrap gap-1 ml-auto mr-3">
            <FileActionButton
                icon={HiOutlineXMark}
                title="Reject changes"
                onClick={handleReject}
                className="text-red-600 hover:bg-red-600/10 hover:shadow-lg focus:ring focus:ring-red-400"
            />
            <FileActionButton
                icon={PiGitDiff}
                title="Show diff"
                onClick={handleShowDiff}
                className="hover:bg-yellow-500/10 hover:shadow-lg focus:ring focus:ring-yellow-400"
                style={{ color: '#ffaf38' }}
            />
            <FileActionButton
                icon={GrCheckmark}
                title="Accept changes"
                onClick={handleAccept}
                className="text-green-400 hover:bg-green-400/10 hover:shadow-lg focus:ring focus:ring-green-400"
            />
        </div>
    );
});

// File action buttons for accepted/rejected state
const CompletedActions = memo(({
    file,
    threadId,
    toolId
}: {
    file: FileMetadata,
    threadId: string,
    toolId: string
}) => {
    const handleUndo = useCallback(() => {
        undoFile({ files: [file], threadId, toolId });
    }, [file, threadId, toolId]);

    const handleShowDiff = useCallback(() => {
        showDiffview({ file, threadId, toolId });
    }, [file, threadId, toolId]);

    return (
        <div className="flex items-center gap-2 ml-auto mr-4">
            <FileActionButton
                icon={FaUndo}
                title="Undo changes"
                onClick={handleUndo}
                className="text-stone-400 hover:bg-stone-700/50 hover:shadow-lg focus:ring focus:ring-stone-400"
            />
            <FileActionButton
                icon={PiGitDiff}
                title="Show diff"
                onClick={handleShowDiff}
                className="hover:bg-yellow-500/10 hover:shadow-lg focus:ring focus:ring-yellow-400"
                style={{ color: '#ffaf38' }}
            />
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
    );
});

export const WriteFileOutput = memo(({
    messages,
    isLightTheme
}: {
    messages: ToolMessage[],
    isLightTheme: boolean
}) => {
    const { activeThread } = useComposerContext();

    const file = useMemo(() => {
        if (messages.length === 0) return undefined;
        return messages.length === 1
            ? messages[0].metadata?.file as unknown as FileMetadata
            : messages[1].metadata?.file as unknown as FileMetadata;
    }, [messages]);

    const toolId = useMemo(() => {
        return messages[0]?.toolCallId || '';
    }, [messages]);

    const diffParts = useMemo(() => {
        return file?.diff?.split(',');
    }, [file?.diff]);

    const truncatedPath = useMemo(() => {
        return file ? getTruncatedPath(file.path) : '';
    }, [file]);

    const handleOpenFile = useCallback(() => {
        if (file) {
            openFile(file);
        }
    }, [file]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (file && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            openFile(file);
        }
    }, [file]);

    if (!file || !activeThread) {
        return null;
    }

    const cssClasses = `${isLightTheme
        ? 'bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.15)]'
        : 'bg-[#1e1e1e] shadow-[0_2px_4px_rgba(0,0,0,0.2),0_8px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_12px_24px_rgba(0,0,0,0.25)]'
        }`;

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
                        onClick={handleOpenFile}
                        onKeyDown={handleKeyDown}
                        style={{ flex: '0 1 auto', minWidth: '0' }}
                    >
                        {truncatedPath}
                    </h4>

                    {diffParts && <DiffStats diffParts={diffParts} />}

                    {!file.accepted && !file.rejected && (
                        <PendingActions
                            file={file}
                            threadId={activeThread.id}
                            toolId={toolId}
                        />
                    )}

                    {(file.rejected || file.accepted) && (
                        <CompletedActions
                            file={file}
                            threadId={activeThread.id}
                            toolId={toolId}
                        />
                    )}
                </div>
            </div>
        </div>
    );
});
