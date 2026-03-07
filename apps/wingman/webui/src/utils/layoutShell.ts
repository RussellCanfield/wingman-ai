const SHELL_BASE_CLASS =
	"relative z-10 mx-auto max-w-screen-2xl box-border px-6";
const GRID_BASE_CLASS = "grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]";
const CONTENT_BASE_CLASS = "min-w-0";

export function getWorkspaceShellClass(isChatRoute: boolean): string {
	return isChatRoute
		? `${SHELL_BASE_CLASS} h-dvh overflow-hidden pb-12 pt-8`
		: `${SHELL_BASE_CLASS} pb-16 pt-8`;
}

export function getWorkspaceGridClass(isChatRoute: boolean): string {
	return isChatRoute ? `${GRID_BASE_CLASS} h-full min-h-0` : GRID_BASE_CLASS;
}

export function getWorkspaceContentClass(isChatRoute: boolean): string {
	return isChatRoute
		? `${CONTENT_BASE_CLASS} flex h-full min-h-0 flex-col overflow-hidden`
		: `${CONTENT_BASE_CLASS} space-y-6`;
}
