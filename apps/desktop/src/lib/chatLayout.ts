export function shouldShowThreadRail(pathname: string): boolean {
	return pathname === "/chat" || pathname.startsWith("/chat/");
}

