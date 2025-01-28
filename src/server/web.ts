import { search, SafeSearchType, SearchResults } from 'duck-duck-scrape';
import TurndownService from 'turndown';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { AIProvider } from '../service/base';

export class WebCrawler {
    private turndown: TurndownService;

    constructor(private readonly aiProvider: AIProvider) {
        this.turndown = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
        });
    }

    getBestMatchUrl = async (input: string, results: SearchResults): Promise<string> => {
        const searchResultsText = results.results
            .map((result, index) => (
                `${index + 1}. Title: ${result.title}
                URL: ${result.url}
                Description: ${result.description}`
            ))
            .join('\n\n');

        const response = await this.aiProvider.getRerankModel().invoke(
            `You are analyzing search results to find the most relevant URL for a user's query.
    
Query: "${input}"

Search Results:
${searchResultsText}

Task: Analyze these search results and return ONLY the URL of the most relevant result that best matches the query.

Selection criteria:
- Relevance to the original query
- Credibility of the source
- Content freshness and quality
- Avoid sponsored or advertisement links
- Prefer official documentation or reputable sources

Response format:
- Return ONLY the URL, no explanation or additional text
- If no results are relevant, return "none"`
        );

        const url = response.content.toString().trim();

        if (!url || url === 'none') {
            throw new Error('No relevant results found');
        }

        // Validate the URL exists in our results to prevent hallucination
        const matchingResult = results.results.find(r => r.url === url);
        if (!matchingResult) {
            return results.results[0].url; // Fallback to first result if model hallucinates
        }

        return url;
    }

    searchWeb = (async function* (this: WebCrawler, input: string): AsyncGenerator<string, void, unknown> {
        try {
            const searchResults = await search(input, {
                safeSearch: SafeSearchType.STRICT
            });

            if (!searchResults.results.length) {
                yield "No search results found";
                return;
            }

            const bestMatch = await this.getBestMatchUrl(input, searchResults);

            const response = await fetch(bestMatch);
            const html = await response.text();

            // Parse HTML
            const $ = cheerio.load(html);
            $('script, style, nav, footer, iframe, noscript').remove();

            const mainContent = $('main, article, .content, #content, .main')
                .first()
                .html() || $('body').html();

            if (!mainContent) {
                yield "Could not extract content from the webpage";
                return;
            }

            const markdown = this.turndown.turndown(mainContent);

            yield markdown;
        } catch (error) {
            if (error instanceof Error) {
                console.error('Error in web search:', error);
                yield `Error searching the web: ${error.message}`;
            }
        }
    }).bind(this) as (input: string) => AsyncGenerator<string, void, unknown>;
}