import type React from "react";
import { useReducer, useRef, useEffect, useCallback } from "react";
import { Box, measureElement, useInput } from "ink";
import useStdoutDimensions from 'ink-use-stdout-dimensions';
import { uiLogger } from "../utils/logger";

interface ScrollAreaProps {
	height?: number;
	children: React.ReactNode;
	autoScroll?: boolean;
}

interface ScrollState {
	height: number;
	scrollTop: number;
	innerHeight: number;
}

type ScrollAction =
	| { type: "SET_INNER_HEIGHT"; innerHeight: number }
	| { type: "SCROLL_DOWN" }
	| { type: "SCROLL_UP" }
	| { type: "SCROLL_TO_BOTTOM" }
	| { type: "SET_HEIGHT"; height: number };

const scrollReducer = (
	state: ScrollState,
	action: ScrollAction,
): ScrollState => {
	switch (action.type) {
		case "SET_INNER_HEIGHT": {
			const maxScrollTop = Math.max(0, action.innerHeight - state.height);
			return {
				...state,
				innerHeight: action.innerHeight,
				// If we were at the bottom, stay at the bottom
				scrollTop:
					state.scrollTop >= Math.max(0, state.innerHeight - state.height)
						? maxScrollTop
						: state.scrollTop,
			};
		}
		case "SCROLL_DOWN": {
			const maxScrollTop = Math.max(0, state.innerHeight - state.height);
			return {
				...state,
				scrollTop: Math.min(maxScrollTop, state.scrollTop + 1),
			};
		}
		case "SCROLL_UP":
			return {
				...state,
				scrollTop: Math.max(0, state.scrollTop - 1),
			};
		case "SCROLL_TO_BOTTOM": {
			const maxScrollTop = Math.max(0, state.innerHeight - state.height);
			return {
				...state,
				scrollTop: maxScrollTop,
			};
		}
		case "SET_HEIGHT": {
			const maxScrollTop = Math.max(0, state.innerHeight - action.height);
			return {
				...state,
				height: action.height,
				// Adjust scroll position if needed
				scrollTop: Math.min(state.scrollTop, maxScrollTop),
			};
		}
		default:
			return state;
	}
};

