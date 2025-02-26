import { ComposerMessage } from "@shared/types/v2/Composer";
import { FileMetadata } from "@shared/types/v2/Message";
import { memo, PropsWithChildren } from "react";
import Markdown from "react-markdown";
import SyntaxHighlighter from "react-syntax-highlighter";

export const MessageWithMarkdown = ({ message, from, codeTheme }: { message: ComposerMessage["message"], from: ComposerMessage["from"], codeTheme: any }) => {
    return (
        <div className={`${from === 'user' ? 'p-3' : ''}`}>
            {message !== "" && renderMarkdown(message, codeTheme)}
        </div>
    )
}

const CodeContainer = memo(
    ({
        children,
    }: PropsWithChildren) => {
        return (
            <div className="relative rounded-md bg-editor-bg">
                <div className="overflow-x-auto p-4 markdown-container">
                    {children}
                </div>
            </div>
        );
    }
);

const renderMarkdown = (
    content: string,
    theme: any,
    file?: FileMetadata,
    step?: any
) => {
    return (
        <div className="prose prose-invert max-w-none" key={content}>
            <Markdown
                children={content}
                components={{
                    code(props) {
                        const { children, className, ...rest } = props;
                        const languageType = /language-(\w+)/.exec(
                            className || ""
                        );
                        return languageType ? (
                            //@ts-expect-error
                            <SyntaxHighlighter
                                {...rest}
                                PreTag={CodeContainer}
                                children={String(children).replace(/\n$/, "")}
                                style={theme}
                                language={languageType[1]}
                                wrapLines={true}
                                wrapLongLines={true}
                                file={file}
                                step={step}
                                className="!bg-editor-bg !p-0"
                            />
                        ) : (
                            <code
                                {...rest}
                                className={`${className} whitespace-pre-wrap bg-editor-bg rounded px-2 py-1`}
                            >
                                {children}
                            </code>
                        );
                    },
                }}
            />
        </div>
    );
};