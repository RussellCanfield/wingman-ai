import { describe, expect, test } from "vitest";
import { buildTrayActions } from "./trayMenu.js";

describe("tray actions", () => {
	test("switches recording and overlay labels based on current state", () => {
		const actions = buildTrayActions({
			connected: true,
			recording: true,
			overlayVisible: false,
		});

		expect(actions[0].label).toBe("Stop Recording");
		expect(actions[1].label).toBe("Show Overlay");
	});

	test("disables gateway UI action when not connected", () => {
		const actions = buildTrayActions({
			connected: false,
			recording: false,
			overlayVisible: true,
		});

		const openGatewayUi = actions.find((action) => action.id === "open-gateway-ui");
		expect(openGatewayUi).toBeDefined();
		expect(openGatewayUi?.enabled).toBe(false);
	});
});
