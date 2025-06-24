import { useContext } from "react";
import {
	WingmanContext,
	type WingmanContextType,
} from "../contexts/WingmanContext";

export const useWingman = (): WingmanContextType => {
	const context = useContext(WingmanContext);
	if (context === undefined) {
		throw new Error("useWingman must be used within a WingmanProvider");
	}
	return context;
};
