export default /** @type {import("monarch-languages").MonarchLanguage} */ {
  "defaultToken": "",
  "ignoreCase": false,
  "tokenPostfix": ".tason",
  "brackets": [
    { "open": "{", "close": "}", "token": "delimiter.bracket" },
    { "open": "[", "close": "]", "token": "delimiter.bracket" },
    { "open": "(", "close": ")", "token": "delimiter.parenthesis" }
  ],
  "keywords": ["true", "false", "null"],
  "escapes": /\\(?:["'\\bfnrtv0]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4})/,
  "tokenizer": {
    "root": [
      { "include": "@whitespace" },
      { "include": "@comments" },
      [/{/, "delimiter.bracket", "@object"],
      [/\[/, "delimiter.bracket", "@array"],
      [/"([^"\\]|\\.)*$/, "string.invalid"],
      [/'([^'\\]|\\.)*$/, "string.invalid"],
      [/"/, { "token": "string.quote", "next": "@stringD" }],
      [/'/, { "token": "string.quote", "next": "@stringS" }],
      [/NaN\b|Infinity\b/, "number"],
      [/-?0x[0-9a-fA-F]+/, "number.hex"],
      [/-?0o[0-7]+/, "number.octal"],
      [/-?0b[01]+/, "number.binary"],
      [/-?\d*\.\d+([eE][+-]?\d+)?/, "number.float"],
      [/-?\d+[eE][+-]?\d+/, "number.float"],
      [/-?\d+/, "number"],
      [/\b(true|false|null)\b/, "keyword"],
      [/[a-zA-Z_]\w*\s*\(/, { "token": "keyword", "next": "@typeInstance" }],
      [/[a-zA-Z_]\w*/, "identifier"],
      [/:|,/, "delimiter"]
    ],
    "whitespace": [
      [/\s+/, "white"]
    ],
    "comments": [
      [/\/\/.*$/, "comment"],
      [/\/\*[\s\S]*?\*\//, "comment"]
    ],
    "stringD": [
      [/"$/, { "token": "string.quote", "next": "@pop" }],
      [/[^\\"]+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"]
    ],
    "stringS": [
      [/'/, { "token": "string.quote", "next": "@pop" }],
      [/[^\\']+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"]
    ],
    "object": [
      { "include": "@whitespace" },
      { "include": "@comments" },
      [/}/, "delimiter.bracket", "@pop"],
      [/,/, "delimiter"],
      [/:/, "delimiter"],
      [/"([^"\\]|\\.)*"/, "string"],
      [/'([^'\\]|\\.)*'/, "string"],
      [/[a-zA-Z_]\w*/, "identifier"],
      [/{/, "delimiter.bracket", "@object"],
      [/\[/, "delimiter.bracket", "@array"],
      [/NaN\b|Infinity\b/, "number"],
      [/-?0x[0-9a-fA-F]+/, "number.hex"],
      [/-?0o[0-7]+/, "number.octal"],
      [/-?0b[01]+/, "number.binary"],
      [/-?\d*\.\d+([eE][+-]?\d+)?/, "number.float"],
      [/-?\d+[eE][+-]?\d+/, "number.float"],
      [/-?\d+/, "number"],
      [/\b(true|false|null)\b/, "keyword"],
      [/[a-zA-Z_]\w*\s*\(/, { "token": "keyword", "next": "@typeInstance" }]
    ],
    "array": [
      { "include": "@whitespace" },
      { "include": "@comments" },
      [/\]/, "delimiter.bracket", "@pop"],
      [/,/, "delimiter"],
      [/{/, "delimiter.bracket", "@object"],
      [/\[/, "delimiter.bracket", "@array"],
      [/"([^"\\]|\\.)*"/, "string"],
      [/'([^'\\]|\\.)*'/, "string"],
      [/NaN\b|Infinity\b/, "number"],
      [/-?0x[0-9a-fA-F]+/, "number.hex"],
      [/-?0o[0-7]+/, "number.octal"],
      [/-?0b[01]+/, "number.binary"],
      [/-?\d*\.\d+([eE][+-]?\d+)?/, "number.float"],
      [/-?\d+[eE][+-]?\d+/, "number.float"],
      [/-?\d+/, "number"],
      [/\b(true|false|null)\b/, "keyword"],
      [/[a-zA-Z_]\w*\s*\(/, { "token": "keyword", "next": "@typeInstance" }]
    ],
    "typeInstance": [
      [/\(/, "delimiter.parenthesis"],
      [/\)/, "delimiter.parenthesis", "@pop"],
      [/"([^"\\]|\\.)*"/, "string"],
      [/'([^'\\]|\\.)*'/, "string"],
      [/{/, "delimiter.bracket", "@object"],
      [/}/, "delimiter.bracket"]
    ]
  }
}