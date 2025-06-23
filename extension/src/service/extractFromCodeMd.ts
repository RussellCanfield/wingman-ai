export const extractFromCodeMd = (text: string) => {
  if (!text || !text.trim()) return '';
  const regex = /```(\w*\n)?([\s\S]*?)```/;
  const match = text.match(regex);

  let codeBlockContent = '';
  if (match) {
    const startIndex = match.index! + match[0].indexOf(match[2]);
    const endIndex = match.index! + match[0].lastIndexOf(match[2]) + match[2].length;
    codeBlockContent = text.substring(startIndex, endIndex).trim();
    return codeBlockContent;
  }
  else {
    return '';
  }
};

// fot a give python code, extract the string documentation
export const extractStringDocs = (pythonCode: string) => {
  // Should the reg ex use """ instead of "''"?
  const regex = /"""([\s\S]*?)"""/;
  const match = pythonCode.match(regex);
  if (match) {
    return `"""${match[1]}"""`;
  }
  else {
    return '';
  }
};


// for a given js / ts code, extract the jsdoc
export const extractJsDocs = (jsCode: string) => {
  const regex = /\/\*\*([\s\S]*?)\*\//;
  const match = jsCode.match(regex);
  if (match) {
    return `/**${match[1]}*/`;
  }
  else {
    return '';
  }
};

export const extractCsharpDocs = (csharpCode: string) => {
  // csharp doc comments use xml tags starting with /// <summary> and ending with /// </summary>
  const regex = /\/\/\/\s?<summary>([\s\S]*?)\/\/\/\s?<\/summary>/;
  const match = csharpCode.match(regex);
  if (match) {
    return match[0];
  }
  else {
    return '';
  }
};