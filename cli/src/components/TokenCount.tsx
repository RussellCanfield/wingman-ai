import type React from "react";
import { Box, Text } from "ink";

interface TokenCountProps {
	count: number;
}

const TokenCount: React.FC<TokenCountProps> = ({ count }) => {
	return (
		<Box marginLeft={2}>
			<Text color="gray">({count} tokens)</Text>
		</Box>
	);
};

export default TokenCount;
