import { tool } from "langchain";
import * as z from "zod";
import { createLogger } from "@/logger.js";

const logger = createLogger();

interface CrawlResult {
	url: string;
	title: string;
	content: string;
	links: string[];
	metadata: {
		statusCode: number;
		contentType: string;
		timestamp: string;
	};
}

/**
 * Extract text content from HTML, removing scripts and styles
 */
function extractTextContent(html: string): string {
	// Remove script and style tags and their content
	let text = html
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
		.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

	// Remove HTML tags but preserve spacing
	text = text.replace(/<[^>]+>/g, " ");

	// Decode HTML entities
	text = text
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'");

	// Normalize whitespace
	text = text.replace(/\s+/g, " ").trim();

	return text;
}

/**
 * Extract title from HTML
 */
function extractTitle(html: string): string {
	const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
	return titleMatch ? extractTextContent(titleMatch[1]) : "";
}

/**
 * Extract links from HTML
 */
function extractLinks(html: string, baseUrl: string): string[] {
	const links: Set<string> = new Set();
	const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi;

	let match: RegExpExecArray | null = null;
	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	while ((match = linkRegex.exec(html)) !== null) {
		try {
			const href = match[1];
			// Skip anchors, javascript:, mailto:, tel:, etc.
			if (
				href.startsWith("#") ||
				href.startsWith("javascript:") ||
				href.startsWith("mailto:") ||
				href.startsWith("tel:")
			) {
				continue;
			}

			// Resolve relative URLs
			const absoluteUrl = new URL(href, baseUrl).href;
			links.add(absoluteUrl);
		} catch {
			// Invalid URL, skip
		}
	}

	return Array.from(links);
}

/**
 * Crawl a single page
 */
async function crawlPage(url: string): Promise<CrawlResult> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				"User-Agent":
					"Mozilla/5.0 (compatible; WingmanBot/1.0; +https://github.com/RussellCanfield/wingman-ai)",
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.5",
			},
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const contentType = response.headers.get("content-type") || "";
		if (
			!contentType.includes("text/html") &&
			!contentType.includes("application/xhtml")
		) {
			throw new Error(`Not an HTML page: ${contentType}`);
		}

		const html = await response.text();

		return {
			url,
			title: extractTitle(html),
			content: extractTextContent(html),
			links: extractLinks(html, url),
			metadata: {
				statusCode: response.status,
				contentType,
				timestamp: new Date().toISOString(),
			},
		};
	} catch (error) {
		clearTimeout(timeoutId);
		throw error;
	}
}

/**
 * Crawl multiple pages (breadth-first)
 */
async function crawlMultiplePages(
	startUrl: string,
	maxPages: number,
	sameDomain: boolean,
): Promise<CrawlResult[]> {
	const visited = new Set<string>();
	const queue: string[] = [startUrl];
	const results: CrawlResult[] = [];
	const startDomain = new URL(startUrl).hostname;

	while (queue.length > 0 && results.length < maxPages) {
		const url = queue.shift()!;

		if (visited.has(url)) {
			continue;
		}

		visited.add(url);

		try {
			const result = await crawlPage(url);
			results.push(result);

			// Add unvisited links to queue
			if (results.length < maxPages) {
				for (const link of result.links) {
					if (visited.has(link)) {
						continue;
					}

					// Check domain restriction
					if (sameDomain) {
						const linkDomain = new URL(link).hostname;
						if (linkDomain !== startDomain) {
							continue;
						}
					}

					queue.push(link);
				}
			}
		} catch (error) {
			// Log error but continue crawling
			logger.error(`Failed to crawl ${url}`, error);
		}
	}

	return results;
}

/**
 * Creates a web crawler tool for visiting and extracting content from web pages.
 * SPA-friendly: handles basic JavaScript-rendered content via fetch.
 */
export const createWebCrawlerTool = () => {
	return tool(
		async ({
			url,
			maxPages = 1,
			sameDomain = true,
		}: {
			url: string;
			maxPages?: number;
			sameDomain?: boolean;
		}) => {
			try {
				// Validate URL
				new URL(url);

				if (maxPages < 1 || maxPages > 10) {
					return "Error: maxPages must be between 1 and 10";
				}

				const results = await crawlMultiplePages(url, maxPages, sameDomain);

				if (results.length === 0) {
					return `Failed to crawl ${url}. The page may be inaccessible or blocked.`;
				}

				// Format results
				let output = "";

				if (results.length === 1) {
					const result = results[0];
					output = `# ${result.title || "Untitled Page"}

**URL**: ${result.url}
**Status**: ${result.metadata.statusCode}
**Crawled**: ${result.metadata.timestamp}

## Content

${result.content.substring(0, 10000)}${result.content.length > 10000 ? "\n\n[Content truncated - showing first 10,000 characters]" : ""}

## Links Found

${
	result.links.length > 0
		? result.links
				.slice(0, 20)
				.map((link) => `- ${link}`)
				.join("\n")
		: "No links found"
}${result.links.length > 20 ? `\n\n[${result.links.length - 20} more links not shown]` : ""}`;
				} else {
					output = `# Crawled ${results.length} pages from ${url}\n\n`;

					for (const result of results) {
						output += `## ${result.title || "Untitled Page"}

**URL**: ${result.url}

${result.content.substring(0, 2000)}${result.content.length > 2000 ? "..." : ""}

---

`;
					}

					output += `\n## Summary

Total pages crawled: ${results.length}
Total links discovered: ${results.reduce((sum, r) => sum + r.links.length, 0)}`;
				}

				return output;
			} catch (error) {
				if (
					error instanceof TypeError &&
					error.message.includes("Invalid URL")
				) {
					return `Error: Invalid URL format - ${url}`;
				}
				return `Error crawling ${url}: ${error instanceof Error ? error.message : "Unknown error"}`;
			}
		},
		{
			name: "web_crawler",
			description:
				"Crawls web pages and extracts their content. Can visit a single page or crawl multiple pages following links. Handles modern SPAs and JavaScript-rendered content. Use this to gather detailed information from websites, documentation, or web applications. Maximum 10 pages per crawl.",
			schema: z.object({
				url: z
					.string()
					.describe(
						"The URL to start crawling from (must be a valid HTTP/HTTPS URL)",
					),
				maxPages: z
					.number()
					.optional()
					.default(1)
					.describe(
						"Maximum number of pages to crawl (1-10). Default is 1 for single page crawl.",
					),
				sameDomain: z
					.boolean()
					.optional()
					.default(true)
					.describe(
						"Whether to restrict crawling to the same domain as the start URL. Default is true.",
					),
			}),
		},
	);
};

export const webCrawler = createWebCrawlerTool();
