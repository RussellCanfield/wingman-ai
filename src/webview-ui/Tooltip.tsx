import { PropsWithChildren } from "react";
import styled from "styled-components";

const TooltipStyle = styled.div`
	.tooltip {
		position: relative;
		display: inline-block;
		border-bottom: 1px dotted black;
	}

	.tooltip .tooltiptext {
		visibility: hidden;
		width: auto;
		background-color: black;
		color: #fff;
		text-align: center;
		border-radius: 6px;
		padding: 5px 0;

		/* Position the tooltip */
		position: absolute;
		z-index: 100;
		top: 100%;
		left: 50%;
		margin-left: -60px;
	}

	.tooltip:hover .tooltiptext {
		visibility: visible;
	}
`;

const Tooltip = ({
	children,
	tooltip,
}: PropsWithChildren & { tooltip: string }) => {
	return (
		<TooltipStyle>
			<div className="tooltip">
				{children}
				<span className="tooltiptext">{tooltip}</span>
			</div>
		</TooltipStyle>
	);
};

export default Tooltip;
