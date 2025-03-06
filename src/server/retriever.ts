/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import type {
	createConnection,
	DocumentSymbol,
	Location,
} from "vscode-languageserver/node";
import type { Position } from "vscode-languageserver-textdocument";
import type { FileDiagnostic } from "@shared/types/Composer";

export type TypeRequestEvent = {
	uri: string;
	position: Position;
};

export interface DiagnosticRetriever {
	getFileDiagnostics(filePaths: string[]): Promise<FileDiagnostic[]>;
}

export interface SymbolRetriever {
	getSymbols(documentUri: string): Promise<DocumentSymbol[]>;
	getDefinition(documentUri: string, position: Position): Promise<Location[]>;
	getTypeDefinition(
		documentUri: string,
		position: Position,
	): Promise<Location[]>;
}

export const createDiagnosticsRetriever = (
	connection: ReturnType<typeof createConnection>,
): DiagnosticRetriever => {
	return {
		getFileDiagnostics: async (filePaths: string[]) => {
			const diagnostics =
				(await connection.sendRequest<FileDiagnostic[]>(
					"wingman/provideFileDiagnostics",
					{ filePaths },
				)) || [];
			return diagnostics;
		},
	};
};

export const createSymbolRetriever = (
	connection: ReturnType<typeof createConnection>,
): SymbolRetriever => {
	return {
		getSymbols: async (documentUri: string) => {
			const symbols =
				(await connection.sendRequest<DocumentSymbol[]>(
					"wingman/provideDocumentSymbols",
					{
						uri: documentUri,
					},
				)) || [];
			return symbols;
		},
		getDefinition: async (documentUri: string, position: Position) => {
			const locations =
				(await connection.sendRequest<Location[]>("wingman/provideDefinition", {
					uri: documentUri,
					position: {
						line: position.line,
						character: position.character,
					} satisfies Position,
				} satisfies TypeRequestEvent)) || [];
			return locations;
		},
		getTypeDefinition: async (documentUri: string, position: Position) => {
			const locations =
				(await connection.sendRequest<Location[]>(
					"wingman/provideTypeDefiniton",
					{
						uri: documentUri,
						position: {
							line: position.line,
							character: position.character,
						} satisfies Position,
					} satisfies TypeRequestEvent,
				)) || [];
			return locations;
		},
	};
};
