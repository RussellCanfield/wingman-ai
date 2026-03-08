import type React from "react";

export type IconProps = {
	className?: string;
};

export function WingmanMark({
	className = "h-9 w-9",
}: IconProps): React.JSX.Element {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 40 40"
			className={className}
			fill="none"
		>
			<rect
				x="2"
				y="2"
				width="36"
				height="36"
				rx="13"
				fill="url(#wingman-mark-fill)"
			/>
			<path
				d="M11.5 12.5 16.2 27.5 20 18.9l3.8 8.6 4.7-15"
				stroke="white"
				strokeWidth="2.6"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<defs>
				<linearGradient
					id="wingman-mark-fill"
					x1="6"
					y1="6"
					x2="34"
					y2="34"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#38BDF8" />
					<stop offset="1" stopColor="#2563EB" />
				</linearGradient>
			</defs>
		</svg>
	);
}

function createStrokeIcon(
	path: React.ReactNode,
	className: string,
	viewBox = "0 0 24 24",
) {
	return (
		<svg
			aria-hidden="true"
			viewBox={viewBox}
			className={className}
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{path}
		</svg>
	);
}

export function MenuIcon({ className = "h-4 w-4" }: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<>
			<path d="M4 7h16" />
			<path d="M4 12h16" />
			<path d="M4 17h16" />
		</>,
		className,
	);
}

export function CloseIcon({
	className = "h-4 w-4",
}: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<>
			<path d="m6 6 12 12" />
			<path d="M18 6 6 18" />
		</>,
		className,
	);
}

export function SettingsIcon({
	className = "h-4 w-4",
}: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<>
			<path d="M12 3v3" />
			<path d="M12 18v3" />
			<path d="m4.93 4.93 2.12 2.12" />
			<path d="m16.95 16.95 2.12 2.12" />
			<path d="M3 12h3" />
			<path d="M18 12h3" />
			<path d="m4.93 19.07 2.12-2.12" />
			<path d="m16.95 7.05 2.12-2.12" />
			<circle cx="12" cy="12" r="3.25" />
		</>,
		className,
	);
}

export function AgentsIcon({
	className = "h-4 w-4",
}: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<>
			<path d="M8 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
			<path d="M16.5 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
			<path d="M3.5 19a5.5 5.5 0 0 1 9 0" />
			<path d="M14 18.5a4.5 4.5 0 0 1 6.5-1.5" />
		</>,
		className,
	);
}

export function RuntimeIcon({
	className = "h-4 w-4",
}: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<>
			<rect x="4" y="5" width="16" height="14" rx="3" />
			<path d="M8 9h8" />
			<path d="M8 13h5" />
			<path d="M16.5 13h.5" />
		</>,
		className,
	);
}

export function EventsIcon({
	className = "h-4 w-4",
}: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<>
			<path d="M4 13h3l2-5 4 10 2-5h5" />
		</>,
		className,
	);
}

export function DocsIcon({ className = "h-4 w-4" }: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<>
			<path d="M7 4.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z" />
			<path d="M15 4.5V9h4" />
			<path d="M9 13h6" />
			<path d="M9 16h6" />
		</>,
		className,
	);
}

export function TrashIcon({
	className = "h-4 w-4",
}: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<>
			<path d="M4 7h16" />
			<path d="M9 7V4.5h6V7" />
			<path d="M7 7.5 8 19a2 2 0 0 0 2 1.8h4a2 2 0 0 0 2-1.8l1-11.5" />
			<path d="M10 11.5v5" />
			<path d="M14 11.5v5" />
		</>,
		className,
	);
}

export function MicIcon({ className = "h-4 w-4" }: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<>
			<rect x="9" y="3" width="6" height="11" rx="3" />
			<path d="M5 11a7 7 0 0 0 14 0" />
			<path d="M12 18v3" />
			<path d="M8 21h8" />
		</>,
		className,
	);
}

export function SpeakerIcon({
	className = "h-4 w-4",
}: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<>
			<path d="M11 5 6 9H3v6h3l5 4V5Z" />
			<path d="M15 9a4 4 0 0 1 0 6" />
			<path d="M18 7a7 7 0 0 1 0 10" />
		</>,
		className,
	);
}

export function AttachmentIcon({
	className = "h-4 w-4",
}: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<path d="M21.44 11.05 12.25 20.24a6 6 0 1 1-8.49-8.49L12.95 2.56a4 4 0 1 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.82-2.82l8.48-8.48" />,
		className,
	);
}

export function SendIcon({
	className = "h-4 w-4",
}: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<>
			<path d="m22 2-7 20-4-9-9-4 20-7Z" />
			<path d="M22 2 11 13" />
		</>,
		className,
	);
}

export function PlusIcon({ className = "h-4 w-4" }: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<>
			<path d="M12 5v14" />
			<path d="M5 12h14" />
		</>,
		className,
	);
}

export function RefreshIcon({
	className = "h-4 w-4",
}: IconProps): React.JSX.Element {
	return createStrokeIcon(
		<>
			<path d="M20 12a8 8 0 1 1-2.34-5.66" />
			<path d="M20 4v6h-6" />
		</>,
		className,
	);
}

export function ChevronDownIcon({
	className = "h-4 w-4",
}: IconProps): React.JSX.Element {
	return createStrokeIcon(<path d="m6 9 6 6 6-6" />, className);
}
