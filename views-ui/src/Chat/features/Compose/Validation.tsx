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
		<div className="flex flex-col bg-editor-bg rounded-lg">
			<div className="border border-stone-700 rounded-lg overflow-hidden shadow-lg mb-4 mt-4">
				<div className="bg-stone-700 text-white flex flex-row items-center">
					<h4 className="m-0 flex-grow p-2 text-wrap break-all text-lg">
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
		</div>
	);
};

export default Validation;
