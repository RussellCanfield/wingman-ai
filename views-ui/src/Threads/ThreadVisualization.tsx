import type React from 'react';
import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
    type Node,
    type Edge,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    ConnectionLineType,
    MarkerType,
    Handle,
    Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './ThreadVisualization.css';
import * as d3Force from 'd3-force';
import type { ComposerThread } from '@shared/types/Composer';

interface ThreadNodeData {
    thread: ComposerThread;
    isActive: boolean;
}

const ThreadNode: React.FC<{ data: ThreadNodeData }> = ({ data }) => {
    const { thread, isActive } = data;
    const date = new Date(thread.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });

    return (
        <div className={`thread-node ${isActive ? 'active' : ''}`}>
            {/* Add explicit source handle */}
            <Handle
                type="source"
                position={Position.Right}
                id="source"
                style={{ background: '#555' }}
            />

            <div className="thread-title">{thread.title}</div>
            <div className="thread-date">{date}</div>

            {/* Add explicit target handle */}
            <Handle
                type="target"
                position={Position.Left}
                id="target"
                style={{ background: '#555' }}
            />
        </div>
    );
};

const nodeTypes = {
    threadNode: ThreadNode,
};

interface ThreadVisualizationProps {
    threads: ComposerThread[];
    activeThreadId?: string;
    onThreadSelect?: (threadId: string) => void;
    onClose?: () => void;
}

