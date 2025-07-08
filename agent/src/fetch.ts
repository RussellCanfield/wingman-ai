import fetch from "node-fetch";

//@ts-expect-error
globalThis.fetch = fetch;
