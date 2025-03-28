import type { AppMessage } from "@shared/types/Message";
import { useEffect, useState, useRef, useCallback } from "react";
import * as fabricModule from "fabric";
import "./App.css";
import { vscode } from "./utilities/vscode";
import { FaPencil } from "react-icons/fa6";
import { HiCursorArrowRays } from "react-icons/hi2";
import { FaRegSquare } from "react-icons/fa6";
import { FaRegCircle } from "react-icons/fa";
import { FaEraser } from "react-icons/fa";
import { VscSymbolColor } from "react-icons/vsc";
import { CgSize } from "react-icons/cg";
import { IoText } from "react-icons/io5";

// Destructure the fabric library
const { Canvas, Rect, Circle, FabricObject, PencilBrush, IText } = fabricModule;

// Defining canvas tool types
type ToolType = 'select' | 'pen' | 'rectangle' | 'circle' | 'eraser' | 'text';
type ColorType = string;

// Type for canvas state
interface CanvasState {
	objects: any[];
	background: string;
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

	// History state for undo/redo functionality
	const [history, setHistory] = useState<CanvasState[]>([]);
	const [historyIndex, setHistoryIndex] = useState<number>(-1);

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
				//@ts-expect-error
				canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoomNew);
				opt.e.preventDefault();
				opt.e.stopPropagation();
				setZoom(zoomNew);
			});

			setFabricCanvas(canvas);
			fabricCanvasRef.current = canvas;

			const initialState: CanvasState = {
				objects: [],
				background: '#ffffff'
			};
			setHistory([initialState]);
			setHistoryIndex(0);

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

	// Handle keyboard events for deletion
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (!fabricCanvas) return;

			// Skip if we're in drawing mode or panning
			if (fabricCanvas.isDrawingMode || isPanning) return;

			if (event.key === 'Delete' || event.key === 'Backspace') {
				// Prevent backspace from navigating
				event.preventDefault();

				const activeObjects = fabricCanvas.getActiveObjects();
				if (activeObjects.length > 0) {
					fabricCanvas.remove(...activeObjects);
					fabricCanvas.discardActiveObject();
					fabricCanvas.renderAll();
					saveToHistory();
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [fabricCanvas, isPanning]);

	// Handle panning
	const handlePanStart = (e: React.MouseEvent) => {
		if (isPanning) {
			setLastPanPosition({ x: e.clientX, y: e.clientY });
		}
	};

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

	const handlePanEnd = () => {
		setLastPanPosition(null);
	};

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

		// Add to recent colors if not already present
		if (!recentColors.includes(color)) {
			// Create a new array with the new color at the start and take the first 5 items
			setRecentColors(prevColors => {
				const newColors = [color];
				// Add previous colors that aren't the same as the new color
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

	// Event handlers for shape drawing and text
	const handleCanvasMouseDown = (event: React.MouseEvent) => {
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

			activeObject.set({
				width: width,
				height: height,
			});

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
			const radius = Math.sqrt(
				(coords.x - startX) ** 2 + (coords.y - startY) ** 2
			) / 2;

			activeObject.set({
				radius: radius,
				left: startX,
				top: startY
			});

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
					//@ts-expect-error
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
					//@ts-expect-error
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

	const generateImage = () => {
		const imageDataUrl = fabricCanvas?.toDataURL({
			format: 'png',
			quality: 1,
			multiplier: 1
		});

		vscode.postMessage({
			command: 'generate-image',
			value: imageDataUrl
		})
	}

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

				// Get canvas dimensions
				const canvasWidth = fabricCanvas.width || 800;
				const canvasHeight = fabricCanvas.height || 600;

				// Calculate scale to fit image within canvas (80% of canvas size)
				const scaleX = (canvasWidth * 0.8) / img.width!;
				const scaleY = (canvasHeight * 0.8) / img.height!;
				const scale = Math.min(scaleX, scaleY);

				// Set image properties
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

				// Add image to canvas
				fabricCanvas.add(img);
				fabricCanvas.setActiveObject(img);
				fabricCanvas.renderAll();
				saveToHistory();
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

						// Switch to select tool first
						handleToolChange('select');

						const img = await fabricModule.FabricImage.fromURL(dataUrl, {
							crossOrigin: "anonymous"
						});

						if (!img || !canvas) {
							console.error('Failed to create image object or canvas not available');
							return;
						}

						// Get canvas dimensions
						const canvasWidth = canvas.width || 800;
						const canvasHeight = canvas.height || 600;

						// Calculate scale to fit image within canvas (80% of canvas size)
						const scaleX = (canvasWidth * 0.8) / img.width!;
						const scaleY = (canvasHeight * 0.8) / img.height!;
						const scale = Math.min(scaleX, scaleY);

						// Set image properties
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

						// Add image to canvas
						canvas.add(img);
						canvas.setActiveObject(img);
						canvas.renderAll();
						saveToHistory();
					} catch (error) {
						console.error('Error loading image:', error);
					}
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
		const zoom = fabricCanvas.getZoom();
		fabricCanvas.setZoom(zoom * 1.1);
		setZoom(zoom * 1.1);
	};

	const handleZoomOut = () => {
		if (!fabricCanvas) return;
		const zoom = fabricCanvas.getZoom();
		fabricCanvas.setZoom(zoom / 1.1);
		setZoom(zoom / 1.1);
	};

	const handleResetZoom = () => {
		if (!fabricCanvas) return;
		fabricCanvas.setZoom(1);
		setZoom(1);
	};

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
					<button
						type="button"
						className={`tool-btn ${showColorWheel ? 'active' : ''}`}
						onClick={() => {
							setShowColorWheel(!showColorWheel);
							setShowBrushSize(false);
						}}
						title="Color"
						style={{ color: brushColor }}
					>
						<i className="icon"><VscSymbolColor size={16} /></i>
					</button>
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
					<button
						type="button"
						className="action-btn"
						onClick={handleUndo}
						disabled={!canUndo}
						title="Undo (Ctrl/⌘+Z)"
					>
						Undo
					</button>
					<button
						type="button"
						className="action-btn"
						onClick={handleRedo}
						disabled={!canRedo}
						title="Redo (Ctrl/⌘+Shift+Z)"
					>
						Redo
					</button>
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
						className="action-btn"
						onClick={generateImage}
						title="Generate Image"
					>
						Generate
					</button>
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
				<div className="zoom-controls">
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

				{/* Canvas */}
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
				</div>
			</div>
		</div>
	);
}