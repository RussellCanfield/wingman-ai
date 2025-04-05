import type { AppMessage } from "@shared/types/Message";
import { useEffect, useState, useRef, useCallback } from "react";
import * as fabricModule from "fabric";
import "./App.css";
import { vscode } from "./utilities/vscode";
import { FaPencil } from "react-icons/fa6";
import { HiCursorArrowRays } from "react-icons/hi2";
import { FaRegSquare } from "react-icons/fa6";
import { FaQuestionCircle, FaRegCircle } from "react-icons/fa";
import { FaEraser } from "react-icons/fa";
import { VscSymbolColor } from "react-icons/vsc";
import { CgSize } from "react-icons/cg";
import { IoText } from "react-icons/io5";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import type { ImageGenEvent } from "@shared/types/Events";
import { Tooltip } from "react-tooltip";

const { Canvas, Rect, Circle, PencilBrush, IText } = fabricModule;

type ToolType = 'select' | 'pen' | 'rectangle' | 'circle' | 'eraser' | 'text';
type ColorType = string;

interface CanvasState {
	objects: any[];
	background: string;
}

interface ContextMenuState {
	visible: boolean;
	x: number;
	y: number;
	target: fabricModule.FabricObject | null;
}

export default function App() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const canvasContainerRef = useRef<HTMLDivElement>(null);
	const fabricCanvasRef = useRef<fabricModule.Canvas | null>(null);
	const [fabricCanvas, setFabricCanvas] = useState<fabricModule.Canvas | null>(null);
	const [activeTool, setActiveTool] = useState<ToolType>('pen');
	const [brushColor, setBrushColor] = useState<ColorType>('#000000');
	const [brushSize, setBrushSize] = useState<number>(5);
	const [isDrawing, setIsDrawing] = useState<boolean>(false);
	const [canUndo, setCanUndo] = useState<boolean>(false);
	const [canRedo, setCanRedo] = useState<boolean>(false);
	const [showColorWheel, setShowColorWheel] = useState<boolean>(false);
	const [showBrushSize, setShowBrushSize] = useState<boolean>(false);
	const [recentColors, setRecentColors] = useState<string[]>(['#000000']);
	const [zoom, setZoom] = useState<number>(1);
	const [isPanning, setIsPanning] = useState<boolean>(false);
	const [lastPanPosition, setLastPanPosition] = useState<{ x: number; y: number } | null>(null);
	const [generating, setGenerating] = useState<boolean>(false);

	// New state for generate instructions input
	const [showGenerateInput, setShowGenerateInput] = useState<boolean>(false);
	const [generateInstructions, setGenerateInstructions] = useState<string>("");

	// History state for undo/redo functionality
	const [history, setHistory] = useState<CanvasState[]>([]);
	const [historyIndex, setHistoryIndex] = useState<number>(-1);

	// New state for context menu
	const [contextMenu, setContextMenu] = useState<ContextMenuState>({
		visible: false,
		x: 0,
		y: 0,
		target: null
	});

	// Initialize canvas with correct dimensions and pan/zoom support
	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (canvasRef.current && !fabricCanvas) {
			const container = canvasContainerRef.current;
			const width = container ? container.clientWidth : 800;
			const height = container ? container.clientHeight : 600;

			const canvas = new Canvas(canvasRef.current, {
				width: width,
				height: height,
				backgroundColor: '#ffffff',
				isDrawingMode: true,
				selection: true,
			});

			const pencilBrush = new PencilBrush(canvas);
			pencilBrush.color = brushColor;
			pencilBrush.width = brushSize;
			canvas.freeDrawingBrush = pencilBrush;

			// Enable panning when space is held down
			window.addEventListener('keydown', (e) => {
				if (e.code === 'Space') {
					canvas.isDrawingMode = false;
					canvas.selection = false;
					setIsPanning(true);
				}
			});

			window.addEventListener('keyup', (e) => {
				if (e.code === 'Space') {
					setIsPanning(false);
					if (activeTool === 'pen' || activeTool === 'eraser') {
						canvas.isDrawingMode = true;
					}
					canvas.selection = true;
				}
			});

			canvas.on('mouse:wheel', (opt) => {
				const delta = opt.e.deltaY;
				let zoomNew = canvas.getZoom();
				zoomNew *= 0.999 ** delta;
				if (zoomNew > 20) zoomNew = 20;
				if (zoomNew < 0.01) zoomNew = 0.01;
				// @ts-expect-error
				canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoomNew);
				opt.e.preventDefault();
				opt.e.stopPropagation();
				setZoom(zoomNew);
			});

			// Suppress the default context menu on the canvas element
			if (canvasContainerRef.current) {
				canvasContainerRef.current.addEventListener('contextmenu', (e) => e.preventDefault());
			}

			setFabricCanvas(canvas);
			fabricCanvasRef.current = canvas;

			const initialState: CanvasState = {
				objects: [],
				background: '#ffffff'
			};
			setHistory([initialState]);
			setHistoryIndex(0);

			// Object change events
			canvas.on('object:added', () => saveToHistory());
			canvas.on('object:modified', () => saveToHistory());
			canvas.on('object:removed', () => saveToHistory());
			canvas.on('path:created', () => saveToHistory());
		}

		return () => {
			if (fabricCanvas) {
				fabricCanvas.dispose();
			}
		};
	}, []);

	// Save the current canvas state to history
	const saveToHistory = useCallback(() => {
		if (!fabricCanvas) return;

		const currentState: CanvasState = {
			objects: fabricCanvas.getObjects().map(obj => ({
				...obj.toObject(['src']),
				type: obj.type
			})),
			background: fabricCanvas.backgroundColor as string
		};

		const newHistory = history.slice(0, historyIndex + 1);
		newHistory.push(currentState);

		setHistory(newHistory);
		setHistoryIndex(newHistory.length - 1);
		setCanUndo(true);
		setCanRedo(false);
	}, [fabricCanvas, history, historyIndex]);

	// Handle tool selection
	const handleToolChange = (tool: ToolType) => {
		if (!fabricCanvas) return;

		setActiveTool(tool);
		setShowColorWheel(false);
		setShowBrushSize(false);

		switch (tool) {
			case 'select':
				fabricCanvas.isDrawingMode = false;
				fabricCanvas.selection = true;
				fabricCanvas.forEachObject((obj) => {
					obj.selectable = true;
				});
				break;
			case 'pen':
				fabricCanvas.isDrawingMode = true;
				if (!(fabricCanvas.freeDrawingBrush instanceof PencilBrush)) {
					fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
				}
				fabricCanvas.freeDrawingBrush.color = brushColor;
				fabricCanvas.freeDrawingBrush.width = brushSize;
				break;
			case 'eraser':
				fabricCanvas.isDrawingMode = true;
				if (!(fabricCanvas.freeDrawingBrush instanceof PencilBrush)) {
					fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
				}
				fabricCanvas.freeDrawingBrush.color = '#ffffff';
				fabricCanvas.freeDrawingBrush.width = brushSize * 2;
				break;
			case 'text':
			case 'rectangle':
			case 'circle':
				fabricCanvas.isDrawingMode = false;
				fabricCanvas.selection = false;
				fabricCanvas.forEachObject((obj) => {
					obj.selectable = false;
				});
				break;
		}

		fabricCanvas.renderAll();
	};

	// Handle color change with recent colors
	const handleColorChange = (color: ColorType) => {
		if (!fabricCanvas) return;

		setBrushColor(color);
		if (fabricCanvas.isDrawingMode && activeTool === 'pen' && fabricCanvas.freeDrawingBrush) {
			fabricCanvas.freeDrawingBrush.color = color;
		}

		if (!recentColors.includes(color)) {
			setRecentColors(prevColors => {
				const newColors = [color];
				// biome-ignore lint/complexity/noForEach: <explanation>
				prevColors.forEach(prevColor => {
					if (prevColor !== color && newColors.length < 5) {
						newColors.push(prevColor);
					}
				});
				return newColors;
			});
		}
	};

	// Handle brush size change
	const handleBrushSizeChange = (size: number) => {
		if (!fabricCanvas) return;

		setBrushSize(size);
		if (fabricCanvas.isDrawingMode && fabricCanvas.freeDrawingBrush) {
			fabricCanvas.freeDrawingBrush.width = activeTool === 'eraser' ? size * 2 : size;
		}
	};

	// Get pointer coordinates properly
	const getCanvasCoordinates = (event: React.MouseEvent): { x: number, y: number } | null => {
		if (!fabricCanvas || !canvasRef.current) return null;

		const pointer = fabricCanvas.getScenePoint(event.nativeEvent);
		return { x: pointer.x, y: pointer.y };
	};

	const handlePanStart = (e: React.MouseEvent) => {
		if (e.button === 1) { // Middle mouse button
			e.preventDefault();
			setIsPanning(true);
			setLastPanPosition({ x: e.clientX, y: e.clientY });
		} else if (isPanning) {
			setLastPanPosition({ x: e.clientX, y: e.clientY });
		}
	};

	// Handle keyboard shortcuts
	const handleKeyDown = useCallback((e: KeyboardEvent) => {
		if (!fabricCanvas) return;

		// Delete/Backspace key
		if (e.key === 'Delete' || e.key === 'Backspace') {
			// Only handle delete if we're not in a text editing mode
			const activeObject = fabricCanvas.getActiveObject();
			if (activeObject && !(activeObject instanceof IText && activeObject.isEditing)) {
				const activeObjects = fabricCanvas.getActiveObjects();
				fabricCanvas.remove(...activeObjects);
				fabricCanvas.discardActiveObject();
				fabricCanvas.renderAll();
				saveToHistory();
			}
		}
	}, [fabricCanvas, saveToHistory]);

	// Add this useEffect to set up the listener
	useEffect(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [handleKeyDown]);


	const handlePanMove = (e: React.MouseEvent) => {
		if (isPanning && lastPanPosition && fabricCanvas) {
			const vpt = fabricCanvas.viewportTransform;
			if (!vpt) return;

			vpt[4] += e.clientX - lastPanPosition.x;
			vpt[5] += e.clientY - lastPanPosition.y;
			fabricCanvas.requestRenderAll();
			setLastPanPosition({ x: e.clientX, y: e.clientY });
		}
	};

	const handlePanEnd = (e?: React.MouseEvent) => {
		if (e && e.button === 1) {
			setIsPanning(false);
		}
		setLastPanPosition(null);
	};

	// Event handlers for shape drawing and text
	const handleCanvasMouseDown = (event: React.MouseEvent) => {
		if (event.button === 2) {
			handleContextMenu(event);
		}

		// Exit if it's not a left-click (button 0)
		if (event.button !== 0) return;

		if (!fabricCanvas || (activeTool !== 'rectangle' && activeTool !== 'circle' && activeTool !== 'text')) return;

		const coords = getCanvasCoordinates(event);
		if (!coords) return;

		setIsDrawing(true);

		if (activeTool === 'rectangle') {
			const rect = new Rect({
				left: coords.x,
				top: coords.y,
				width: 0,
				height: 0,
				fill: 'transparent',
				stroke: brushColor,
				strokeWidth: brushSize / 2,
				selectable: false,
				originX: 'left',
				originY: 'top'
			});
			fabricCanvas.add(rect);
			fabricCanvas.setActiveObject(rect);
		} else if (activeTool === 'circle') {
			const circle = new Circle({
				left: coords.x,
				top: coords.y,
				radius: 0,
				fill: 'transparent',
				stroke: brushColor,
				strokeWidth: brushSize / 2,
				selectable: false,
				originX: 'center',
				originY: 'center'
			});
			fabricCanvas.add(circle);
			fabricCanvas.setActiveObject(circle);
		} else if (activeTool === 'text') {
			const text = new IText('Type here...', {
				left: coords.x,
				top: coords.y,
				fontFamily: 'Arial',
				fontSize: brushSize * 4,
				fill: brushColor,
				selectable: true,
				hasControls: true,
				hasBorders: true,
				editable: true,
			});
			fabricCanvas.add(text);
			fabricCanvas.setActiveObject(text);
			text.enterEditing();
			text.selectAll();
			fabricCanvas.renderAll();
			saveToHistory();
		}
	};

	const handleContextMenu = (event: React.MouseEvent) => {
		if (!fabricCanvas) return;

		const activeObject = fabricCanvas.getActiveObject();

		if (activeObject) {
			event.preventDefault();
			if (canvasContainerRef.current) {
				const rect = canvasContainerRef.current.getBoundingClientRect();
				const x = event.clientX - rect.left;
				const y = event.clientY - rect.top;
				setContextMenu({ visible: true, x, y, target: activeObject });
			}
		} else {
			// Hide context menu on left click
			setContextMenu({ visible: false, x: 0, y: 0, target: null });
		}
	}


	const handleCanvasMouseMove = (event: React.MouseEvent) => {
		if (!fabricCanvas || !isDrawing || (activeTool !== 'rectangle' && activeTool !== 'circle')) return;

		const coords = getCanvasCoordinates(event);
		if (!coords) return;

		const activeObject = fabricCanvas.getActiveObject();
		if (!activeObject) return;

		if (activeTool === 'rectangle' && activeObject instanceof Rect) {
			const startX = activeObject.left || 0;
			const startY = activeObject.top || 0;
			const width = Math.abs(coords.x - startX);
			const height = Math.abs(coords.y - startY);

			activeObject.set({ width: width, height: height });

			if (coords.x < startX) {
				activeObject.set({ left: coords.x });
			}
			if (coords.y < startY) {
				activeObject.set({ top: coords.y });
			}

			fabricCanvas.renderAll();
		} else if (activeTool === 'circle' && activeObject instanceof Circle) {
			const startX = activeObject.left || 0;
			const startY = activeObject.top || 0;
			const radius = Math.sqrt((coords.x - startX) ** 2 + (coords.y - startY) ** 2) / 2;

			activeObject.set({ radius: radius, left: startX, top: startY });
			fabricCanvas.renderAll();
		}
	};

	const handleCanvasMouseUp = () => {
		if (!fabricCanvas || !isDrawing) return;

		setIsDrawing(false);
		fabricCanvas.renderAll();
		saveToHistory();
	};

	// Undo functionality
	const handleUndo = () => {
		if (!fabricCanvas || historyIndex <= 0) return;

		const newIndex = historyIndex - 1;
		const previousState = history[newIndex];

		fabricCanvas.clear();
		fabricCanvas.backgroundColor = previousState.background;

		// biome-ignore lint/complexity/noForEach: <explanation>
		previousState.objects.forEach(objData => {
			let newObj: fabricModule.FabricObject;
			switch (objData.type) {
				case 'rect':
					newObj = new Rect(objData);
					break;
				case 'circle':
					newObj = new Circle(objData);
					break;
				case 'i-text':
					newObj = new IText(objData.text, objData);
					break;
				case 'path':
					newObj = new fabricModule.Path(objData.path, objData);
					break;
				case 'image':
					// @ts-expect-error
					fabricModule.FabricImage.fromURL(objData.src, (img) => {
						img.set(objData);
						fabricCanvas.add(img);
						fabricCanvas.renderAll();
					}, { crossOrigin: 'anonymous' });
					return;
				default:
					return;
			}
			fabricCanvas.add(newObj);
		});

		fabricCanvas.renderAll();
		setHistoryIndex(newIndex);
		setCanUndo(newIndex > 0);
		setCanRedo(true);

		handleToolChange(activeTool);
	};

	// Redo functionality
	const handleRedo = () => {
		if (!fabricCanvas || historyIndex >= history.length - 1) return;

		const newIndex = historyIndex + 1;
		const nextState = history[newIndex];

		fabricCanvas.clear();
		fabricCanvas.backgroundColor = nextState.background;

		// biome-ignore lint/complexity/noForEach: <explanation>
		nextState.objects.forEach(objData => {
			let newObj: fabricModule.FabricObject;
			switch (objData.type) {
				case 'rect':
					newObj = new Rect(objData);
					break;
				case 'circle':
					newObj = new Circle(objData);
					break;
				case 'i-text':
					newObj = new IText(objData.text, objData);
					break;
				case 'path':
					newObj = new fabricModule.Path(objData.path, objData);
					break;
				case 'image':
					// @ts-expect-error
					fabricModule.FabricImage.fromURL(objData.src, (img) => {
						img.set(objData);
						fabricCanvas.add(img);
						fabricCanvas.renderAll();
					}, { crossOrigin: 'anonymous' });
					return;
				default:
					return;
			}
			fabricCanvas.add(newObj);
		});

		fabricCanvas.renderAll();
		setHistoryIndex(newIndex);
		setCanRedo(newIndex < history.length - 1);
		setCanUndo(true);

		handleToolChange(activeTool);
	};

	// Clear canvas functionality
	const handleClear = () => {
		if (!fabricCanvas) return;

		fabricCanvas.clear();
		fabricCanvas.backgroundColor = "#ffffff";
		fabricCanvas.renderAll();
		saveToHistory();
	};

	const handleGenerationSubmit = async () => {
		if (!fabricCanvas || !generateInstructions.trim()) return;

		// Get active selection or active object
		const activeObjects = fabricCanvas.getActiveObjects();
		const hasSelection = activeObjects.length > 0;

		// If we have selected objects, create an optimized image of just those objects
		if (hasSelection) {
			// Calculate the bounding box of all selected objects
			const selectionBoundingBox = fabricCanvas.getActiveObjects().reduce((bbox, obj) => {
				const objBbox = obj.getBoundingRect();
				return {
					left: Math.min(bbox.left, objBbox.left),
					top: Math.min(bbox.top, objBbox.top),
					right: Math.max(bbox.right || objBbox.left + objBbox.width, objBbox.left + objBbox.width),
					bottom: Math.max(bbox.bottom || objBbox.top + objBbox.height, objBbox.top + objBbox.height)
				};
			}, { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY });

			// Reduce padding since we're now including stroke widths
			const padding = 10;
			// Round dimensions up to prevent fractional pixels
			const width = Math.ceil(selectionBoundingBox.right - selectionBoundingBox.left + (padding * 2));
			const height = Math.ceil(selectionBoundingBox.bottom - selectionBoundingBox.top + (padding * 2));

			// Create a temporary canvas sized to the selection
			const tempCanvasElem = document.createElement('canvas');
			tempCanvasElem.width = width;
			tempCanvasElem.height = height;
			const tempCanvas = new fabricModule.StaticCanvas(tempCanvasElem, {
				renderOnAddRemove: true
			});

			// Clone and add objects one by one
			for (const obj of activeObjects) {
				const clone = await obj.clone();
				// Adjust position relative to the new canvas and round to prevent fractional coordinates
				clone.set({
					left: Math.round(obj.left! - selectionBoundingBox.left + padding),
					top: Math.round(obj.top! - selectionBoundingBox.top + padding),
				});
				// Ensure the clone maintains its original scale and position
				clone.setCoords();
				tempCanvas.add(clone);
			}

			// Ensure everything is rendered
			tempCanvas.renderAll();

			// Get the image data with specific export settings
			const imageDataUrl = tempCanvas.toDataURL({
				format: 'png',
				quality: 1,
				multiplier: 1,
				enableRetinaScaling: false,
			});

			// Clean up
			tempCanvas.dispose();

			// Send the optimized image
			vscode.postMessage({
				command: 'generate-image',
				value: {
					imageData: imageDataUrl,
					instructions: generateInstructions
				} satisfies ImageGenEvent
			});
		} else {
			// No selection - use the entire canvas
			const imageDataUrl = fabricCanvas.toDataURL({
				format: 'png',
				quality: 1,
				multiplier: 1,
				enableRetinaScaling: false
			});

			vscode.postMessage({
				command: 'generate-image',
				value: {
					imageData: imageDataUrl,
					instructions: generateInstructions
				} satisfies ImageGenEvent
			});
		}

		setGenerating(true);
		setShowGenerateInput(false);
		setGenerateInstructions("");
	};


	// Modified generateImage function: now just toggles the generate input
	const handleGenerateClick = () => {
		if (!showGenerateInput) {
			setShowGenerateInput(true);
		}
	};

	// Handle key down in the generate instructions textarea
	const handleGenerateKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleGenerationSubmit();
		}
	};

	// Handle image upload with proper positioning and constraints
	const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (!fabricCanvas || !event.target.files || event.target.files.length === 0) return;

		const file = event.target.files[0];
		const reader = new FileReader();

		reader.onload = async (e) => {
			try {
				const imgData = e.target?.result as string;

				// Switch to select tool first
				handleToolChange('select');

				const img = await fabricModule.FabricImage.fromURL(imgData);

				if (!img) {
					console.error('Failed to create image object');
					return;
				}

				const canvasWidth = fabricCanvas.width || 800;
				const canvasHeight = fabricCanvas.height || 600;

				const scaleX = (canvasWidth * 0.8) / img.width!;
				const scaleY = (canvasHeight * 0.8) / img.height!;
				const scale = Math.min(scaleX, scaleY);

				img.set({
					left: (canvasWidth - (img.width! * scale)) / 2,
					top: (canvasHeight - (img.height! * scale)) / 2,
					scaleX: scale,
					scaleY: scale,
					selectable: true,
					hasControls: true,
					hasBorders: true,
					lockUniScaling: true,
				});

				fabricCanvas.add(img);
				fabricCanvas.setActiveObject(img);
				fabricCanvas.renderAll();
				saveToHistory();

				// Reset the file input value after successful upload
				event.target.value = '';
			} catch (error) {
				console.error('Error loading image:', error);
			}
		};

		reader.readAsDataURL(file);
	};


	// VSCode webview integration
	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const handleResponse = async (event: MessageEvent<AppMessage>) => {
			const { data } = event;
			const { command, value } = data;
			const canvas = fabricCanvasRef.current;

			switch (command) {
				case "image-result": {
					try {
						const imgData = String(value);
						const dataUrl = imgData.startsWith('data:')
							? imgData
							: `data:image/png;base64,${imgData}`;

						handleToolChange('select');

						const img = await fabricModule.FabricImage.fromURL(dataUrl, {
							crossOrigin: "anonymous"
						});

						if (!img || !canvas) {
							console.error('Failed to create image object or canvas not available');
							return;
						}

						const canvasWidth = canvas.width || 800;
						const canvasHeight = canvas.height || 600;

						const scaleX = (canvasWidth * 0.8) / img.width!;
						const scaleY = (canvasHeight * 0.8) / img.height!;
						const scale = Math.min(scaleX, scaleY);

						img.set({
							left: (canvasWidth - (img.width! * scale)) / 2,
							top: (canvasHeight - (img.height! * scale)) / 2,
							scaleX: scale,
							scaleY: scale,
							selectable: true,
							hasControls: true,
							hasBorders: true,
							lockUniScaling: true,
						});

						canvas.add(img);
						canvas.setActiveObject(img);
						canvas.renderAll();
						saveToHistory();
					} catch (error) {
						console.error('Error loading image:', error);
					}
					setGenerating(false);
					break;
				}
			}
		};

		window.addEventListener("message", handleResponse);
		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, [saveToHistory]);

	// Zoom controls
	const handleZoomIn = () => {
		if (!fabricCanvas) return;
		const zoomLevel = fabricCanvas.getZoom();
		fabricCanvas.setZoom(zoomLevel * 1.1);
		setZoom(zoomLevel * 1.1);
	};

	const handleZoomOut = () => {
		if (!fabricCanvas) return;
		const zoomLevel = fabricCanvas.getZoom();
		fabricCanvas.setZoom(zoomLevel / 1.1);
		setZoom(zoomLevel / 1.1);
	};

	const handleResetZoom = () => {
		if (!fabricCanvas) return;
		fabricCanvas.setZoom(1);
		setZoom(1);
	};

	// Handle paste event for images
	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const handlePaste = (e: ClipboardEvent) => {
			if (!fabricCanvasRef.current) return;
			if (e.clipboardData) {
				const items = e.clipboardData.items;
				for (let i = 0; i < items.length; i++) {
					const item = items[i];
					if (item.type.indexOf('image') !== -1) {
						const file = item.getAsFile();
						if (file) {
							const reader = new FileReader();
							reader.onload = (event) => {
								const imgData = event.target?.result as string;
								handleToolChange('select');
								fabricModule.FabricImage.fromURL(imgData)
									.then((img) => {
										if (!img) {
											console.error('Failed to create image object from clipboard');
											return;
										}
										const canvasWidth = fabricCanvasRef.current?.width || 800;
										const canvasHeight = fabricCanvasRef.current?.height || 600;
										const scaleX = (canvasWidth * 0.8) / img.width;
										const scaleY = (canvasHeight * 0.8) / img.height;
										const scale = Math.min(scaleX, scaleY);
										img.set({
											left: (canvasWidth - (img.width * scale)) / 2,
											top: (canvasHeight - (img.height * scale)) / 2,
											scaleX: scale,
											scaleY: scale,
											selectable: true,
											hasControls: true,
											hasBorders: true,
											lockUniScaling: true
										});
										if (fabricCanvasRef.current) {
											fabricCanvasRef.current.add(img);
											fabricCanvasRef.current.setActiveObject(img);
											fabricCanvasRef.current.renderAll();
										}
										saveToHistory();
									})
									.catch(err => console.error(err));
								reader.readAsDataURL(file);
								e.preventDefault();
							}
						}
					}
				}
				window.addEventListener('paste', handlePaste);
				return () => {
					window.removeEventListener('paste', handlePaste);
				};
			}
		}
	}, [fabricCanvas, saveToHistory]);

	// Custom handler for context menu option: Save as Image
	const handleSaveAs = async () => {
		if (!contextMenu.target || !fabricCanvas) return;

		// Create a temporary canvas element
		const bbox = contextMenu.target.getBoundingRect();
		const tempCanvasElem = document.createElement('canvas');
		tempCanvasElem.width = bbox.width;
		tempCanvasElem.height = bbox.height;
		// @ts-expect-error
		const tempStaticCanvas = new fabricModule.StaticCanvas(tempCanvasElem, { backgroundColor: null, renderOnAddRemove: true });

		// Clone the object and add it to the temporary canvas
		const clonedObj = await contextMenu.target.clone();
		clonedObj.set({ left: 0, top: 0 });
		tempStaticCanvas.add(clonedObj);
		tempStaticCanvas.renderAll();
		// @ts-expect-error
		const dataURL = tempStaticCanvas.toDataURL({ format: 'png' });
		vscode.postMessage({ command: 'save-object-image', value: dataURL });
		tempStaticCanvas.dispose();

		// Hide the context menu after action
		setContextMenu({ visible: false, x: 0, y: 0, target: null });
	};

	// Hide context menu on any click outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (contextMenu.visible) {
				setContextMenu({ visible: false, x: 0, y: 0, target: null });
			}
		};
		window.addEventListener('click', handleClickOutside);
		return () => {
			window.removeEventListener('click', handleClickOutside);
		};
	}, [contextMenu]);

	return (
		<div className="app-container">
			<div
				className="paint-app"
				onMouseDown={handlePanStart}
				onMouseMove={handlePanMove}
				onMouseUp={handlePanEnd}
				onMouseLeave={handlePanEnd}
			>
				{/* Floating Tools Panel */}
				<div className="floating-tools">
					<button
						type="button"
						className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`}
						onClick={() => handleToolChange('select')}
						title="Select (S)"
					>
						<i className="icon select-icon"><HiCursorArrowRays size={20} /></i>
					</button>
					<button
						type="button"
						className={`tool-btn ${activeTool === 'pen' ? 'active' : ''}`}
						onClick={() => handleToolChange('pen')}
						title="Pen (P)"
					>
						<i className="icon pen-icon"><FaPencil size={16} /></i>
					</button>
					<button
						type="button"
						className={`tool-btn ${activeTool === 'rectangle' ? 'active' : ''}`}
						onClick={() => handleToolChange('rectangle')}
						title="Rectangle (R)"
					>
						<i className="icon rectangle-icon"><FaRegSquare size={16} /></i>
					</button>
					<button
						type="button"
						className={`tool-btn ${activeTool === 'circle' ? 'active' : ''}`}
						onClick={() => handleToolChange('circle')}
						title="Circle (C)"
					>
						<i className="icon circle-icon"><FaRegCircle size={16} /></i>
					</button>
					<button
						type="button"
						className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`}
						onClick={() => handleToolChange('text')}
						title="Text (T)"
					>
						<i className="icon text-icon"><IoText size={16} /></i>
					</button>
					<button
						type="button"
						className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`}
						onClick={() => handleToolChange('eraser')}
						title="Eraser (E)"
					>
						<i className="icon eraser-icon"><FaEraser size={16} /></i>
					</button>
					<div className="flex flex-col">
						<button
							type="button"
							className={`tool-btn ${showColorWheel ? 'active' : ''}`}
							onClick={() => {
								setShowColorWheel(!showColorWheel);
								setShowBrushSize(false);
							}}
							title="Color"

						>
							<i className="icon"><VscSymbolColor size={16} /></i>
						</button>
						<span style={{ borderBottom: `1px solid ${brushColor}` }} />
					</div>
					<button
						type="button"
						className={`tool-btn ${showBrushSize ? 'active' : ''}`}
						onClick={() => {
							setShowBrushSize(!showBrushSize);
							setShowColorWheel(false);
						}}
						title="Brush Size"
					>
						<i className="icon"><CgSize size={16} /></i>
					</button>
				</div>

				{/* Floating Actions Panel */}
				<div className="floating-actions">
					<div className="flex gap-4">
						<button
							type="button"
							className="action-btn"
							onClick={handleClear}
							title="Clear Canvas"
						>
							Clear
						</button>
						<label className="action-btn">
							Insert
							<input
								type="file"
								accept="image/*"
								onChange={handleImageUpload}
								style={{ display: 'none' }}
							/>
						</label>
						<button
							type="button"
							className="action-btn flex flex-row items-center gap-2"
							onClick={handleGenerateClick}
							title="Generate Image"
							disabled={generating}
						>
							{generating && (
								<AiOutlineLoading3Quarters
									className="animate-spin text-stone-400"
									size={16}
								/>)}
							Generate

						</button>
					</div>
					{/* Generate Instructions Input Box */}
					{showGenerateInput && (
						<div className="generate-input-container mt-4">
							<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
								<div className="mb-3 text-gray-800 dark:text-gray-200 font-medium">
									Enter image generation instructions (required)
								</div>
								<textarea
									value={generateInstructions}
									placeholder="Describe what you want to generate..."
									onChange={(e) => setGenerateInstructions(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' && !e.shiftKey) {
											e.preventDefault();
											if (generateInstructions.trim()) {
												handleGenerationSubmit();
											}
										}
									}}
									className="w-full p-3 mb-3 resize-none rounded-md border border-gray-300 dark:border-gray-600 
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   placeholder-gray-500 dark:placeholder-gray-400
                   min-h-[100px] transition-colors duration-200"
								/>
								<div className="space-y-3">
									<div className="text-sm text-gray-600 dark:text-gray-400">
										Press Enter to generate or Shift+Enter for a new line
									</div>
									<div className="flex justify-end gap-3">
										<button
											type="button"
											className="px-4 py-2 rounded-md text-gray-700 dark:text-gray-200 
                       bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
                       dark:hover:bg-gray-600 transition-colors duration-200
                       border border-gray-300 dark:border-gray-600"
											onClick={() => setShowGenerateInput(false)}
										>
											Cancel
										</button>
										<button
											type="button"
											className={`px-4 py-2 rounded-md text-white
                       bg-blue-600 hover:bg-blue-700 
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors duration-200
                       ${!generateInstructions.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
											onClick={handleGenerationSubmit}
											disabled={!generateInstructions.trim()}
										>
											Generate
										</button>
									</div>
								</div>
							</div>
						</div>
					)}

				</div>

				{/* Color Wheel */}
				<div className={`color-wheel-container ${showColorWheel ? 'visible' : ''}`}>
					<input
						type="color"
						value={brushColor}
						onChange={(e) => handleColorChange(e.target.value)}
						className="color-wheel"
					/>
					<div className="recent-colors">
						{recentColors.map((color) => (
							// biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
							<div
								key={color}
								className={`recent-color ${brushColor === color ? 'active' : ''}`}
								style={{ backgroundColor: color }}
								onClick={() => handleColorChange(color)}
								title={color}
							/>
						))}
					</div>
				</div>

				{/* Brush Size Controls */}
				<div className={`brush-size-container ${showBrushSize ? 'visible' : ''}`}>
					<input
						type="range"
						min="1"
						max="50"
						value={brushSize}
						onChange={(e) => handleBrushSizeChange(Number(e.target.value))}
						className="brush-size-slider"
					/>
					<div className="brush-size-preview">
						<div
							className="brush-size-circle"
							style={{
								width: `${brushSize}px`,
								height: `${brushSize}px`,
								backgroundColor: brushColor
							}}
						/>
					</div>
					<span className="brush-size-value">{brushSize}px</span>
				</div>

				{/* Zoom Controls */}
				<div className="zoom-controls p-2">
					<div className="flex items-center">
						<span data-tooltip-id="tips">
							<FaQuestionCircle size={16} />
							<Tooltip
								id="tips"
								place="bottom"
								content="You can save or generate based off a specific shape by selecting it. If no selection is made, it will use the canvas's viewport."
							/>
						</span>
					</div>
					<button
						type="button"
						className="zoom-btn"
						onClick={handleZoomIn}
						title="Zoom In"
					>
						+
					</button>
					<button
						type="button"
						className="zoom-btn"
						onClick={handleZoomOut}
						title="Zoom Out"
					>
						-
					</button>
					<button
						type="button"
						className="zoom-btn"
						onClick={handleResetZoom}
						title="Reset Zoom"
					>
						1:1
					</button>
				</div>

				{/* Canvas Container */}
				<div
					ref={canvasContainerRef}
					className="canvas-container"
					onMouseDown={handleCanvasMouseDown}
					onMouseMove={handleCanvasMouseMove}
					onMouseUp={handleCanvasMouseUp}
					onMouseLeave={handleCanvasMouseUp}
				>
					<div className="canvas-wrapper">
						<canvas ref={canvasRef} id="fabric-canvas" />
					</div>

					{contextMenu.visible && (
						// biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
						<div
							className="context-menu"
							style={{ position: 'absolute', left: contextMenu.x, top: contextMenu.y, background: '#fff', border: '1px solid #ccc', borderRadius: '4px', zIndex: 1000, padding: '4px' }}
							onClick={(e) => e.stopPropagation()} // Prevent click from bubbling up
						>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation(); // Stop propagation here as well
									handleSaveAs();
								}}
								style={{ background: 'none', color: '#000', border: 'none', padding: '4px 8px', cursor: 'pointer' }}
							>
								Save as Image
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
