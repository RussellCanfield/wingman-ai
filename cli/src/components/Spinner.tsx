import { Text } from "ink";
import Spinner from "ink-spinner";

interface Props {
	status: "Thinking" | "ExecutingTool";
}

const CustomSpinner: React.FC<Props> = ({ status }) => {
	const text = status === "Thinking" ? "Thinking..." : "Executing tool...";

	return (
		<Text>
			<Text color="green">
				<Spinner type="dots" />
			</Text>
			{` ${text}`}
		</Text>
	);
};

export default CustomSpinner;
