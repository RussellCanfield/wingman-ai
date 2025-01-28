import { useState } from 'react';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { CodeContainer } from './ChatEntry';
import {
    prism,
    vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";

interface ThinkingSectionProps {
    content: string;
    isThinking: boolean;
    isLightTheme: boolean;
}

export const ThinkingSection = ({
    content,
    isThinking,
    isLightTheme
}: ThinkingSectionProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="my-2 border rounded-md border-stone-600 mb-4">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 p-2 hover:bg-stone-700 transition-colors"
            >
                {isExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                <span className={`${isLightTheme ? 'text-stone-400' : 'text-stone-500'}`}>
                    Thinking Process {isThinking && '...'}
                </span>
            </button>
            {isExpanded && (
                <div className="p-2 border-t border-stone-600">
                    <Markdown
                        children={content}
                        components={{
                            code(props) {
                                const { children, className } = props;
                                const languageType = /language-(\w+)/.exec(className || "");
                                return languageType ? (
                                    <SyntaxHighlighter
                                        PreTag={CodeContainer}
                                        children={String(children).replace(/\n$/, "")}
                                        style={isLightTheme ? prism : vscDarkPlus}
                                        language={languageType[1]}
                                        wrapLines={true}
                                        wrapLongLines={true}
                                    />
                                ) : (
                                    <code className={`whitespace-pre-wrap ${className} bg-transparent`}>
                                        {children}
                                    </code>
                                );
                            },
                        }}
                    />
                    {isThinking && (
                        <span className="inline-block ml-1 animate-pulse">▊</span>
                    )}
                </div>
            )}
        </div>
    );
};