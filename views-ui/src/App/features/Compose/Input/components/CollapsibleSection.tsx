import type { FileDiagnostic } from "@shared/types/Composer";
import type React from "react";
import { useMemo, useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import { BsExclamationTriangle } from "react-icons/bs";
import { FaRegFileLines } from "react-icons/fa6";
import { getTruncatedPath } from "../../../../utilities/files";

interface CollapsibleSectionProps {
    items: FileDiagnostic[];
    title?: string;
    isLightTheme: boolean;
}

type Result = {
    file: string;
    message: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    items,
    title = "Suggestions",
    isLightTheme,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    const headerClass = `
    flex justify-between items-center p-3 cursor-pointer
    ${isLightTheme
            ? 'bg-gray-100 hover:bg-gray-200'
            : 'bg-[#252526] hover:bg-[#2d2d2d]'
        }
    transition-colors duration-200 rounded-t-lg
    ${items.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}
  `;

    const containerClass = `
    w-full overflow-hidden
    ${isLightTheme
            ? 'bg-white border border-gray-200'
            : 'bg-[#1e1e1e] border border-[#3e3e3e]'
        }
    rounded-lg mb-2 shadow-sm
  `;

    const itemClass = `
    p-3 border-t flex items-center gap-4 text-sm m-0
    ${isLightTheme
            ? 'border-gray-100 hover:bg-gray-50'
            : 'border-[#3e3e3e] hover:bg-[#252526]'
        }
    transition-colors duration-200
  `;

    const contentClass = `
    max-h-0 overflow-hidden transition-all duration-300 ease-in-out
    ${isExpanded ? 'max-h-[300px] overflow-y-auto' : ''}
  `;

    const displayItems = useMemo(() => {
        const results: Result[] = [];
        for (const item of items) {
            for (const error of item.importErrors) {
                results.push({
                    file: item.path,
                    message: `Import: ${error.message}`
                });
            }
            for (const error of item.lintErrors) {
                results.push({
                    file: item.path,
                    message: `Lint - ${error.message}`
                });
            }
        }
        return results;
    }, [items]);

    return (
        <div className={containerClass}>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
            <div className={headerClass} onClick={toggleExpand} aria-expanded={isExpanded}>
                <div className="font-medium flex items-center gap-4">
                    <BsExclamationTriangle size={16} className="text-yellow-500" />
                    {title} {displayItems.length > 0 && `(${displayItems.length})`}
                </div>
                <div>
                    {isExpanded ? (
                        <FaChevronUp size={14} className={isLightTheme ? 'text-gray-600' : 'text-gray-400'} />
                    ) : (
                        <FaChevronDown size={14} className={isLightTheme ? 'text-gray-600' : 'text-gray-400'} />
                    )}
                </div>
            </div>
            <div className={contentClass}>
                {displayItems.length > 0 ? (
                    <ul>
                        {displayItems.map((item, index) => (
                            <li key={item.file} className={itemClass}>
                                <FaRegFileLines size={16} />
                                <span>{getTruncatedPath(item.file)}</span>
                                <span className="text-gray-400/50">{item.message}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className={`${itemClass} text-center italic opacity-70`}>
                        No items to display
                    </div>
                )}
            </div>
        </div>
    );
};