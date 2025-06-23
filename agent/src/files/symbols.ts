import type { DocumentSymbol, Location, Position } from "vscode-languageserver";

export interface SymbolRetriever {
	getSymbols(documentUri: string): Promise<DocumentSymbol[]>;
	getDefinition(documentUri: string, position: Position): Promise<Location[]>;
	getTypeDefinition(
		documentUri: string,
		position: Position,
	): Promise<Location[]>;
}
