import { useEffect, useState } from "react";
import { vscode } from "../../utilities/vscode";
import { FaCheck, FaSpinner, FaTerminal } from "react-icons/fa6";
import { MdOutlineCancel } from "react-icons/md";
import { AppMessage } from "@shared/types/Message";

const Validation = () => {
	const [success, setSuccess] = useState(false);
	const [validating, setValidating] = useState(false);

	useEffect(() => {
		window.addEventListener("message", handleResponse);

		return () => {
			window.removeEventListener("message", handleResponse);
		};
	}, []);

	const handleResponse = (event: MessageEvent<AppMessage>) => {
		const { data } = event;
		const { command, value } = data;

		switch (command) {
			case "validation-success":
				setSuccess(true);
				break;
		}
	};

	const cancelValidation = () => {
		setValidating(false);
		vscode.postMessage({
			command: "cancel-validate",
		});
	};

	const validate = () => {
		setValidating(true);
		vscode.postMessage({
			command: "validate",
		});
	};

	return (
		<div className="pl-[48px] pr-[16px]">
			<div className="border rounded-lg overflow-hidden shadow-lg mb-4 mt-4 bg-editor-bg/30 bg-stone-800/50 text-white flex items-center border-b border-stone-700/50 justify-between">
				<h4 className="m-0 min-w-0 p-3 font-medium truncate">
					Validate
				</h4>
				<div className="flex space-x-2 bg-stone-700 text-white rounded z-10 items-center">
					{success && (
						<div className="text-green-600 p-4">
							<FaCheck size={18} />
						</div>
					)}
					{!success && !validating && (
						<button
							type="button"
							title="Validate change"
							className="p-4 hover:bg-stone-500 hover:cursor-pointer"
							onClick={() => validate()}
						>
							<FaTerminal size={16} />
						</button>
					)}
					{!success && validating && (
						<>
							<FaSpinner className="animate-spin-slow h-5 w-5 text-gray-500" />
							<button
								type="button"
								title="Cancel validation"
								className="p-4 hover:bg-stone-500 hover:cursor-pointer"
								onClick={() => cancelValidation()}
							>
								<MdOutlineCancel size={18} />
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
};

export default Validation;
