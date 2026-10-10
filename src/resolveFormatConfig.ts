// 格式化配置链（formatter design §5 第 3 条）。
// 核心 formatTASON 只接收最终对象；读文件、inspect 与逐字段合并都在插件侧。
// 优先级从低到高叠加：默认 → 全局显式设置 → 编辑器缩进 → 工作区显式设置 → .tasonrc。
// 贡献的设置默认值不读（调用方不要把 defaultValue 传进来）。

import fs from "fs";
import path from "path";
import type { TASONFormatOptions } from "tason";

export const TASONRC_NAMES = [
  ".tasonrc",
  ".tasonrc.json",
  ".tasonrc.jsonc",
  ".tasonrc.tason",
] as const;

export const FORMAT_OPTION_KEYS = [
  "tabWidth",
  "useTabs",
  "printWidth",
  "singleQuote",
  "quoteKeys",
  "trailingComma",
  "optimizeNumbers",
  "optimizeNumberTypeInstances",
  "optimizeBlockComments",
  "endOfLine",
] as const;

export type FormatOptionKey = (typeof FORMAT_OPTION_KEYS)[number];

/** 只含 inspect() 的显式作用域。defaultValue 故意不在这里。 */
export interface ConfigInspect<T = unknown> {
  globalValue?: T;
  globalLanguageValue?: T;
  workspaceValue?: T;
  workspaceLanguageValue?: T;
  workspaceFolderValue?: T;
  workspaceFolderLanguageValue?: T;
}

export interface SettingLayers {
  global: Partial<TASONFormatOptions>;
  workspace: Partial<TASONFormatOptions>;
  workspaceFolder: Partial<TASONFormatOptions>;
}

export interface EditorIndent {
  tabWidth: number;
  useTabs: boolean;
}

export type TasonrcLoad =
  | { status: "absent" }
  | { status: "ok"; fileName: string; options: Partial<TASONFormatOptions> }
  | { status: "error"; fileName: string; message: string };

export interface TextFileIO {
  isFile(filePath: string): boolean;
  read(filePath: string): string;
}

