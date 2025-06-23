//@ts-nocheck
import { DiffType, LineInformation } from "./compute-lines";
import { ReactElement } from "react";

interface Block {
	index: number;
	startLine: number;
	endLine: number;
	lines: number;
}
interface HiddenBlocks {
	lineBlocks: Record<number, number>;
	blocks: Block[];
}
export function computeHiddenBlocks(
	lineInformation: LineInformation[],
	diffLines: number[],
	extraLines: number
): HiddenBlocks {
	let newBlockIndex = 0;
	let currentBlock: Block | undefined;
	let lineBlocks: Record<number, number> = {};
	let blocks: Block[] = [];
	lineInformation.forEach((line, lineIndex) => {
		const isDiffLine = diffLines.some(
			(diffLine) =>
				diffLine >= lineIndex - extraLines &&
				diffLine <= lineIndex + extraLines
		);
		if (!isDiffLine && currentBlock == undefined) {
			// block begins
			currentBlock = {
				index: newBlockIndex,
				startLine: lineIndex,
				endLine: lineIndex,
				lines: 1,
			};
			blocks.push(currentBlock);
			lineBlocks[lineIndex] = currentBlock.index;
			newBlockIndex++;
		} else if (!isDiffLine) {
			// block continues
			currentBlock!.endLine = lineIndex;
			currentBlock!.lines++;
			lineBlocks[lineIndex] = currentBlock.index;
		} else {
			// not a block anymore
			currentBlock = undefined;
		}
	});

	return {
		lineBlocks,
		blocks: blocks,
	};
}
