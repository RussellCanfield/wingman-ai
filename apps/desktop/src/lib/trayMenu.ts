export type TrayActionId =
	| "toggle-recording"
	| "toggle-overlay"
	| "open-gateway-ui"
	| "open-settings"
	| "quit";

export type TrayContext = {
	connected: boolean;
	recording: boolean;
	overlayVisible: boolean;
};

export type TrayAction = {
	id: TrayActionId;
	label: string;
	enabled: boolean;
};

export function buildTrayActions(context: TrayContext): TrayAction[] {
	return [
		{
			id: "toggle-recording",
			label: context.recording ? "Stop Recording" : "Start Recording",
			enabled: true,
		},
		{
			id: "toggle-overlay",
			label: context.overlayVisible ? "Hide Overlay" : "Show Overlay",
			enabled: true,
		},
		{
			id: "open-gateway-ui",
			label: "Open Gateway UI",
			enabled: context.connected,
		},
		{
			id: "open-settings",
			label: "Settings...",
			enabled: true,
		},
		{
			id: "quit",
			label: "Quit Wingman AI",
			enabled: true,
		},
	];
}
