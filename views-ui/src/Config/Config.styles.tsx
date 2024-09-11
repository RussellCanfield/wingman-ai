import { PropsWithChildren } from "react";
import { VSCodeTextField as VSCodeTextFieldUI } from "@vscode/webview-ui-toolkit/react";

export const Container = ({ children }: PropsWithChildren) => (
	<div className="flex flex-col justify-center items-start gap-2">
		{children}
	</div>
);

export const DropDownContainer = ({ children }: PropsWithChildren) => (
	<div className="box-border flex flex-col items-start justify-start w-fit min-w-[300px]">
		{children}
	</div>
);

export const DropDownLabel = ({ children }: PropsWithChildren) => (
	<label className="block text-[var(--vscode-foreground)] cursor-pointer text-[var(--vscode-font-size)] leading-normal mb-0.5">
		{children}
	</label>
);

export const ActionPanel = ({ children }: PropsWithChildren) => (
	<div className="flex flex-row flex-nowrap gap-2 items-center">
		{children}
	</div>
);

export const VSCodeTextField = ({ ...props }) => (
	<VSCodeTextFieldUI className="min-w-[300px]" {...props} />
);
