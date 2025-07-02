import type React from "react";
import { Box, Text } from "ink";

interface CompactHeaderProps {
  showFullHeader: boolean;
}

const CompactHeader: React.FC<CompactHeaderProps> = ({ showFullHeader }) => {
  if (showFullHeader) {
    // Full ASCII art header
    return (
      <Box flexDirection="column">
        <Box>
          <Text>{`
██╗    ██╗██╗███╗   ██╗ ██████╗ ███╗   ███╗ █████╗ ███╗   ██╗
██║    ██║██║████╗  ██║██╔════╝ ████╗ ████║██╔══██╗████╗  ██║
██║ █╗ ██║██║██╔██╗ ██║██║  ███╗██╔████╔██║███████║██╔██╗ ██║
██║███╗██║██║██║╚██╗██║██║   ██║██║╚██╔╝██║██╔══██║██║╚██╗██║
╚███╔███╔╝██║██║ ╚████║╚██████╔╝██║ ╚═╝ ██║██║  ██║██║ ╚████║
 ╚══╝╚══╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝
          `}</Text>
        </Box>
        <Box>
          <Text color="blue">Your AI-powered partner</Text>
        </Box>
      </Box>
    );
  }

  // Compact header for small terminals
  return (
    <Box>
      <Text color="blue" bold>
        🤖 Wingman AI
      </Text>
    </Box>
  );
};

export default CompactHeader;
