// 格式化结果 → 是否改写全文（design §5 第 2 条）。
// diagnostics 非空：提示且不改文本。结果与原文相同：不产生编辑。

import { syntaxWarning } from "./resolveFormatConfig";

export interface FormatLikeResult {
  text: string;
  diagnostics: { message: string; line: number; column: number }[];
}

export function decideFormatEdit(
  original: string,
  result: FormatLikeResult,
): { replacement: string | null; warning: string | null } {
  if (result.diagnostics.length > 0) {
    return { replacement: null, warning: syntaxWarning(result.diagnostics[0]) };
  }
  if (result.text === original) return { replacement: null, warning: null };
  return { replacement: result.text, warning: null };
}
