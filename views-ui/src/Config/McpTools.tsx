import { useState, useEffect } from "react";
import type { MCPToolConfig } from "@shared/types/Settings";
import { GrTest } from "react-icons/gr";
import { AiOutlineCheckCircle } from "react-icons/ai";
import { FaRegTrashCan } from "react-icons/fa6";
import { vscode } from "./utilities/vscode";

interface MCPConfigProps {
    mcpTools: MCPToolConfig[];
    onChange: (tools: MCPToolConfig[]) => void;
}

export const MCPConfiguration = ({ mcpTools = [], onChange }: MCPConfigProps) => {
    const [tools, setTools] = useState<MCPToolConfig[]>(mcpTools);
    const [newToolType, setNewToolType] = useState<"command" | "sse">("command");
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTool, setNewTool] = useState<Partial<MCPToolConfig>>({
        name: "",
        type: "command",
        command: "",
        endpoint: "",
    });

    useEffect(() => {
        setTools(mcpTools);
    }, [mcpTools]);

    const handleAddTool = () => {
        if (!newTool.name || (newTool.type === "command" && !newTool.command) ||
            (newTool.type === "sse" && !newTool.endpoint)) {
            return;
        }

        const updatedTools = [...tools, newTool as MCPToolConfig];
        setTools(updatedTools);
        onChange(updatedTools);
        setNewTool({
            name: "",
            type: newToolType,
            command: "",
            endpoint: "",
        });
        setShowAddForm(false);
    };

    const handleRemoveTool = (index: number) => {
        const updatedTools = tools.filter((_, i) => i !== index);
        setTools(updatedTools);
        onChange(updatedTools);
    };

    const handleToolChange = (index: number, field: keyof MCPToolConfig, value: string) => {
        const updatedTools = [...tools];
        updatedTools[index] = {
            ...updatedTools[index],
            [field]: value,
            verified: false
        };
        setTools(updatedTools);
        onChange(updatedTools);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col space-y-4">
                <h3 className="text-md font-medium text-[var(--vscode-foreground)]">
                    MCP Tools Configuration
                </h3>
                <p className="text-sm text-[var(--vscode-descriptionForeground)]">
                    Configure Model Context Protocol tools that Wingman can use.
                </p>
                <p className="text-sm text-[var(--vscode-descriptionForeground)]">
                    You can find servers{" "}
                    <a
                        href=" https://www.pulsemcp.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 underline"
                    >
                        here
                    </a>
                    {" "} or <a
                        href=" https://modelcontextprotocol.io/introduction"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 underline"
                    >
                        create your own!
                    </a>
                </p>
            </div>

            {/* List of existing tools */}
            {tools.length > 0 ? (
                <div className="space-y-4">
                    {tools.map((tool, index) => (
                        <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                            key={index}
                            className="p-4 border border-[var(--vscode-editorWidget-border)] rounded-md bg-[var(--vscode-editor-background)]"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="font-medium">{tool.name}</h4>
                                    <p className="text-sm text-[var(--vscode-descriptionForeground)]">
                                        {tool.type === "command" ? "Command-line Tool" : "SSE Endpoint"}
                                    </p>
                                </div>
                                <div className="flex flex-row gap-4 items-center">
                                    <button type="button"
                                        className="p-3 hover:bg-gray-500/50"
                                        onClick={() => {
                                            vscode.postMessage({
                                                command: 'test-mcp',
                                                value: tool
                                            })
                                        }}>
                                        {tool.verified ? <AiOutlineCheckCircle size={16} className="text-green-500" /> : <GrTest size={16} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTool(index)}
                                        className="text-red-500 hover:text-red-700 hover:bg-gray-500/50 p-3"
                                    >
                                        <FaRegTrashCan size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    {/* biome-ignore lint/a11y/noLabelWithoutControl: <explanation> */}
                                    <label className="block text-sm font-medium mb-1">
                                        Name
                                    </label>
                                    <input
                                        type="text"
                                        value={tool.name}
                                        onChange={(e) => handleToolChange(index, "name", e.target.value)}
                                        className="w-full px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md"
                                    />
                                </div>
                                {tool.tools && (
                                    <div>
                                        {/* biome-ignore lint/a11y/noLabelWithoutControl: <explanation> */}
                                        <label className="block text-sm font-medium mb-1">
                                            Tools Available:
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {tool.tools.map((t, index) => (
                                                <div
                                                    key={`${t.name}-${index}`}
                                                    className='p-1 rounded-sm bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)]'
                                                >
                                                    {t.name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {tool.type === "command" ? (
                                    <div>
                                        {/* biome-ignore lint/a11y/noLabelWithoutControl: <explanation> */}
                                        <label className="block text-sm font-medium mb-1">
                                            Command
                                        </label>
                                        <input
                                            type="text"
                                            value={tool.command}
                                            onChange={(e) => handleToolChange(index, "command", e.target.value)}
                                            className="w-full px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md"
                                            placeholder="e.g., python script.py"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        {/* biome-ignore lint/a11y/noLabelWithoutControl: <explanation> */}
                                        <label className="block text-sm font-medium mb-1">
                                            SSE Endpoint
                                        </label>
                                        <input
                                            type="text"
                                            value={tool.endpoint}
                                            onChange={(e) => handleToolChange(index, "endpoint", e.target.value)}
                                            className="w-full px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md"
                                            placeholder="e.g., https://api.example.com/events"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-6 border border-dashed border-[var(--vscode-editorWidget-border)] rounded-md">
                    <p className="text-[var(--vscode-descriptionForeground)]">
                        No MCP tools configured yet. Add your first tool below.
                    </p>
                </div>
            )}

            {/* Add new tool form */}
            {showAddForm ? (
                <div className="p-4 border border-[var(--vscode-editorWidget-border)] rounded-md bg-[var(--vscode-editor-background)]">
                    <h4 className="font-medium mb-3">Add New MCP Tool</h4>

                    <div className="space-y-3">
                        <div>
                            {/* biome-ignore lint/a11y/noLabelWithoutControl: <explanation> */}
                            <label className="block text-sm font-medium mb-1">
                                Tool Type
                            </label>
                            <div className="flex space-x-4">
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        checked={newTool.type === "command"}
                                        onChange={() => setNewTool({ ...newTool, type: "command" })}
                                        className="mr-2"
                                    />
                                    <span>Command-line Tool</span>
                                </label>
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        checked={newTool.type === "sse"}
                                        onChange={() => setNewTool({ ...newTool, type: "sse" })}
                                        className="mr-2"
                                    />
                                    <span>SSE Endpoint</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            {/* biome-ignore lint/a11y/noLabelWithoutControl: <explanation> */}
                            <label className="block text-sm font-medium mb-1">
                                Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={newTool.name}
                                onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                                className="w-full px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md"
                                placeholder="e.g., Figma Integration"
                            />
                        </div>

                        {newTool.type === "command" ? (
                            <div>
                                {/* biome-ignore lint/a11y/noLabelWithoutControl: <explanation> */}
                                <label className="block text-sm font-medium mb-1">
                                    Command <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newTool.command}
                                    onChange={(e) => setNewTool({ ...newTool, command: e.target.value })}
                                    className="w-full px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md"
                                    placeholder="e.g., python mcp_tool.py"
                                />
                            </div>
                        ) : (
                            <div>
                                {/* biome-ignore lint/a11y/noLabelWithoutControl: <explanation> */}
                                <label className="block text-sm font-medium mb-1">
                                    SSE Endpoint <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newTool.endpoint}
                                    onChange={(e) => setNewTool({ ...newTool, endpoint: e.target.value })}
                                    className="w-full px-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md"
                                    placeholder="e.g., http://localhost:3001/sse"
                                />
                            </div>
                        )}

                        <div className="flex justify-end space-x-3 mt-4">
                            <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                className="px-4 py-2 text-sm border border-[var(--vscode-button-border)] rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAddTool}
                                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                                disabled={!newTool.name || (newTool.type === "command" && !newTool.command) ||
                                    (newTool.type === "sse" && !newTool.endpoint)}
                            >
                                Add Tool
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="w-full py-2 border border-dashed border-[var(--vscode-button-border)] rounded-md text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] transition-colors"
                >
                    + Add MCP Tool
                </button>
            )}
        </div>
    );
};