import {
    prism,
    vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useCallback, useState } from "react";
import { memo, type PropsWithChildren } from "react";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscode } from "../../../utilities/vscode";
import { FaCopy } from "react-icons/fa6";
import { useSettingsContext } from "../../../context/settingsContext";

function LinkRenderer(props: any) {
    return <a href={props.href} target="_blank"
        rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 underline">{props.children}</a>;
}

export const MessageWithMarkdown = ({ message, fromUser, isLightTheme }: {
    message: string,
    fromUser: boolean
    isLightTheme: boolean
}) => {
    const codeTheme = isLightTheme ? prism : vscDarkPlus;
    return (
        <div className={`${fromUser ? 'p-3' : ''}`}>
            {message !== "" && renderMarkdown(message, codeTheme)}
        </div>
    )
}


const CodeContainer = memo(
    (props: PropsWithChildren) => {
        const [toolboxVisible, setToolboxVisible] = useState(false);
        const { isLightTheme } = useSettingsContext();

        /**
             * Copies Markdown content to the clipboard.
             */
        const copyToClipboard = useCallback(() => {
            vscode.postMessage({
                command: "clipboard",
                //@ts-expect-error
                value: props.content,
            });
            //@ts-expect-error
        }, [props.content]);

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
                a: LinkRenderer,
                code(props) {
                    const { children, className, ...rest } = props;
                    const languageType = /language-(\w+)/.exec(className || "");

                    return languageType ? (
                        <SyntaxHighlighter
                            PreTag={(props) => <CodeContainer {...props} content={children} />}
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