export interface Command {
	id: string;
	label: string;
	description: string;
}

export interface CommandDropdownProps {
	isVisible: boolean;
	position: {
		top: number;
		left: number;
	};
	commands: Command[];
	onCommandSelect: (command: Command) => void;
}

export const AVAILABLE_COMMANDS: Command[] = [
	{
		id: "review",
		label: "/review",
		description: "Start a code review session",
	},
];
