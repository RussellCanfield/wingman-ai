import chalk from 'chalk';

export interface SyntaxTheme {
  keyword: (text: string) => string;
  string: (text: string) => string;
  comment: (text: string) => string;
  number: (text: string) => string;
  function: (text: string) => string;
  operator: (text: string) => string;
  type: (text: string) => string;
}

export const defaultSyntaxTheme: SyntaxTheme = {
  keyword: (text: string) => chalk.blue(text),
  string: (text: string) => chalk.green(text),
  comment: (text: string) => chalk.green(text),
  number: (text: string) => chalk.magenta(text),
  function: (text: string) => chalk.yellow(text),
  operator: (text: string) => chalk.cyan(text),
  type: (text: string) => chalk.blue.bold(text)
};

interface LanguagePatterns {
  keywords: RegExp;
  types?: RegExp;
  operators?: RegExp;
  comments: RegExp;
}

const languagePatterns: Record<string, LanguagePatterns> = {
  go: {
    keywords: /\b(package|import|func|var|const|type|struct|interface|if|else|for|range|switch|case|default|return|break|continue|go|chan|select|defer|map|make|append|len|cap|new|nil|true|false)\b/g,
    types: /\b(int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float32|float64|complex64|complex128|byte|rune|string|bool|error)\b/g,
    operators: /(\+\+|--|==|!=|<=|>=|&&|\|\||<-|:=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=)/g,
    comments: /\/\/.*$|\/\*[\s\S]*?\*\//gm
  },
  javascript: {
    keywords: /\b(function|var|let|const|if|else|for|while|do|switch|case|default|return|break|continue|try|catch|finally|throw|new|this|class|extends|import|export|async|await|true|false|null|undefined|typeof|instanceof)\b/g,
    types: /\b(Array|Object|String|Number|Boolean|Date|RegExp|Promise|Map|Set|WeakMap|WeakSet)\b/g,
    operators: /(===|!==|==|!=|<=|>=|&&|\|\||\.\.\.|\+\+|--|\+=|-=|\*=|\/=|%=)/g,
    comments: /\/\/.*$|\/\*[\s\S]*?\*\//gm
  },
  typescript: {
    keywords: /\b(function|var|let|const|if|else|for|while|do|switch|case|default|return|break|continue|try|catch|finally|throw|new|this|class|extends|import|export|async|await|true|false|null|undefined|interface|type|enum|public|private|protected|readonly|static|abstract|implements|namespace|declare|module)\b/g,
    types: /\b(string|number|boolean|any|void|never|unknown|object|Array|Promise|Record|Partial|Required|Pick|Omit)\b/g,
    operators: /(===|!==|==|!=|<=|>=|&&|\|\||\.\.\.|\+\+|--|\+=|-=|\*=|\/=|%=|=>|\?\.|\?\?)/g,
    comments: /\/\/.*$|\/\*[\s\S]*?\*\//gm
  },
  python: {
    keywords: /\b(def|class|if|elif|else|for|while|try|except|finally|import|from|as|return|break|continue|pass|lambda|with|global|nonlocal|True|False|None|and|or|not|in|is|yield|async|await)\b/g,
    types: /\b(str|int|float|bool|list|dict|tuple|set|frozenset|bytes|bytearray)\b/g,
    operators: /(==|!=|<=|>=|and|or|not|in|is|\+\+|--|\+=|-=|\*=|\/=|%=|\*\*=|\/\/=)/g,
    comments: /#.*$/gm
  },
  rust: {
    keywords: /\b(fn|let|mut|const|if|else|match|for|while|loop|break|continue|return|struct|enum|impl|trait|pub|use|mod|crate|self|super|static|extern|unsafe|async|await|true|false|Some|None|Ok|Err|where|move)\b/g,
    types: /\b(i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64|bool|char|str|String|Vec|HashMap|Option|Result|Box|Rc|Arc)\b/g,
    operators: /(==|!=|<=|>=|&&|\|\||\.\.=?|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=|=>)/g,
    comments: /\/\/.*$|\/\*[\s\S]*?\*\//gm
  },
  java: {
    keywords: /\b(public|private|protected|static|final|abstract|class|interface|extends|implements|if|else|for|while|do|switch|case|default|return|break|continue|try|catch|finally|throw|throws|new|this|super|true|false|null|package|import|synchronized|volatile|transient|native|strictfp)\b/g,
    types: /\b(int|long|short|byte|float|double|boolean|char|void|String|Object|Integer|Long|Short|Byte|Float|Double|Boolean|Character|List|Map|Set|ArrayList|HashMap|HashSet)\b/g,
    operators: /(==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|%=|instanceof)/g,
    comments: /\/\/.*$|\/\*[\s\S]*?\*\//gm
  },
  cpp: {
    keywords: /\b(int|float|double|char|bool|void|auto|const|static|extern|inline|virtual|public|private|protected|class|struct|namespace|using|if|else|for|while|do|switch|case|default|return|break|continue|try|catch|throw|new|delete|true|false|nullptr|template|typename)\b/g,
    types: /\b(std::string|std::vector|std::map|std::set|std::list|std::queue|std::stack|std::pair|std::shared_ptr|std::unique_ptr|std::weak_ptr|size_t|ptrdiff_t)\b/g,
    operators: /(==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|%=|::|\->|\.)/g,
    comments: /\/\/.*$|\/\*[\s\S]*?\*\//gm
  },
  csharp: {
    keywords: /\b(abstract|as|base|bool|break|byte|case|catch|char|checked|class|const|continue|decimal|default|delegate|do|double|else|enum|event|explicit|extern|false|finally|fixed|float|for|foreach|goto|if|implicit|in|int|interface|internal|is|lock|long|namespace|new|null|object|operator|out|override|params|private|protected|public|readonly|ref|return|sbyte|sealed|short|sizeof|stackalloc|static|string|struct|switch|this|throw|true|try|typeof|uint|ulong|unchecked|unsafe|ushort|using|virtual|void|volatile|while|add|alias|ascending|async|await|by|descending|dynamic|equals|from|get|global|group|into|join|let|nameof|on|orderby|partial|remove|select|set|value|var|when|where|yield)\b/g,
    types: /\b(bool|byte|char|decimal|double|float|int|long|object|sbyte|short|string|uint|ulong|ushort|void|DateTime|TimeSpan|Guid|List|Dictionary|Array|IEnumerable|ICollection|Task|Action|Func)\b/g,
    operators: /(==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=|=>|\?\?|\?\.)/g,
    comments: /\/\/.*$|\/\*[\s\S]*?\*\//gm
  },
  bash: {
    keywords: /\b(if|then|else|elif|fi|for|while|until|do|done|case|esac|function|return|break|continue|exit|export|local|readonly|declare|unset|shift|eval|exec|source|\.|true|false)\b/g,
    types: /\b(alias|bg|bind|builtin|caller|cd|command|compgen|complete|dirs|disown|echo|enable|fc|fg|getopts|hash|help|history|jobs|kill|let|logout|popd|printf|pushd|pwd|read|readarray|set|test|times|trap|type|typeset|ulimit|umask|unalias|wait)\b/g,
    operators: /(\|\||\&\&|\||\&|>>|<<|>=|<=|==|!=|=~|\+\+|--|\+=|-=|\*=|\/=|%=)/g,
    comments: /#.*$/gm
  },
  markdown: {
    keywords: /^(#{1,6}\s+.*$|^\*{1,3}|^_{1,3}|^\-{3,}|^\={3,}|^\+|^\-|^\*|^\d+\.)/gm,
    types: /(\*\*.*?\*\*|__.*?__|`.*?`|~~.*?~~)/g,
    operators: /(\[.*?\]\(.*?\)|!\[.*?\]\(.*?\)|<.*?>)/g,
    comments: /<!--[\s\S]*?-->/gm
  },
  html: {
    keywords: /(<\/?)(html|head|body|title|meta|link|script|style|div|span|p|h[1-6]|ul|ol|li|a|img|form|input|button|table|tr|td|th|thead|tbody|section|article|header|footer|nav|aside|main)(\s|>|\/?>)/gi,
    types: /(id|class|src|href|alt|title|type|value|placeholder|name|action|method|target|rel|charset|content|lang|style|onclick|onload|onchange|data-[\w-]+)(?==)/g,
    operators: /(=)/g,
    comments: /<!--[\s\S]*?-->/g
  },
  jsx: {
    keywords: /\b(function|var|let|const|if|else|for|while|do|switch|case|default|return|break|continue|try|catch|finally|throw|new|this|class|extends|import|export|async|await|true|false|null|undefined|typeof|instanceof|React|Component|useState|useEffect|useContext|useReducer|useMemo|useCallback|useRef|Fragment)\b/g,
    types: /\b(Array|Object|String|Number|Boolean|Date|RegExp|Promise|Map|Set|WeakMap|WeakSet|ReactNode|ReactElement|JSX|FC|FunctionComponent|ComponentProps)\b/g,
    operators: /(===|!==|==|!=|<=|>=|&&|\|\||\.\.\.|\+\+|--|\+=|-=|\*=|\/=|%=|=>)/g,
    comments: /\/\/.*$|\/\*[\s\S]*?\*\//gm
  },
  tsx: {
    keywords: /\b(function|var|let|const|if|else|for|while|do|switch|case|default|return|break|continue|try|catch|finally|throw|new|this|class|extends|import|export|async|await|true|false|null|undefined|interface|type|enum|public|private|protected|readonly|static|abstract|implements|namespace|declare|module|React|Component|useState|useEffect|useContext|useReducer|useMemo|useCallback|useRef|Fragment)\b/g,
    types: /\b(string|number|boolean|any|void|never|unknown|object|Array|Promise|Record|Partial|Required|Pick|Omit|ReactNode|ReactElement|JSX|FC|FunctionComponent|ComponentProps)\b/g,
    operators: /(===|!==|==|!=|<=|>=|&&|\|\||\.\.\.|\+\+|--|\+=|-=|\*=|\/=|%=|=>|\?\.|\?\?)/g,
    comments: /\/\/.*$|\/\*[\s\S]*?\*\//gm
  }
};

// Common patterns that apply to all languages
const commonPatterns = {
  strings: /(["'`])((?:(?!\1)[^\\]|\\.)*)?\1/g,
  numbers: /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g,
  functions: /\b\w+(?=\s*\()/g
};

export const highlightSyntax = (code: string, language: string, theme: SyntaxTheme = defaultSyntaxTheme): string => {
  if (!language) return code;
  
  const lang = language.toLowerCase();
  const patterns = languagePatterns[lang];
  
  if (!patterns) return code;
  
  // Clean any existing ANSI codes first
  const cleanCode = code.replace(/\u001b\[[0-9;]*m/g, '');
  let highlighted = cleanCode;
  
  // Apply comments first to avoid interfering with other patterns
  if (patterns.comments) {
    highlighted = highlighted.replace(patterns.comments, (match) => theme.comment(match));
  }
  
  // Apply strings before other patterns to avoid conflicts
  highlighted = highlighted.replace(commonPatterns.strings, (match) => theme.string(match));
  
  // Apply language-specific patterns
  if (patterns.keywords) {
    highlighted = highlighted.replace(patterns.keywords, (match) => theme.keyword(match));
  }
  
  if (patterns.types) {
    highlighted = highlighted.replace(patterns.types, (match) => theme.type(match));
  }
  
  if (patterns.operators) {
    highlighted = highlighted.replace(patterns.operators, (match) => theme.operator(match));
  }
  
  // Apply numbers and functions last
  highlighted = highlighted.replace(commonPatterns.numbers, (match) => theme.number(match));
  highlighted = highlighted.replace(commonPatterns.functions, (match) => theme.function(match));
  
  return highlighted;
};

export const getSupportedLanguages = (): string[] => {
  return Object.keys(languagePatterns);
};

export const isLanguageSupported = (language: string): boolean => {
  return language.toLowerCase() in languagePatterns;
};