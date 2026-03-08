const SHELL_BASE_CLASS =
	"relative z-10 mx-auto h-dvh max-w-screen-2xl box-border overflow-hidden px-6 pb-12 pt-8";
const GRID_BASE_CLASS =
	"grid h-full min-h-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]";
const CONTENT_BASE_CLASS = "min-w-0 flex h-full min-h-0 flex-col overflow-hidden";
const VIEWPORT_BASE_CLASS = "min-h-0 flex-1 overflow-y-auto overflow-x-hidden";

export function getWorkspaceShellClass(): string {
	return SHELL_BASE_CLASS;
}

export function getWorkspaceGridClass(): string {
	return GRID_BASE_CLASS;
}

export function getWorkspaceContentClass(): string {
	return CONTENT_BASE_CLASS;
}

export function getWorkspaceViewportClass(): string {
	return VIEWPORT_BASE_CLASS;
}
