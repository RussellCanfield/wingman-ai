import { webCrawler } from "../src/tools/web_crawler";

async function testWebCrawler() {
	console.log("Testing web crawler...\n");

	try {
		// Test 1: Single page crawl
		console.log("Test 1: Crawling a single page (example.com)");
		const result1 = await webCrawler.invoke({
			url: "https://example.com",
			maxPages: 1,
		});
		console.log("Result:", result1.substring(0, 500), "...\n");

		// Test 2: Invalid URL
		console.log("Test 2: Testing invalid URL handling");
		const result2 = await webCrawler.invoke({
			url: "not-a-valid-url",
			maxPages: 1,
		});
		console.log("Result:", result2, "\n");

		console.log("All tests completed!");
	} catch (error) {
		console.error("Test failed:", error);
	}
}

testWebCrawler();
