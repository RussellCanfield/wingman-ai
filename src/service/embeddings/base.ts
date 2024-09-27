export interface EmbeddingsInterface {
	/**
	 * An abstract method that takes an array of documents as input and
	 * returns a promise that resolves to an array of vectors for each
	 * document.
	 * @param documents An array of documents to be embedded.
	 * @returns A promise that resolves to an array of vectors for each document.
	 */
	embedDocuments(documents: string[]): Promise<number[][]>;
	/**
	 * An abstract method that takes a single document as input and returns a
	 * promise that resolves to a vector for the query document.
	 * @param document A single document to be embedded.
	 * @returns A promise that resolves to a vector for the query document.
	 */
	embedQuery(document: string): Promise<number[]>;
}