const ScrollArea: React.FC<ScrollAreaProps> = ({
	height: fixedHeight,
	children,
	autoScroll = true,
}) => {
	const [columns, rows] = useStdoutDimensions();
	const innerRef = useRef<any>();
	const wasAtBottomRef = useRef(true);
	const measureTimeoutRef = useRef<NodeJS.Timeout>();

	// Calculate available height (leave space for header, input, and status bar)
	const availableHeight = fixedHeight || Math.max(5, (rows || 24) - 8);

	const [state, dispatch] = useReducer(scrollReducer, {
		height: availableHeight,
		scrollTop: 0,
		innerHeight: 0,
	});

	// Calculate derived values
	const maxScrollTop = Math.max(0, state.innerHeight - state.height);
	const canScrollUp = state.scrollTop > 0;
	const canScrollDown = state.scrollTop < maxScrollTop;
	const showScrollIndicators = state.innerHeight > state.height;

	// Update height when terminal size changes
	useEffect(() => {
		if (!fixedHeight && rows) {
			const newHeight = Math.max(5, rows - 8);
			if (newHeight !== state.height) {
				uiLogger.debug(
					{
						event: "terminal_resize",
						oldHeight: state.height,
						newHeight,
						terminalRows: rows,
					},
					"Terminal resized, updating scroll area height",
				);
				dispatch({ type: "SET_HEIGHT", height: newHeight });
			}
		}
	}, [rows, fixedHeight, state.height]);

	// Debounced measure function
	const measureContent = useCallback(() => {
		if (measureTimeoutRef.current) {
			clearTimeout(measureTimeoutRef.current);
		}

		measureTimeoutRef.current = setTimeout(() => {
			if (innerRef.current) {
				try {
					const dimensions = measureElement(innerRef.current);
					if (dimensions.height !== state.innerHeight) {
						uiLogger.trace(
							{
								event: "content_height_changed",
								oldHeight: state.innerHeight,
								newHeight: dimensions.height,
								wasAtBottom: wasAtBottomRef.current,
							},
							"Content height changed",
						);

						dispatch({
							type: "SET_INNER_HEIGHT",
							innerHeight: dimensions.height,
						});
					}
				} catch (error) {
					uiLogger.warn(
						{
							event: "measure_error",
							error: error instanceof Error ? error.message : String(error),
						},
						"Failed to measure scroll area content",
					);
				}
			}
		}, 10); // Small debounce to avoid excessive measurements
	}, [state.innerHeight]);

	// Measure content on every render (debounced)
	useEffect(() => {
		measureContent();
		return () => {
			if (measureTimeoutRef.current) {
				clearTimeout(measureTimeoutRef.current);
			}
		};
	});

	// Track if user was at bottom before content change
	useEffect(() => {
		wasAtBottomRef.current = state.scrollTop >= maxScrollTop;
	}, [state.scrollTop, maxScrollTop]);

	// Auto-scroll to bottom when new content is added (if enabled and user was at bottom)
	useEffect(() => {
		if (
			autoScroll &&
			wasAtBottomRef.current &&
			maxScrollTop > 0 &&
			state.scrollTop < maxScrollTop
		) {
			uiLogger.trace(
				{
					event: "auto_scroll_triggered",
					scrollTop: state.scrollTop,
					maxScrollTop,
					innerHeight: state.innerHeight,
					height: state.height,
				},
				"Auto-scrolling to bottom",
			);
			dispatch({ type: "SCROLL_TO_BOTTOM" });
		}
	}, [
		state.innerHeight,
		autoScroll,
		maxScrollTop,
		state.scrollTop,
		state.height,
	]);

	// Handle keyboard input for scrolling
	const handleInput = useCallback(
		(input: string, key: any) => {
			// Only handle scrolling if there's content to scroll
			if (!showScrollIndicators) {
				return;
			}

			if (key.upArrow) {
				uiLogger.trace(
					{
						event: "scroll_up_key",
						currentScrollTop: state.scrollTop,
						canScrollUp,
					},
					"Up arrow pressed",
				);
				if (canScrollUp) {
					dispatch({ type: "SCROLL_UP" });
				}
				return;
			}

			if (key.downArrow) {
				uiLogger.trace(
					{
						event: "scroll_down_key",
						currentScrollTop: state.scrollTop,
						canScrollDown,
					},
					"Down arrow pressed",
				);
				if (canScrollDown) {
					dispatch({ type: "SCROLL_DOWN" });
				}
				return;
			}

			// Page Up (Ctrl+U or Page Up)
			if (key.pageUp || (key.ctrl && input === "u")) {
				uiLogger.trace(
					{ event: "page_up_key", currentScrollTop: state.scrollTop },
					"Page up",
				);
				const scrollAmount = Math.floor(state.height / 2);
				for (let i = 0; i < scrollAmount && state.scrollTop > 0; i++) {
					dispatch({ type: "SCROLL_UP" });
				}
				return;
			}

			// Page Down (Ctrl+D or Page Down)
			if (key.pageDown || (key.ctrl && input === "d")) {
				uiLogger.trace(
					{ event: "page_down_key", currentScrollTop: state.scrollTop },
					"Page down",
				);
				const scrollAmount = Math.floor(state.height / 2);
				for (
					let i = 0;
					i < scrollAmount && state.scrollTop < maxScrollTop;
					i++
				) {
					dispatch({ type: "SCROLL_DOWN" });
				}
				return;
			}

			// Home (go to top)
			if (key.home) {
				uiLogger.trace({ event: "home_key" }, "Scrolling to top");
				dispatch({ type: "SET_INNER_HEIGHT", innerHeight: state.innerHeight }); // Reset scroll to 0
				return;
			}

			// End (go to bottom)
			if (key.end) {
				uiLogger.trace({ event: "end_key" }, "Scrolling to bottom");
				dispatch({ type: "SCROLL_TO_BOTTOM" });
				return;
			}
		},
		[
			state.scrollTop,
			state.height,
			maxScrollTop,
			canScrollUp,
			canScrollDown,
			showScrollIndicators,
			state.innerHeight,
		],
	);

	useInput(handleInput, { isActive: true });

	uiLogger.trace(
		{
			event: "scroll_area_render",
			height: state.height,
			innerHeight: state.innerHeight,
			scrollTop: state.scrollTop,
			maxScrollTop,
			canScrollUp,
			canScrollDown,
			showScrollIndicators,
		},
		"Rendering scroll area",
	);

	return (
		<Box height={state.height} flexDirection="column" overflow="hidden">
			{/* Scroll indicator at top */}
			{showScrollIndicators && canScrollUp && (
				<Box
					justifyContent="center"
					borderStyle="single"
					borderTop={false}
					borderLeft={false}
					borderRight={false}
					borderBottom={true}
				>
					<Box paddingX={1}>
						<Box color="gray">↑ More content above (↑/↓ to scroll) ↑</Box>
					</Box>
				</Box>
			)}

			{/* Scrollable content */}
			<Box
				ref={innerRef}
				flexShrink={0}
				flexDirection="column"
				marginTop={-state.scrollTop}
			>
				{children}
			</Box>

			{/* Scroll indicator at bottom */}
			{showScrollIndicators && canScrollDown && (
				<Box
					justifyContent="center"
					borderStyle="single"
					borderTop={true}
					borderLeft={false}
					borderRight={false}
					borderBottom={false}
				>
					<Box paddingX={1}>
						<Box color="gray">↓ More content below (↑/↓ to scroll) ↓</Box>
					</Box>
				</Box>
			)}
		</Box>
	);
};

export default ScrollArea;