const nodeIO: TextFileIO = {
  isFile(filePath) {
    try {
      return fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  },
  read(filePath) {
    return fs.readFileSync(filePath, "utf8");
  },
};

export function configWarning(fileName: string, message: string): string {
  return `TASON：配置文件 ${fileName} 无法解析（${message}），已跳过该配置。`;
}

export function syntaxWarning(diagnostic: { message: string; line: number; column: number }): string {
  return `TASON：存在语法错误，未格式化。${diagnostic.message}（${diagnostic.line + 1}:${diagnostic.column + 1}）`;
}

export function editorIndentFromFormattingOptions(options: {
  tabSize: number;
  insertSpaces: boolean;
}): EditorIndent {
  return {
    tabWidth: options.tabSize,
    useTabs: options.insertSpaces === false,
  };
}

export function loadTasonrc(
  rootDir: string,
  parse: (text: string) => unknown,
  io: TextFileIO = nodeIO,
): TasonrcLoad {
  for (const fileName of TASONRC_NAMES) {
    const filePath = path.join(rootDir, fileName);
    if (!io.isFile(filePath)) continue;
    let text: string;
    try {
      text = io.read(filePath);
    } catch (error) {
      return { status: "error", fileName, message: errorMessage(error) };
    }
    try {
      const value = parse(text);
      if (!isPlainObject(value)) {
        return { status: "error", fileName, message: "内容不是对象" };
      }
      return { status: "ok", fileName, options: pickFormatOptions(value) };
    } catch (error) {
      return { status: "error", fileName, message: errorMessage(error) };
    }
  }
  return { status: "absent" };
}

export function explicitSettingsFromInspect(
  read: (key: FormatOptionKey) => ConfigInspect | undefined,
): SettingLayers {
  return {
    global: scopeLayer(read, "globalValue", "globalLanguageValue"),
    workspace: scopeLayer(read, "workspaceValue", "workspaceLanguageValue"),
    workspaceFolder: scopeLayer(read, "workspaceFolderValue", "workspaceFolderLanguageValue"),
  };
}

export function mergeFormatOptions(input: {
  endOfLine: "lf" | "crlf";
  editor: EditorIndent;
  settings: SettingLayers;
  tasonrc: Partial<TASONFormatOptions> | null;
}): TASONFormatOptions {
  const merged: TASONFormatOptions = {
    singleQuote: "auto",
    endOfLine: input.endOfLine,
  };
  overlay(merged, input.settings.global);
  merged.tabWidth = input.editor.tabWidth;
  merged.useTabs = input.editor.useTabs;
  overlay(merged, input.settings.workspace);
  overlay(merged, input.settings.workspaceFolder);
  overlay(merged, input.tasonrc);
  return merged;
}

export function collectFormatInput(input: {
  rootDir: string | undefined;
  parse: (text: string) => unknown;
  endOfLine: "lf" | "crlf";
  editor: EditorIndent;
  readSetting: (key: FormatOptionKey) => ConfigInspect | undefined;
  io?: TextFileIO;
}): { options: TASONFormatOptions; warnings: string[] } {
  const warnings: string[] = [];
  let tasonrc: Partial<TASONFormatOptions> | null = null;
  if (input.rootDir) {
    const loaded = loadTasonrc(input.rootDir, input.parse, input.io);
    if (loaded.status === "error") {
      warnings.push(configWarning(loaded.fileName, loaded.message));
    } else if (loaded.status === "ok") {
      tasonrc = loaded.options;
    }
  }
  return {
    warnings,
    options: mergeFormatOptions({
      endOfLine: input.endOfLine,
      editor: input.editor,
      settings: explicitSettingsFromInspect(input.readSetting),
      tasonrc,
    }),
  };
}

function scopeLayer(
  read: (key: FormatOptionKey) => ConfigInspect | undefined,
  valueKey: keyof ConfigInspect,
  languageKey: keyof ConfigInspect,
): Partial<TASONFormatOptions> {
  const layer: Partial<TASONFormatOptions> = {};
  for (const key of FORMAT_OPTION_KEYS) {
    const info = read(key);
    if (!info) continue;
    const languageValue = acceptField(key, info[languageKey]);
    const plainValue = acceptField(key, info[valueKey]);
    const chosen = languageValue !== undefined ? languageValue : plainValue;
    if (chosen !== undefined) {
      layer[key] = chosen as never;
    }
  }
  return layer;
}

function overlay(
  target: TASONFormatOptions,
  patch: Partial<TASONFormatOptions> | null | undefined,
): void {
  if (!patch) return;
  const record = target as Record<FormatOptionKey, TASONFormatOptions[FormatOptionKey]>;
  for (const key of FORMAT_OPTION_KEYS) {
    const value = patch[key];
    if (value !== undefined) record[key] = value;
  }
}

export function pickFormatOptions(value: Record<string, unknown>): Partial<TASONFormatOptions> {
  const out: Partial<TASONFormatOptions> = {};
  for (const key of FORMAT_OPTION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const accepted = acceptField(key, value[key]);
    if (accepted !== undefined) out[key] = accepted as never;
  }
  return out;
}

function acceptField(
  key: FormatOptionKey,
  raw: unknown,
): TASONFormatOptions[FormatOptionKey] | undefined {
  if (raw === undefined || raw === null) return undefined;
  switch (key) {
    case "tabWidth":
      if (raw === "auto") return "auto";
      if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0) return raw;
      return undefined;
    case "useTabs":
      if (raw === "auto" || typeof raw === "boolean") return raw;
      return undefined;
    case "printWidth":
      if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) return raw;
      return undefined;
    case "singleQuote":
      if (raw === "auto" || typeof raw === "boolean") return raw;
      return undefined;
    case "quoteKeys":
      if (raw === "as-needed" || raw === "preserve") return raw;
      return undefined;
    case "trailingComma":
      if (raw === "all" || raw === "none") return raw;
      return undefined;
    case "endOfLine":
      if (raw === "lf" || raw === "crlf") return raw;
      return undefined;
    case "optimizeNumbers":
    case "optimizeNumberTypeInstances":
    case "optimizeBlockComments":
      if (typeof raw === "boolean") return raw;
      return undefined;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
