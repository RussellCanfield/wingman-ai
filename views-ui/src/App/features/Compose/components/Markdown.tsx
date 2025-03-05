import type { ComposerMessage } from "@shared/types/v2/Composer";
import React, { useCallback, useState } from "react";
import { memo, type PropsWithChildren } from "react";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscode } from "../../../utilities/vscode";
import { FaCopy } from "react-icons/fa6";
import { useSettingsContext } from "../../../context/settingsContext";

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
    (props: PropsWithChildren) => {
        const [toolboxVisible, setToolboxVisible] = useState(false);
        const { isLightTheme } = useSettingsContext();

        /**
         * Extracts Markdown content from children nodes.
         */
        const getMarkdownFromChildren = useCallback((): string => {
            const markDown = props.children as MarkDownObject;

            return (markDown.props.children[1] as MarkDownEntry[]).reduce(
                (acc: string, curr: string | MarkDownEntry) => {
                    if (typeof curr === "string") {
                        // biome-ignore lint/style/noParameterAssign: its fine
                        acc += curr;
                    } else if (curr.props.children) {
                        // biome-ignore lint/complexity/noForEach: <explanation>
                        (curr.props.children as unknown as MarkDownEntry[]).forEach((c) => {
                            if (typeof c === "string") {
                                // biome-ignore lint/style/noParameterAssign: its fine
                                acc += c;
                            } else if (
                                curr.props.children &&
                                Array.isArray(curr.props.children) &&
                                curr.props.children[0] !== undefined
                            ) {
                                // biome-ignore lint/style/noParameterAssign: its fine
                                acc += c.props.children[0];
                            }
                        });
                    }
                    return acc;
                },
                ""
            );
        }, [props.children]);

        /**
             * Copies Markdown content to the clipboard.
             */
        const copyToClipboard = useCallback(() => {
            vscode.postMessage({
                command: "clipboard",
                value: getMarkdownFromChildren(),
            });
        }, [getMarkdownFromChildren]);

        /**
         * Renders the toolbox with actions (copy & send to file).
         */
        const Toolbox = useCallback(() => (
            <div className="flex justify-end absolute -top-5 right-1.5 pr-2.5">
                <div className="flex gap-1.5 list-none p-1 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-md">
                    <button
                        type="button"
                        className="p-1.5 rounded-md transition-all duration-200 cursor-pointer text-[var(--vscode-foreground)] hover:text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-background)] focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] active:scale-95"
                        title="Copy code to clipboard"
                        onClick={copyToClipboard}
                    >
                        <FaCopy size={16} />
                    </button>
                </div>
            </div>
        ), [copyToClipboard]);

        return (

            <div className="relative rounded-md bg-editor-bg"
                onMouseEnter={() => setToolboxVisible(true)}
                onMouseLeave={() => setToolboxVisible(false)}
            >
                {toolboxVisible && <Toolbox />}
                <div className={`overflow-x-auto p-4 markdown-container mt-4 mb-4 ${isLightTheme
                    ? 'bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.15)]'
                    : 'bg-[#1e1e1e] shadow-[0_2px_4px_rgba(0,0,0,0.2),0_8px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_12px_24px_rgba(0,0,0,0.25)]'
                    }
		transition-shadow duration-300 ease-in-out rounded-xl`}>
                    {props.children}
                </div>
            </div >
        );
    }
);

export type MarkDownObject = {
    props: {
        children: [boolean, MarkDownEntry[] | string];
    };
};

export type MarkDownEntry = {
    props: {
        children: string[];
    };
};

const renderMarkdown = (content: string, theme: any) => {
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