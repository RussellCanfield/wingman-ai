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

    searchWeb = async (input: string): Promise<string | undefined> => {
        try {
            const searchResults = await search(input, {
                safeSearch: SafeSearchType.STRICT
            });

            if (!searchResults.results.length) {
                return;
            }

            const bestMatch = await this.getBestMatchUrl(input, searchResults);

            // Fetch the webpage content
            const response = await fetch(bestMatch);
            const html = await response.text();

            // Parse and clean the HTML
            const $ = cheerio.load(html);

            // Remove unwanted elements
            $('script, style, nav, footer, iframe, noscript').remove();

            // Get the main content
            const mainContent = $('main, article, .content, #content, .main')
                .first()
                .html() || $('body').html();

            if (!mainContent) {
                return 'Could not extract content from the webpage';
            }

            // Convert to markdown
            const markdown = this.turndown.turndown(mainContent);

            const result = await this.aiProvider.getModel().invoke(
                `You are a senior full-stack developer with exceptional technical expertise, focused on writing clean, maintainable code.
Summarize the webpage content and extract the most relevant technical information. 
Focus on providing a concise, developer-friendly overview that highlights key technical details, code snippets, or explanations related to the search query. 
Ensure the summary is clear, precise, and actionable for a professional software developer.
Return your response in github markdown format.

Query: ${input}

Results from related webpage in markdown format:
${markdown}`
            );

            return result.content.toString();

        } catch (error) {
            if (error instanceof Error) {
                console.error('Error in web search:', error);
                return `Error searching the web: ${error.message}`;
            }
        }
    }
}