import type { FileDiagnostic } from "@shared/types/Composer";

export interface DiagnosticRetriever {
	getFileDiagnostics(filePaths: string[]): Promise<FileDiagnostic[]>;
}
