//@ts-nocheck
import * as React from "react";
import * as PropTypes from "prop-types";
import cn from "classnames";

import {
	computeLineInformation,
	DiffInformation,
	DiffMethod,
	DiffType,
	LineInformation,
} from "./compute-lines";
import computeStyles, {
	type ReactDiffViewerStyles,
	type ReactDiffViewerStylesOverride,
} from "./styles";
import { ReactElement } from "react";
import { computeHiddenBlocks } from "./compute-hidden-blocks";

const m = require("memoize-one");

const memoize = m.default || m;

export enum LineNumberPrefix {
	LEFT = "L",
	RIGHT = "R",
}

export interface ReactDiffViewerProps {
	// Old value to compare.
	oldValue: string | Object;
	// New value to compare.
	newValue: string | Object;
	// Enable/Disable split view.
	splitView?: boolean;
	// Set line Offset
	linesOffset?: number;
	// Enable/Disable word diff.
	disableWordDiff?: boolean;
	// JsDiff text diff method from https://github.com/kpdecker/jsdiff/tree/v4.0.1#api
	compareMethod?: DiffMethod;
	// Number of unmodified lines surrounding each line diff.
	extraLinesSurroundingDiff?: number;
	// Show/hide line number.
	hideLineNumbers?: boolean;
	// Show/hide `+`/`-` markers.
	hideMarkers?: boolean;
	/**
	 * Show the lines indicated here. Specified as L20 or R18 for respectively line 20 on the left or line 18 on the right.
	 */
	alwaysShowLines?: string[];
	// Show only diff between the two values.
	showDiffOnly?: boolean;
	// Render prop to format final string before displaying them in the UI.
	renderContent?: (source: string) => ReactElement;
	// Render prop to format code fold message.
	codeFoldMessageRenderer?: (
		totalFoldedLines: number,
		leftStartLineNumber: number,
		rightStartLineNumber: number
	) => ReactElement;
	// Event handler for line number click.
	onLineNumberClick?: (
		lineId: string,
		event: React.MouseEvent<HTMLTableCellElement>
	) => void;
	// render gutter
	renderGutter?: (data: {
		lineNumber: number;
		type: DiffType;
		prefix: LineNumberPrefix;
		value: string | DiffInformation[];
		additionalLineNumber: number;
		additionalPrefix: LineNumberPrefix;
		styles: ReactDiffViewerStyles;
	}) => ReactElement;
	onLineRender?: (lineNumber: number) => ReactNode;
	// Array of line ids to highlight lines.
	highlightLines?: string[];
	// Style overrides.
	styles?: ReactDiffViewerStylesOverride;
	// Use dark theme.
	useDarkTheme?: boolean;
	// Title for left column
	leftTitle?: string | ReactElement;
	// Title for left column
	rightTitle?: string | ReactElement;
	// Nonce
	nonce?: string;
}

export interface ReactDiffViewerState {
	// Array holding the expanded code folding.
	expandedBlocks?: number[];
}

class DiffViewer extends React.Component<
	ReactDiffViewerProps,
	ReactDiffViewerState
