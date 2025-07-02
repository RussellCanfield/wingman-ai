import type React from "react";
import { Box, Text } from "ink";

interface TerminalSizeWarningProps {
  message: string;
  isError?: boolean;
}

const TerminalSizeWarning: React.FC<TerminalSizeWarningProps> = ({
  message,
  isError = false,
}) => {
  return (
    <Box
      borderStyle="round"
      borderColor={isError ? "red" : "yellow"}
      padding={1}
      marginY={1}
    >
      <Text color={isError ? "red" : "yellow"}>
        {isError ? "⚠️  " : "ℹ️  "}
        {message}
      </Text>
    </Box>
  );
};

export default TerminalSizeWarning;
