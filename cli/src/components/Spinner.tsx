import { useState, useEffect } from 'react';
import { Text } from 'ink';
import cliSpinners, { type SpinnerName } from 'cli-spinners';

export const Spinner = ({ type = 'dots' }: { type?: SpinnerName }) => {
	const [frame, setFrame] = useState(0);
	const spinner = cliSpinners[type];

	useEffect(() => {
		const timer = setInterval(() => {
			setFrame(prevFrame => (prevFrame + 1) % spinner.frames.length);
		}, spinner.interval);

		return () => clearInterval(timer);
	}, [spinner]);

	return <Text>{spinner.frames[frame]}</Text>;
};