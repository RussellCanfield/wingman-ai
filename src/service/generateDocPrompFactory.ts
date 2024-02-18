import { isTsRelated } from './langCheckers';

/**
    For example, for Python use the triple quotes.
    For Javascript, Typescript and JSX and TSX use the JSDoc style.
    For C# use the XML style.
    For Java use the Javadoc style.
    For Go use the godoc style.
    For Rust use the Rustdoc style.
    For Ruby use the Rdoc style.
    For Swift use the Swift style.
    For Kotlin use the Kdoc style.
 */

export const generateDocPrompFactory = (languageId: string) => {
  if (isTsRelated(languageId)) {
    return `Current language is ${languageId}. Use the JSDoc style.`;
  }

  if (languageId === 'python') {
    return `Current language is ${languageId}. Use triple quotes.`;
  }

  if (languageId === 'csharp') {
    return `Current language is ${languageId}. Use the XML style.`;
  }

  if (languageId === 'java') {
    return `Current language is ${languageId}. Use the Javadoc style.`;
  }

  if (languageId === 'go') {
    return `Current language is ${languageId}. Use the godoc style.`;
  }

  if (languageId === 'rust') {
    return `Current language is ${languageId}. Use the Rustdoc style.`;
  }

  if (languageId === 'ruby') {
    return `Current language is ${languageId}. Use the Rdoc style.`;
  }

  if (languageId === 'swift') {
    return `Current language is ${languageId}. Use the Swift style.`;
  }

  if (languageId === 'kotlin') {
    return `Current language is ${languageId}. Use the Kdoc style.`;
  }
  return `Current language is ${languageId}`;
};