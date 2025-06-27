import React, { useEffect } from 'react';
import { Text, Box } from 'ink';

const ProgressBar = ({
    value = 0,
    max = 100,
    width = 20,
    completeChar = '█',
    incompleteChar = '░',
    showPercentage = true,
    showValue = false,
    color = 'green',
    backgroundColor = 'gray',
    label = '',
}) => {
    // Ensure value is within bounds
    const clampedValue = Math.max(0, Math.min(value, max));
    const percentage = Math.round((clampedValue / max) * 100);
    const completedWidth = Math.round((clampedValue / max) * width);
    const remainingWidth = width - completedWidth;

    const completedBar = completeChar.repeat(completedWidth);
    const incompleteBar = incompleteChar.repeat(remainingWidth);

    return (
        <Box flexDirection="row" alignItems="center">
            {label && (
                <Box marginRight={1}>
                    <Text>{label}</Text>
                </Box>
            )}

            <Box>
                <Text color={color}>{completedBar}</Text>
                <Text color={backgroundColor}>{incompleteBar}</Text>
            </Box>

            {showPercentage && (
                <Box marginLeft={1}>
                    <Text>{percentage}%</Text>
                </Box>
            )}

            {showValue && (
                <Box marginLeft={1}>
                    <Text>({clampedValue}/{max})</Text>
                </Box>
            )}
        </Box>
    );
};

// Animated progress bar that smoothly transitions
const AnimatedProgressBar = ({
    value = 0,
    max = 100,
    width = 20,
    completeChar = '█',
    incompleteChar = '░',
    showPercentage = true,
    showValue = false,
    color = 'green',
    backgroundColor = 'gray',
    label = '',
    animationSpeed = 100, // milliseconds between updates
}) => {
    const [currentValue, setCurrentValue] = React.useState(0);

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    useEffect(() => {
        if (currentValue === value) return;

        const timer = setInterval(() => {
            setCurrentValue(prev => {
                const diff = value - prev;
                const step = Math.sign(diff) * Math.max(1, Math.abs(diff) * 0.1);
                const next = prev + step;

                if (Math.abs(value - next) < 1) {
                    return value;
                }
                return next;
            });
        }, animationSpeed);

        return () => clearInterval(timer);
    }, [value, animationSpeed]);

    return (
        <ProgressBar
            value={currentValue}
            max={max}
            width={width}
            completeChar={completeChar}
            incompleteChar={incompleteChar}
            showPercentage={showPercentage}
            showValue={showValue}
            color={color}
            backgroundColor={backgroundColor}
            label={label}
        />
    );
};

// Multi-bar progress component
const MultiProgressBar = ({ bars = [] }: { bars: any[] }) => {
    return (
        <Box flexDirection="column">
            {bars.map((bar: any, index: number) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                <Box key={index} marginBottom={index < bars.length - 1 ? 1 : 0}>
                    <ProgressBar {...bar} />
                </Box>
            ))}
        </Box>
    );
};

// Usage examples:
const ProgressBarExamples = () => {
    const [progress, setProgress] = React.useState(0);

    React.useEffect(() => {
        const timer = setInterval(() => {
            setProgress(prev => (prev >= 100 ? 0 : prev + 1));
        }, 100);

        return () => clearInterval(timer);
    }, []);

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold>Progress Bar Examples:</Text>
            <Box marginTop={1} />

            {/* Basic progress bar */}
            <ProgressBar
                value={progress}
                label="Basic:"
                width={30}
            />

            <Box marginTop={1} />

            {/* Custom styled progress bar */}
            <ProgressBar
                value={progress}
                label="Custom:"
                width={25}
                completeChar="▓"
                incompleteChar="▒"
                color="cyan"
                backgroundColor="darkGray"
                showValue={true}
            />

            <Box marginTop={1} />

            {/* Animated progress bar */}
            <AnimatedProgressBar
                value={progress}
                label="Animated:"
                width={20}
                color="magenta"
            />

            <Box marginTop={1} />

            {/* Multi-progress bars */}
            <MultiProgressBar
                bars={[
                    { value: progress * 0.8, label: 'Task 1:', color: 'red', width: 15 },
                    { value: progress * 0.6, label: 'Task 2:', color: 'yellow', width: 15 },
                    { value: progress * 0.4, label: 'Task 3:', color: 'blue', width: 15 },
                ]}
            />
        </Box>
    );
};

export { ProgressBar, AnimatedProgressBar, MultiProgressBar, ProgressBarExamples };
export default ProgressBar;