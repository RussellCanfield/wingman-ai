import type { ComposerMessage } from "@shared/types/v2/Composer";
import React from "react";
import { memo, type PropsWithChildren } from "react";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";

export const MessageWithMarkdown = ({ message, from, codeTheme }: {
    message: ComposerMessage["message"],
    from: ComposerMessage["from"],
    codeTheme: any
}) => {
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
) => {
    return (
        <Markdown
            // biome-ignore lint/correctness/noChildrenProp: <explanation>
            children={content}
            components={{
                code(props) {
                    const { children, className, ...rest } = props;
                    const languageType = /language-(\w+)/.exec(className || "");

                    return languageType ? (
                        <SyntaxHighlighter
                            PreTag={CodeContainer}
                            // biome-ignore lint/correctness/noChildrenProp: <explanation>
                            children={String(children).replace(/\n$/, "")}
                            style={theme}
                            language={languageType[1]}
                            wrapLines={true}
                            wrapLongLines={true}
                            useInlineStyles={true}
                        />
                    ) : (
                        <code
                            {...rest}
                            className={`whitespace-pre-wrap ${className} bg-transparent`}
                        >
                            {children}
                        </code>
                    );
                },
            }}
        />
    );
};