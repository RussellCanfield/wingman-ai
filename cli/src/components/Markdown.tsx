import type React from "react";
import { Text, Box } from "ink";
import { marked } from "marked";
import chalk from "chalk";
import {
  highlightSyntax,
  defaultSyntaxTheme,
  type SyntaxTheme,
} from "./SyntaxHighlighter";

interface MarkdownProps {
  children: string;
  theme?: {
    heading?: (text: string, level: number) => string;
    strong?: (text: string) => string;
    em?: (text: string) => string;
    code?: (text: string) => string;
    codespan?: (text: string) => string;
    listitem?: (text: string) => string;
    link?: (text: string, href: string) => string;
    blockquote?: (text: string) => string;
    hr?: () => string;
  };
  syntaxTheme?: SyntaxTheme;
}

const defaultTheme = {
  heading: (text: string, level: number): string => {
    const colors = [
      chalk.cyan.bold,
      chalk.green.bold,
      chalk.yellow.bold,
      chalk.blue.bold,
      chalk.magenta.bold,
      chalk.red.bold,
    ];
    const colorFn = colors[level - 1] || chalk.white.bold;
    const markers = ["##", "##", "#", "▸", "▸", "▸"];
    const marker = markers[level - 1] || "▸";
    return `${colorFn(`${marker} ${text}`)}`;
  },
  strong: (text: string): string => chalk.bold.yellow(text),
  em: (text: string): string => chalk.italic.cyan(text),
  code: (text: string): string => chalk.bgGray.black(` ${text} `),
  codespan: (text: string): string => chalk.bgGray.black(` ${text} `),
  listitem: (text: string): string => `• ${text}`,
  link: (text: string, href: string): string =>
    `${chalk.blue.underline(text)} ${chalk.dim.gray(`(${href})`)}`,
  blockquote: (text: string): string => chalk.yellow.italic(`▐ ${text}`),
  hr: (): string => chalk.dim("─".repeat(50)),
};

const renderInlineTokens = (
  tokens: any[],
  theme: typeof defaultTheme,
): string => {
  if (!tokens) return "";

  return tokens
    .map((token: any) => {
      switch (token.type) {
        case "text":
          return token.text;
        case "strong":
          return theme.strong(
            renderInlineTokens(token.tokens || [], theme) || token.text,
          );
        case "em":
          return theme.em(
            renderInlineTokens(token.tokens || [], theme) || token.text,
          );
        case "codespan":
          return theme.codespan(token.text);
        case "link":
          return theme.link(
            renderInlineTokens(token.tokens || [], theme) || token.text,
            token.href,
          );
        case "br":
          return "\n";
        default:
          // For any unhandled token types, try to return text
          return token.text || token.raw || "";
      }
    })
    .join("");
};

const renderMarkdownToString = (
  markdown: string,
  theme: typeof defaultTheme,
  syntaxTheme: SyntaxTheme,
): string => {
  const tokens = marked.lexer(markdown);

  const renderToken = (token: any): string => {
    switch (token.type) {
      case "heading":
        return `\n${theme.heading(token.text, token.depth)}\n`;

      case "paragraph": {
        const paragraphText = renderInlineTokens(token.tokens, theme);
        return `${paragraphText}\n`;
      }
      case "list": {
        const listItems = token.items
          .map((item: any) => {
            // Handle inline tokens within list items properly
            let itemText = ''
            if (item.tokens && item.tokens.length > 0) {
              // Process tokens for this list item
              itemText = item.tokens
                .map((itemToken: any) => {
                  if (itemToken.type === "text") {
                    return (
                      renderInlineTokens(itemToken.tokens || [], theme) ||
                      itemToken.text
                    );
                  } if (itemToken.type === "paragraph") {
                    return renderInlineTokens(itemToken.tokens || [], theme);
                  }
                  return itemToken.text || "";
                })
                .join("");
            } else {
              itemText = item.text || "";
            }
            return `  ${theme.listitem(itemText)}`;
          })
          .join("\n");
        return `${listItems}\n`;
      }
      case "code": {
        const lines = token.text.split("\n");

        const langLabel = token.lang
          ? chalk.cyan.bold(`${token.lang}`)
          : chalk.gray("code");

        // Add line numbers with syntax highlighting
        const lineNumWidth = Math.max(String(lines.length).length, 2);
        const formattedLines = lines.map((line: string, index: number) => {
          const lineNum = chalk.dim.cyan(
            (index + 1).toString().padStart(lineNumWidth, " "),
          );
          const separator = chalk.dim(" │ ");
          const codeLine = line.replace(/\t/g, "    "); // Convert tabs to spaces
          const highlightedCode = highlightSyntax(
            codeLine,
            token.lang || "",
            syntaxTheme,
          );
          return chalk.dim("│ ") + lineNum + separator + highlightedCode;
        });

        // Add bottom border that extends only under the line numbers
        const bottomBorder = chalk.dim(
          `└${"─".repeat(lineNumWidth + 2)}┘`,
        );

        return `\n${chalk.dim("┌─ ")}${langLabel}\n${formattedLines.join("\n")}\n${bottomBorder}\n`;
      }
      case "blockquote": {
        const quoteText = token.tokens
          .map((t: any) => renderToken(t))
          .join("")
          .trim();
        const quoteLines = quoteText
          .split("\n")
          .filter((line: string) => line.trim());
        const quotedLines = quoteLines.map(
          (line: string) => `  ${theme.blockquote(line.trim())}`,
        );
        return `\n${quotedLines.join("\n")}\n`;
      }

      case "hr": {
        return `\n${theme.hr()}\n`;
      }
      case "space": {
        return "\n";
      }
      case "html": {
        return `${token.text}\n`;
      }
      default:
        return "";
    }
  };

  return tokens.map(renderToken).join("").trim();
};

const Markdown: React.FC<MarkdownProps> = ({
  children,
  theme,
  syntaxTheme,
}) => {
  const mergedTheme = { ...defaultTheme, ...theme };
  const mergedSyntaxTheme = { ...defaultSyntaxTheme, ...syntaxTheme };

  try {
    // Configure marked for better inline parsing
    marked.setOptions({
      breaks: true,
      gfm: true,
      pedantic: false,
    });

    const renderedMarkdown = renderMarkdownToString(
      children,
      mergedTheme,
      mergedSyntaxTheme,
    );

    return (
      <Box flexDirection="column">
        <Text>{renderedMarkdown}</Text>
      </Box>
    );
  } catch (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">
          Error parsing markdown:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </Text>
        <Text color="gray">{children}</Text>
      </Box>
    );
  }
};

export default Markdown;