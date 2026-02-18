const SHELL_BASE_CLASS = "relative z-10 mx-auto max-w-screen-2xl px-6";

export function getWorkspaceShellClass(isChatRoute: boolean): string {
	return isChatRoute
		? `${SHELL_BASE_CLASS} pb-12 pt-8 lg:h-dvh lg:overflow-hidden`
		: `${SHELL_BASE_CLASS} pb-16 pt-8`;
}
