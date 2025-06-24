import type React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface Props {
	input: string;
	setInput: (value: string) => void;
	onSubmit: (value: string) => void;
	isThinking: boolean;
}

const UserInput: React.FC<Props> = ({
	input,
	setInput,
	onSubmit,
	isThinking,
}) => {
	return (
		<Box borderStyle="round" borderColor="gray" paddingX={1}>
			<TextInput
				value={input}
				onChange={setInput}
				onSubmit={onSubmit}
				placeholder={isThinking ? "Please wait..." : ""}
			/>
		</Box>
	);
};

export default UserInput;
