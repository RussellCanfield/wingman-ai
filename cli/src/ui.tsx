import type React from "react";
import { useCallback, useEffect } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import MessageList from "./components/MessageList";
import UserInput from "./components/UserInput";
import ScrollableArea from "./components/ScrollableArea";
import CompactHeader from "./components/CompactHeader";
import TerminalSizeWarning from "./components/TerminalSizeWarning";
import { wingmanArt } from "./art";
import { useWingman } from "./contexts/WingmanContext";
import StatusBar from "./components/StatusBar";
import type { WingmanRequest } from "@wingman-ai/agent";
import { Status } from "./contexts/types";
import { uiLogger, logInputEvent } from "./utils/logger";
import { Spinner } from "./components/Spinner";
import { calculateLayout, validateLayout, getTerminalSizeMessage } from "./utils/layout";

const UI: React.FC = () => {
	const {
		messages,
		status,
		input,
		setInput,
		handleSubmit,
		toggleContextView,
		clearContext,
	} = useWingman();
	const { exit } = useApp();
	const { stdout } = useStdout();
	const rows = stdout.rows || 24;

	// Calculate responsive layout dimensions
	const layout = calculateLayout(rows);
	const layoutValidation = validateLayout(layout);
	const terminalSizeMessage = getTerminalSizeMessage(rows);

	useEffect(() => {
		uiLogger.info({ 
			event: "mount",
			terminalRows: rows,
			layout,
			layoutValidation,
		}, "UI component mounted with responsive layout");

		const handleExit = () => {
			uiLogger.info(
				{ event: "sigint_handler", source: "process.on" },
				"SIGINT received, exiting",
			);
			exit();
		};

		process.on("SIGINT", handleExit);

		return () => {
			process.off("SIGINT", handleExit);
			uiLogger.info({ event: "unmount" }, "UI component unmounted");
		};
	}, [exit, rows, layout, layoutValidation]);

	// Log layout warnings
	useEffect(() => {
		if (layoutValidation.warnings.length > 0) {
			uiLogger.warn({
				event: "layout_warnings",
				warnings: layoutValidation.warnings,
				layout,
			}, "Layout validation warnings detected");
		}
	}, [layoutValidation, layout]);

	// Global input handler for all shortcuts
	useInput(
		useCallback(
			(inputChar, key) => {
				logInputEvent("global_handler_input", {
					inputChar,
					ctrl: key.ctrl,
					meta: key.meta,
					keyPressed: Object.keys(key)
						.filter((k) => key[k as keyof typeof key])
						.join("+"),
				});

				if (key.ctrl) {
					// Handle Ctrl+C to exit
					if (inputChar === "c") {
						uiLogger.info(
							{
								event: "ctrl_c_exit",
								handler: "global",
								priority: "high",
							},
							"Ctrl+C detected in global handler - exiting",
						);
						exit();
						return;
					}

					// Handle Ctrl+B to toggle context view
					if (inputChar === "b") {
						logInputEvent("context_toggle", {
							reason: "global_handler_ctrl_b",
						});
						toggleContextView();
						return;
					}

					// Handle Ctrl+D to clear context
					if (inputChar === "d") {
						logInputEvent("context_clear", { reason: "global_handler_ctrl_d" });
						clearContext();
						setInput(""); // Also clear the user input field
						return;
					}
				}

				uiLogger.trace(
					{
						event: "global_handler_passthrough",
						inputChar,
						keyPressed: Object.keys(key)
							.filter((k) => key[k as keyof typeof key])
							.join("+"),
					},
					"Event not handled by global handler",
				);
			},
			[exit, toggleContextView, clearContext, setInput],
		),
		{
			isActive: true, // Always active for global shortcuts
		},
	);

	// Log handler registration state
	useEffect(() => {
		uiLogger.debug(
			{
				event: "handler_registration",
				handler: "global_input",
				active: true,
			},
			"Global input handler registered",
		);

		return () => {
			uiLogger.debug(
				{
					event: "handler_deregistration",
					handler: "global_input",
				},
				"Global input handler deregistered",
			);
		};
	}, []);

	const isThinking = status === Status.Thinking;
	const isExecutingTool = status === Status.ExecutingTool;
	const isIdle = status === Status.Idle;
	const isCompacting = status === Status.Compacting;

	// Log status changes
	useEffect(() => {
		uiLogger.debug(
			{
				event: "status_change",
				status: Status[status],
				isThinking,
				isExecutingTool,
				isIdle,
				isCompacting,
			},
			`Status changed to: ${Status[status]}`,
		);
	}, [status, isThinking, isExecutingTool, isIdle, isCompacting]);

	// Handle extremely small terminals
	if (!layout.minTerminalMet) {
		return (
			<Box flexDirection="column" padding={1}>
				<Box>
					<Text color="red" bold>
						⚠️  Terminal Too Small
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text>
						Current: {rows} rows
					</Text>
				</Box>
				<Box>
					<Text>
						Minimum: 15 rows required
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text color="gray">
						Please resize your terminal window
					</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			{/* Terminal size warning if needed */}
			{terminalSizeMessage && (
				<TerminalSizeWarning 
					message={terminalSizeMessage}
					isError={!layoutValidation.isValid}
				/>
			)}

			{/* Responsive Header Section */}
			<Box height={layout.headerHeight}>
				{layout.showFullHeader ? (
					<Box flexDirection="column">
						<Box>
							<Text>{wingmanArt}</Text>
						</Box>
						<Box>
							<Text color="blue">Your AI-powered partner</Text>
						</Box>
					</Box>
				) : (
					<CompactHeader showFullHeader={false} />
				)}
			</Box>

			{/* Responsive Scrollable Message Area */}
			<Box marginTop={layout.isCompact ? 0 : 1}>
				<ScrollableArea
					height={layout.availableHeight}
					autoScroll={true}
					showScrollIndicators={!layout.isCompact}
				>
					<MessageList messages={messages} />
				</ScrollableArea>
			</Box>

			{/* Responsive Footer Section */}
			<Box
				flexDirection="column"
				height={layout.footerHeight}
				justifyContent="flex-end"
			>
				{/* Dynamic content within fixed container */}
				<Box flexDirection="column">
					{(isThinking || isCompacting) && (
						<Box>
							<Spinner type="dots" />
						</Box>
					)}
					{isIdle && (
						<UserInput
							input={input}
							setInput={setInput}
							onSubmit={(request: WingmanRequest) => handleSubmit(request)}
							isThinking={isThinking || isExecutingTool || isCompacting}
						/>
					)}
					{/* Only show StatusBar if we have enough space */}
					{!layout.isCompact && <StatusBar />}
				</Box>
			</Box>
		</Box>
	);
};

export default UI;