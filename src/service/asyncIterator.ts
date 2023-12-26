export async function* asyncIterator(body: ReadableStream<Uint8Array>) {
	const reader = body.getReader();
	let next = await reader.read();
	while (!next.done) {
		yield next.value;
		next = await reader.read();
	}
}
