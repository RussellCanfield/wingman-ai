import React from "react";
import { Box, Text, useApp, useInput } from "ink";
import MessageList from "./components/MessageList";
import UserInput from "./components/UserInput";
import { wingmanArt } from "./art";
import { useWingman } from "./contexts/WingmanContext";
import StatusBar from "./components/StatusBar";
import type { WingmanRequest } from "@wingman-ai/agent";
import { Status } from "./contexts/types";
import { uiLogger, logInputEvent } from "./utils/logger";
import { Spinner } from "./components/Spinner";

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

	React.useEffect(() => {
		uiLogger.info({ event: "mount" }, "UI component mounted");

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
	}, [exit]);

	// Global input handler for all shortcuts
	useInput(
		React.useCallback(
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
						logInputEvent("context_toggle", { reason: "global_handler_ctrl_b" });
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
	React.useEffect(() => {
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
	React.useEffect(() => {
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

	return (
		<Box flexDirection="column" padding={1}>
			<Box>
				<Text>{wingmanArt}</Text>
			</Box>
			<Box>
				<Text color="blue">Your AI-powered partner</Text>
			</Box>
			<Box flexGrow={1} flexDirection="column" marginTop={1} overflow="hidden">
				<MessageList messages={messages} />
			</Box>
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
				<StatusBar />
			</Box>
		</Box>
	);
};

export default UI;