const ThreadVisualization: React.FC<ThreadVisualizationProps> = ({
    threads,
    activeThreadId,
    onThreadSelect,
    onClose,
}) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [initialized, setInitialized] = useState(false);

    // Complete updated createGraphData function
    const createGraphData = useCallback(() => {
        if (!threads?.length) return;

        // Create nodes with initial positions spread out
        const flowNodes: Node[] = threads.map((thread, index) => ({
            id: thread.id,
            type: 'threadNode',
            data: {
                thread,
                isActive: thread.id === activeThreadId,
            },
            // Give initial positions in a circle pattern
            position: {
                x: 400 + (Math.random() - 0.5) * 800,
                y: 300 + (Math.random() - 0.5) * 800
            },
        }));

        // Create edges - with additional validation
        const flowEdges: Edge[] = threads
            .filter(t => !!t.parentThreadId)
            .map(thread => {
                // Log each edge creation for debugging
                console.log(`Creating edge from ${thread.parentThreadId} to ${thread.id}`);

                return {
                    id: `edge-${thread.parentThreadId}-${thread.id}`,
                    source: thread.parentThreadId!,
                    target: thread.id,
                    type: 'smoothstep',
                    sourceHandle: 'source',
                    targetHandle: 'target',
                    animated: true,
                    style: {
                        stroke: '#fff',
                        strokeWidth: 2
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#fff',
                        width: 15,
                        height: 15,
                    },
                };
            })

        console.log("Created edges:", flowEdges);

        // Define a type for D3 nodes that includes x and y properties
        interface D3Node extends Node {
            x?: number;
            y?: number;
            vx?: number;
            vy?: number;
        }

        const d3NodesMap = new Map();
        const d3Nodes: D3Node[] = flowNodes.map(node => {
            const d3Node = {
                ...node,
                x: node.position.x,
                y: node.position.y,
                id: node.id // Ensure ID is explicitly set
            };
            d3NodesMap.set(node.id, d3Node);
            return d3Node;
        });

        const d3Links = flowEdges
            .filter(edge => {
                const sourceExists = d3NodesMap.has(edge.source);
                const targetExists = d3NodesMap.has(edge.target);

                if (!sourceExists || !targetExists) {
                    console.warn(`Skipping edge ${edge.id}: source or target node not found`);
                }

                return sourceExists && targetExists;
            })
            .map(edge => ({
                source: d3NodesMap.get(edge.source),
                target: d3NodesMap.get(edge.target),
                id: edge.id
            }));

        try {
            // Run simulation
            const simulation = d3Force.forceSimulation<D3Node>(d3Nodes)
                .force('link', d3Force.forceLink(d3Links)
                    //@ts-expect-error
                    .id(d => d.id)
                    .distance(250) // Increase link distance
                )
                .force('charge', d3Force.forceManyBody()
                    .strength(-1200) // Much stronger repulsion
                    .distanceMax(800) // Limit the range of repulsion
                )
                .force('center', d3Force.forceCenter(400, 300))
                .force('collision', d3Force.forceCollide().radius(120)) // Larger collision radius
                .force('x', d3Force.forceX(400).strength(0.03)) // Gentle pull to center X
                .force('y', d3Force.forceY(300).strength(0.03)); // Gentle pull to center Y

            // Run the simulation longer for better layout
            for (let i = 0; i < 200; i++) {
                simulation.tick();
            }

            // Update node positions from simulation
            const positionedNodes = flowNodes.map(node => {
                const d3Node = d3Nodes.find(n => n.id === node.id);
                return {
                    ...node,
                    position: {
                        x: d3Node?.x ?? node.position.x,
                        y: d3Node?.y ?? node.position.y
                    },
                };
            });

            setNodes(positionedNodes);
            setEdges(flowEdges); // Set edges immediately

            // Add a better fit view approach
            setTimeout(() => {
                try {
                    // Force a re-fit after a short delay
                    const rfInstance = document.querySelector('.react-flow__renderer');
                    if (rfInstance) {
                        // Trigger window resize and ensure fitView is called
                        window.dispatchEvent(new Event('resize'));
                    }
                } catch (e) {
                    console.error("Error triggering fit view:", e);
                }
            }, 300);
        } catch (error) {
            console.error("Error in force simulation:", error);
            // Fallback to original nodes if simulation fails
            setNodes(flowNodes);
            setEdges(flowEdges);
        }

        setInitialized(true);
    }, [threads, activeThreadId, setNodes, setEdges]);

    useEffect(() => {
        createGraphData();
    }, [createGraphData]);

    // Add a debug effect to log nodes and edges
    useEffect(() => {
        console.log("Current nodes:", nodes);
        console.log("Current edges:", edges);
    }, [nodes, edges]);

    const handleNodeClick = (event: React.MouseEvent, node: Node) => {
        if (onThreadSelect) {
            onThreadSelect(node.id);
        }
    };

    return (
        <div className="thread-visualization-container">
            <div className="visualization-header">
                <h3>Thread Relationships</h3>
                {onClose && (
                    <button className="close-button" onClick={onClose} type="button">
                        {/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}
            </div>
            <div className="thread-visualization">
                {nodes.length > 0 ? (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeClick={handleNodeClick}
                        nodeTypes={nodeTypes}
                        defaultEdgeOptions={{
                            type: 'smoothstep',
                            animated: true,
                            style: { stroke: 'var(--vscode-editor-foreground)', strokeWidth: 2 },
                            markerEnd: {
                                type: MarkerType.ArrowClosed,
                                color: 'var(--vscode-editor-foreground)',
                                width: 15,
                                height: 15,
                            },
                        }}
                        connectionLineType={ConnectionLineType.SmoothStep}
                        fitView
                        attributionPosition="bottom-left"
                        style={{ width: '100%', height: '100%' }}
                    >
                        <Controls />
                        <Background color="#aaa" gap={16} />
                    </ReactFlow>
                ) : (
                    <div className="no-threads-message">
                        {initialized ? "No thread relationships to display" : "Loading visualization..."}
                    </div>
                )}
            </div>
            <div className="visualization-legend">
                <div className="legend-item">
                    <div className="legend-node" />
                    <span>Thread</span>
                </div>
                <div className="legend-item">
                    <div className="legend-node active" />
                    <span>Active Thread</span>
                </div>
                <div className="legend-item">
                    <div className="legend-edge" />
                    <span>Branch Relationship</span>
                </div>
            </div>
        </div>
    );
};

export default ThreadVisualization;