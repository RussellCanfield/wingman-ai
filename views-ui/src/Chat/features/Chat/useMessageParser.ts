import { useState, useEffect } from 'react';

interface ParsedMessage {
    mainContent: string;
    thinkingContent: string | null;
    isThinking: boolean;
}

export const useMessageParser = (message: string): ParsedMessage => {
    const [parsedMessage, setParsedMessage] = useState<ParsedMessage>({
        mainContent: '',
        thinkingContent: null,
        isThinking: false
    });

    useEffect(() => {
        // Check if we're in a thinking block
        const hasOpenThinkTag = message.includes('<think>');
        const hasCloseThinkTag = message.includes('</think>');

        // Handle streaming cases
        if (hasOpenThinkTag) {
            const parts = message.split('<think>');
            const mainContent = parts[0].trim();

            if (hasCloseThinkTag) {
                // Complete thinking block
                const thinkingPart = parts[1].split('</think>');
                setParsedMessage({
                    mainContent: mainContent + thinkingPart[1],
                    thinkingContent: thinkingPart[0],
                    isThinking: false
                });
            } else {
                // Still thinking
                setParsedMessage({
                    mainContent,
                    thinkingContent: parts[1],
                    isThinking: true
                });
            }
        } else {
            // No thinking tags
            setParsedMessage({
                mainContent: message,
                thinkingContent: null,
                isThinking: false
            });
        }
    }, [message]);

    return parsedMessage;
};