> {
	private styles: ReactDiffViewerStyles;

	public static defaultProps: ReactDiffViewerProps = {
		oldValue: "",
		newValue: "",
		splitView: true,
		highlightLines: [],
		disableWordDiff: false,
		compareMethod: DiffMethod.CHARS,
		styles: {},
		hideLineNumbers: false,
		hideMarkers: false,
		extraLinesSurroundingDiff: 3,
		showDiffOnly: true,
		useDarkTheme: false,
		linesOffset: 0,
		nonce: "",
	};

	public constructor(props: ReactDiffViewerProps) {
		super(props);

		this.state = {
			expandedBlocks: [],
		};
	}

	/**
	 * Resets code block expand to the initial stage. Will be exposed to the parent component via
	 * refs.
	 */
	public resetCodeBlocks = (): boolean => {
		if (this.state.expandedBlocks.length > 0) {
			this.setState({
				expandedBlocks: [],
			});
			return true;
		}
		return false;
	};

	/**
	 * Pushes the target expanded code block to the state. During the re-render,
	 * this value is used to expand/fold unmodified code.
	 */
	private onBlockExpand = (id: number): void => {
		const prevState = this.state.expandedBlocks.slice();
		prevState.push(id);

		this.setState({
			expandedBlocks: prevState,
		});
	};

	/**
	 * Computes final styles for the diff viewer. It combines the default styles with the user
	 * supplied overrides. The computed styles are cached with performance in mind.
	 *
	 * @param styles User supplied style overrides.
	 */
	private computeStyles: (
		styles: ReactDiffViewerStylesOverride,
		useDarkTheme: boolean,
		nonce: string
	) => ReactDiffViewerStyles = memoize(computeStyles);

	/**
	 * Returns a function with clicked line number in the closure. Returns an no-op function when no
	 * onLineNumberClick handler is supplied.
	 *
	 * @param id Line id of a line.
	 */
	private onLineNumberClickProxy = (id: string): any => {
		if (this.props.onLineNumberClick) {
			return (e: any): void => this.props.onLineNumberClick(id, e);
		}
		return (): void => {};
	};

	/**
	 * Maps over the word diff and constructs the required React elements to show word diff.
	 *
	 * @param diffArray Word diff information derived from line information.
	 * @param renderer Optional renderer to format diff words. Useful for syntax highlighting.
	 */
	private renderWordDiff = (
		diffArray: DiffInformation[],
		renderer?: (chunk: string) => JSX.Element
	): ReactElement[] => {
		return diffArray.map((wordDiff, i): JSX.Element => {
			return (
				<span
					key={i}
					className={cn(this.styles.wordDiff, {
						[this.styles.wordAdded]:
							wordDiff.type === DiffType.ADDED,
						[this.styles.wordRemoved]:
							wordDiff.type === DiffType.REMOVED,
					})}
				>
					{renderer
						? renderer(wordDiff.value as string)
						: wordDiff.value}
				</span>
			);
		});
	};

	/**
	 * Maps over the line diff and constructs the required react elements to show line diff. It calls
	 * renderWordDiff when encountering word diff. This takes care of both inline and split view line
	 * renders.
	 *
	 * @param lineNumber Line number of the current line.
	 * @param type Type of diff of the current line.
	 * @param prefix Unique id to prefix with the line numbers.
	 * @param value Content of the line. It can be a string or a word diff array.
	 * @param additionalLineNumber Additional line number to be shown. Useful for rendering inline
	 *  diff view. Right line number will be passed as additionalLineNumber.
	 * @param additionalPrefix Similar to prefix but for additional line number.
	 */
	private renderLine = (
		lineNumber: number,
		type: DiffType,
		prefix: LineNumberPrefix,
		value: string | DiffInformation[],
		additionalLineNumber?: number,
		additionalPrefix?: LineNumberPrefix
	): ReactElement => {
		const lineNumberTemplate = `${prefix}-${lineNumber}`;
		const additionalLineNumberTemplate = `${additionalPrefix}-${additionalLineNumber}`;
		const highlightLine =
			this.props.highlightLines.includes(lineNumberTemplate) ||
			this.props.highlightLines.includes(additionalLineNumberTemplate);
		const added = type === DiffType.ADDED;
		const removed = type === DiffType.REMOVED;
		const changed = type === DiffType.CHANGED;
		let content;
		if (Array.isArray(value)) {
			content = this.renderWordDiff(value, this.props.renderContent);
		} else if (this.props.renderContent) {
			content = this.props.renderContent(value);
		} else {
			content = value;
		}

		return (
			<React.Fragment>
				{!this.props.hideLineNumbers && (
					<td
						onClick={
							lineNumber &&
							this.onLineNumberClickProxy(lineNumberTemplate)
						}
						className={cn(this.styles.gutter, {
							[this.styles.emptyGutter]: !lineNumber,
							[this.styles.diffAdded]: added,
							[this.styles.diffRemoved]: removed,
							[this.styles.diffChanged]: changed,
							[this.styles.highlightedGutter]: highlightLine,
						})}
					>
						<pre className={this.styles.lineNumber}>
							{lineNumber}
						</pre>
					</td>
				)}
				{!this.props.splitView && !this.props.hideLineNumbers && (
					<td
						onClick={
							additionalLineNumber &&
							this.onLineNumberClickProxy(
								additionalLineNumberTemplate
							)
						}
						className={cn(this.styles.gutter, {
							[this.styles.emptyGutter]: !additionalLineNumber,
							[this.styles.diffAdded]: added,
							[this.styles.diffRemoved]: removed,
							[this.styles.diffChanged]: changed,
							[this.styles.highlightedGutter]: highlightLine,
						})}
					>
						<pre className={this.styles.lineNumber}>
							{additionalLineNumber}
						</pre>
					</td>
				)}
				{this.props.renderGutter
					? this.props.renderGutter({
							lineNumber,
							type,
							prefix,
							value,
							additionalLineNumber,
							additionalPrefix,
							styles: this.styles,
					  })
					: null}
				{!this.props.hideMarkers && (
					<td
						className={cn(this.styles.marker, {
							[this.styles.emptyLine]: !content,
							[this.styles.diffAdded]: added,
							[this.styles.diffRemoved]: removed,
							[this.styles.diffChanged]: changed,
							[this.styles.highlightedLine]: highlightLine,
						})}
					>
						<pre>
							{added && "+"}
							{removed && "-"}
						</pre>
					</td>
				)}
				<td
					className={cn(this.styles.content, {
						[this.styles.emptyLine]: !content,
						[this.styles.diffAdded]: added,
						[this.styles.diffRemoved]: removed,
						[this.styles.diffChanged]: changed,
						[this.styles.highlightedLine]: highlightLine,
					})}
				>
					<pre className={this.styles.contentText}>{content}</pre>
				</td>
			</React.Fragment>
		);
	};

	/**
	 * Generates lines for split view.
	 *
	 * @param obj Line diff information.
	 * @param obj.left Life diff information for the left pane of the split view.
	 * @param obj.right Life diff information for the right pane of the split view.
	 * @param index React key for the lines.
	 */
	private renderSplitView = (
		{ left, right }: LineInformation,
		index: number
	): ReactElement => {
		return (
			<tr key={index} className={this.styles.line}>
				{this.renderLine(
					left.lineNumber,
					left.type,
					LineNumberPrefix.LEFT,
					left.value
				)}
				{this.renderLine(
					right.lineNumber,
					right.type,
					LineNumberPrefix.RIGHT,
					right.value
				)}
			</tr>
		);
	};

	/**
	 * Generates lines for inline view.
	 *
	 * @param obj Line diff information.
	 * @param obj.left Life diff information for the added section of the inline view.
	 * @param obj.right Life diff information for the removed section of the inline view.
	 * @param index React key for the lines.
	 */
	public renderInlineView = (
		{ left, right }: LineInformation,
		index: number
	): ReactElement => {
		let content;
		if (left.type === DiffType.REMOVED && right.type === DiffType.ADDED) {
			return (
				<React.Fragment key={index}>
					<tr className={this.styles.line}>
						{this.renderLine(
							left.lineNumber,
							left.type,
							LineNumberPrefix.LEFT,
							left.value,
							null
						)}
					</tr>
					<tr className={this.styles.line}>
						{this.renderLine(
							right?.lineNumber,
							right.type,
							LineNumberPrefix.RIGHT,
							right.value,
							right.lineNumber
						)}
					</tr>
					{!this.props.onLineRender ? null : (
						<tr
							key={`${index}-render`}
							className={this.styles.line}
						>
							<td colSpan="4" style={{ width: "100%" }}>
								{this.props.onLineRender(right?.lineNumber)}
							</td>
						</tr>
					)}
				</React.Fragment>
			);
		}
		if (left.type === DiffType.REMOVED) {
			content = this.renderLine(
				left.lineNumber,
				left.type,
				LineNumberPrefix.LEFT,
				left.value,
				null
			);
		}
		if (left.type === DiffType.DEFAULT) {
			content = this.renderLine(
				left.lineNumber,
				left.type,
				LineNumberPrefix.LEFT,
				left.value,
				right.lineNumber,
				LineNumberPrefix.RIGHT
			);
		}
		if (right.type === DiffType.ADDED) {
			content = this.renderLine(
				right?.lineNumber,
				right.type,
				LineNumberPrefix.RIGHT,
				right.value,
				right.lineNumber
			);
		}

		return (
			<>
				<tr key={index} className={this.styles.line}>
					{content}
				</tr>
				{!this.props.onLineRender ? null : (
					<tr key={`${index}-render`} className={this.styles.line}>
						<td colSpan="4" style={{ width: "100%" }}>
							{this.props.onLineRender(right?.lineNumber)}
						</td>
					</tr>
				)}
			</>
		);
	};

	/**
	 * Returns a function with clicked block number in the closure.
	 *
	 * @param id Cold fold block id.
	 */
	private onBlockClickProxy =
		(id: number): any =>
		(): void =>
			this.onBlockExpand(id);

	/**
	 * Generates cold fold block. It also uses the custom message renderer when available to show
	 * cold fold messages.
	 *
	 * @param num Number of skipped lines between two blocks.
	 * @param blockNumber Code fold block id.
	 * @param leftBlockLineNumber First left line number after the current code fold block.
	 * @param rightBlockLineNumber First right line number after the current code fold block.
	 */
	private renderSkippedLineIndicator = (
		num: number,
		blockNumber: number,
		leftBlockLineNumber: number,
		rightBlockLineNumber: number
	): ReactElement => {
		const { hideLineNumbers, splitView } = this.props;
		const message = this.props.codeFoldMessageRenderer ? (
			this.props.codeFoldMessageRenderer(
				num,
				leftBlockLineNumber,
				rightBlockLineNumber
			)
		) : (
			<pre className={this.styles.codeFoldContent}>
				Expand {num} lines ...
			</pre>
		);
		const content = (
			<td>
				<a onClick={this.onBlockClickProxy(blockNumber)} tabIndex={0}>
					{message}
				</a>
			</td>
		);
		const isUnifiedViewWithoutLineNumbers = !splitView && !hideLineNumbers;
		return (
			<tr
				key={`${leftBlockLineNumber}-${rightBlockLineNumber}`}
				className={this.styles.codeFold}
			>
				{!hideLineNumbers && (
					<td className={this.styles.codeFoldGutter} />
				)}
				{this.props.renderGutter ? (
					<td className={this.styles.codeFoldGutter} />
				) : null}
				<td
					className={cn({
						[this.styles.codeFoldGutter]:
							isUnifiedViewWithoutLineNumbers,
					})}
				/>

				{/* Swap columns only for unified view without line numbers */}
				{isUnifiedViewWithoutLineNumbers ? (
					<React.Fragment>
						<td />
						{content}
					</React.Fragment>
				) : (
					<React.Fragment>
						{content}
						{this.props.renderGutter ? <td /> : null}
						<td />
					</React.Fragment>
				)}

				<td />
				<td />
			</tr>
		);
	};

	/**
	 * Generates the entire diff view.
	 */
	private renderDiff = (): ReactElement[] => {
		const {
			oldValue,
			newValue,
			splitView,
			disableWordDiff,
			compareMethod,
			linesOffset,
			onLineRender,
		} = this.props;
		const { lineInformation, diffLines } = computeLineInformation(
			oldValue,
			newValue,
			disableWordDiff,
			compareMethod,
			linesOffset,
			this.props.alwaysShowLines
		);

		const extraLines =
			this.props.extraLinesSurroundingDiff < 0
				? 0
				: Math.round(this.props.extraLinesSurroundingDiff);

		const { lineBlocks, blocks } = computeHiddenBlocks(
			lineInformation,
			diffLines,
			extraLines
		);

		return lineInformation.map(
			(line: LineInformation, lineIndex: number): ReactElement => {
				if (this.props.showDiffOnly) {
					const blockIndex = lineBlocks[lineIndex];

					if (blockIndex !== undefined) {
						const lastLineOfBlock =
							blocks[blockIndex].endLine === lineIndex;
						if (
							!this.state.expandedBlocks.includes(blockIndex) &&
							lastLineOfBlock
						) {
							return (
								<React.Fragment key={lineIndex}>
									{this.renderSkippedLineIndicator(
										blocks[blockIndex].lines,
										blockIndex,
										line.left.lineNumber,
										line.right.lineNumber
									)}
								</React.Fragment>
							);
						} else if (
							!this.state.expandedBlocks.includes(blockIndex)
						) {
							return null;
						}
					}
				}

				const diffNodes = splitView
					? this.renderSplitView(line, lineIndex)
					: this.renderInlineView(line, lineIndex);

				return diffNodes;
			}
		);
	};

	public render = (): ReactElement => {
		const {
			oldValue,
			newValue,
			useDarkTheme,
			leftTitle,
			rightTitle,
			splitView,
			hideLineNumbers,
			hideMarkers,
			nonce,
			onLineRender,
		} = this.props;

		if (this.props.compareMethod !== DiffMethod.JSON) {
			if (typeof oldValue !== "string" || typeof newValue !== "string") {
				throw Error('"oldValue" and "newValue" should be strings');
			}
		}

		this.styles = this.computeStyles(
			this.props.styles,
			useDarkTheme,
			nonce
		);
		const nodes = this.renderDiff();
		let colSpanOnSplitView = hideLineNumbers ? 2 : 3;
		let colSpanOnInlineView = hideLineNumbers ? 2 : 4;

		if (hideMarkers) {
			colSpanOnSplitView -= 1;
			colSpanOnInlineView -= 1;
		}

		const columnExtension = this.props.renderGutter ? 1 : 0;

		const title = (leftTitle || rightTitle) && (
			<tr>
				<td
					colSpan={
						(splitView ? colSpanOnSplitView : colSpanOnInlineView) +
						columnExtension
					}
					className={this.styles.titleBlock}
				>
					<pre className={this.styles.contentText}>{leftTitle}</pre>
				</td>
				{splitView && (
					<td
						colSpan={colSpanOnSplitView + columnExtension}
						className={this.styles.titleBlock}
					>
						<pre className={this.styles.contentText}>
							{rightTitle}
						</pre>
					</td>
				)}
			</tr>
		);

		return (
			<table
				className={cn(this.styles.diffContainer, {
					[this.styles.splitView]: splitView,
				})}
			>
				<tbody>
					{title}
					{nodes}
				</tbody>
			</table>
		);
	};
}

export default DiffViewer;
export { ReactDiffViewerStylesOverride, DiffMethod };
