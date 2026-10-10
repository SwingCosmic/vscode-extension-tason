import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, test } from "node:test";
import TASON from "tason";
import { decideFormatEdit } from "../src/formatDocument";
import {
  collectFormatInput,
  editorIndentFromFormattingOptions,
  loadTasonrc,
  mergeFormatOptions,
  type ConfigInspect,
  type FormatOptionKey,
  type SettingLayers,
} from "../src/resolveFormatConfig";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tason-fmt-"));
  dirs.push(dir);
  return dir;
}

function emptySettings(): SettingLayers {
  return { global: {}, workspace: {}, workspaceFolder: {} };
}

function inspect(
  values: Partial<Record<FormatOptionKey, ConfigInspect>>,
): (key: FormatOptionKey) => ConfigInspect | undefined {
  return (key) => values[key];
}

describe("编辑器缩进", () => {
  test("insertSpaces 为 false 时用 tab", () => {
    assert.deepEqual(editorIndentFromFormattingOptions({ tabSize: 4, insertSpaces: false }), {
      tabWidth: 4,
      useTabs: true,
    });
    assert.equal(editorIndentFromFormattingOptions({ tabSize: 2, insertSpaces: true }).useTabs, false);
  });
});

describe("逐字段合并", () => {
  test("编辑器缩进盖过全局 tabWidth / useTabs，不盖过其它全局项", () => {
    const merged = mergeFormatOptions({
      endOfLine: "lf",
      editor: { tabWidth: 2, useTabs: false },
      settings: {
        global: { tabWidth: 8, useTabs: true, printWidth: 100, singleQuote: true },
        workspace: {},
        workspaceFolder: {},
      },
      tasonrc: null,
    });
    assert.equal(merged.tabWidth, 2);
    assert.equal(merged.useTabs, false);
    assert.equal(merged.printWidth, 100);
    assert.equal(merged.singleQuote, true);
  });

  test("工作区显式设置盖过编辑器缩进，工作区文件夹再盖过工作区", () => {
    const merged = mergeFormatOptions({
      endOfLine: "lf",
      editor: { tabWidth: 2, useTabs: false },
      settings: {
        global: { printWidth: 60 },
        workspace: { tabWidth: 4, printWidth: 40, useTabs: true },
        workspaceFolder: { printWidth: 20 },
      },
      tasonrc: null,
    });
    assert.equal(merged.tabWidth, 4);
    assert.equal(merged.useTabs, true);
    assert.equal(merged.printWidth, 20);
  });

  test(".tasonrc 盖过工作区与编辑器", () => {
    const merged = mergeFormatOptions({
      endOfLine: "crlf",
      editor: { tabWidth: 2, useTabs: false },
      settings: {
        global: { endOfLine: "lf", quoteKeys: "preserve" },
        workspace: { tabWidth: 8, singleQuote: false },
        workspaceFolder: {},
      },
      tasonrc: { tabWidth: 6, singleQuote: true, endOfLine: "lf" },
    });
    assert.equal(merged.tabWidth, 6);
    assert.equal(merged.singleQuote, true);
    assert.equal(merged.endOfLine, "lf");
    assert.equal(merged.quoteKeys, "preserve");
  });

  test("未设置引号时 singleQuote 为 auto，endOfLine 跟随文档", () => {
    const merged = mergeFormatOptions({
      endOfLine: "crlf",
      editor: { tabWidth: 2, useTabs: false },
      settings: emptySettings(),
      tasonrc: null,
    });
    assert.equal(merged.singleQuote, "auto");
    assert.equal(merged.endOfLine, "crlf");
    assert.equal(merged.printWidth, undefined);
    assert.equal(merged.quoteKeys, undefined);
    assert.equal(merged.trailingComma, undefined);
  });

  test("语言作用域的显式值盖过同一级普通值", () => {
    const prepared = collectFormatInput({
      rootDir: undefined,
      parse: () => {
        throw new Error("不应读取配置文件");
      },
      endOfLine: "lf",
      editor: { tabWidth: 2, useTabs: false },
      readSetting: inspect({
        singleQuote: { globalValue: false, globalLanguageValue: true },
        printWidth: { workspaceValue: 40, workspaceLanguageValue: 90 },
        tabWidth: { workspaceFolderValue: 8, workspaceFolderLanguageValue: "auto" },
      }),
    });
    assert.equal(prepared.warnings.length, 0);
    assert.equal(prepared.options.singleQuote, true);
    assert.equal(prepared.options.printWidth, 90);
    assert.equal(prepared.options.tabWidth, "auto");
  });

  test("只出现在 defaultValue 上的设置不参与合并", () => {
    const prepared = collectFormatInput({
      rootDir: undefined,
      parse: () => ({}),
      endOfLine: "lf",
      editor: { tabWidth: 2, useTabs: false },
      readSetting: () => ({ defaultValue: 40 }) as ConfigInspect,
    });
    assert.equal(prepared.options.printWidth, undefined);
    assert.equal(prepared.options.tabWidth, 2);
  });

  test("不认识的值被忽略，该字段继续用更低层", () => {
    const prepared = collectFormatInput({
      rootDir: undefined,
      parse: () => ({}),
      endOfLine: "lf",
      editor: { tabWidth: 2, useTabs: false },
      readSetting: inspect({
        tabWidth: { workspaceValue: "wide" },
        printWidth: { workspaceValue: 0 },
        trailingComma: { workspaceValue: "es5" },
      }),
    });
    assert.equal(prepared.options.tabWidth, 2);
    assert.equal(prepared.options.printWidth, undefined);
    assert.equal(prepared.options.trailingComma, undefined);
  });
});

describe(".tasonrc", () => {
  test("按文件名顺序取第一个，后面的文件即使损坏也不读", () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, ".tasonrc"), `{ printWidth: 48, unknown: 1, tabWidth: "nope" }\n`);
    fs.writeFileSync(path.join(dir, ".tasonrc.json"), `NotAType("x")\n`);
    const loaded = loadTasonrc(dir, (text) => TASON.parse(text));
    assert.equal(loaded.status, "ok");
    if (loaded.status !== "ok") return;
    assert.equal(loaded.fileName, ".tasonrc");
    assert.deepEqual(loaded.options, { printWidth: 48 });
  });

  test("jsonc 注释与尾逗号可以解析", () => {
    const dir = tempDir();
    fs.writeFileSync(
      path.join(dir, ".tasonrc.jsonc"),
      `{
        // 项目宽度
        printWidth: 72,
        trailingComma: "none",
      }
      `,
    );
    const loaded = loadTasonrc(dir, (text) => TASON.parse(text));
    assert.equal(loaded.status, "ok");
    if (loaded.status !== "ok") return;
    assert.equal(loaded.fileName, ".tasonrc.jsonc");
    assert.deepEqual(loaded.options, { printWidth: 72, trailingComma: "none" });
  });

  test("只有 .tasonrc.tason 时使用它", () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, ".tasonrc.tason"), `{ singleQuote: true }\n`);
    const loaded = loadTasonrc(dir, (text) => TASON.parse(text));
    assert.equal(loaded.status, "ok");
    if (loaded.status !== "ok") return;
    assert.deepEqual(loaded.options, { singleQuote: true });
  });

  test("没有配置文件", () => {
    const loaded = loadTasonrc(tempDir(), (text) => TASON.parse(text));
    assert.deepEqual(loaded, { status: "absent" });
  });

  test("未注册 TypeName、非对象与解析失败都降级", () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, ".tasonrc"), `NotAType("x")\n`);
    const unregistered = loadTasonrc(dir, (text) => TASON.parse(text));
    assert.equal(unregistered.status, "error");
    if (unregistered.status === "error") {
      assert.match(unregistered.message, /Unregistered type/);
    }

    fs.writeFileSync(path.join(dir, ".tasonrc"), `[1, 2]\n`);
    const array = loadTasonrc(dir, (text) => TASON.parse(text));
    assert.equal(array.status, "error");
    if (array.status === "error") assert.equal(array.message, "内容不是对象");

    fs.writeFileSync(path.join(dir, ".tasonrc"), `{,\n`);
    const broken = loadTasonrc(dir, (text) => TASON.parse(text));
    assert.equal(broken.status, "error");
  });

  test("目录不占文件名，继续看下一个", () => {
    const dir = tempDir();
    fs.mkdirSync(path.join(dir, ".tasonrc"));
    fs.writeFileSync(path.join(dir, ".tasonrc.json"), `{ quoteKeys: "preserve" }\n`);
    const loaded = loadTasonrc(dir, (text) => TASON.parse(text));
    assert.equal(loaded.status, "ok");
    if (loaded.status !== "ok") return;
    assert.equal(loaded.fileName, ".tasonrc.json");
    assert.deepEqual(loaded.options, { quoteKeys: "preserve" });
  });
});

describe("格式化文档", () => {
  test("语法错误时提示且不给出替换文本", () => {
    const original = "{,}";
    const result = TASON.format(original);
    const diagnostic = result.diagnostics[0];
    const decision = decideFormatEdit(original, result);
    assert.equal(decision.replacement, null);
    assert.equal(result.text, original);
    assert.match(decision.warning ?? "", /未格式化/);
    assert.match(
      decision.warning ?? "",
      new RegExp(`${diagnostic.line + 1}:${diagnostic.column + 1}`),
    );
  });

  test("结果与原文相同时不产生编辑", () => {
    const original = TASON.format(`{ a: 1 }`).text;
    const decision = decideFormatEdit(original, TASON.format(original));
    assert.equal(decision.replacement, null);
    assert.equal(decision.warning, null);
  });

  test("配置损坏时跳过该文件，仍按其余来源格式化", () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, ".tasonrc"), `NotAType("x")\n`);
    const prepared = collectFormatInput({
      rootDir: dir,
      parse: (text) => TASON.parse(text),
      endOfLine: "lf",
      editor: { tabWidth: 4, useTabs: false },
      readSetting: inspect({ printWidth: { globalValue: 12 } }),
    });
    assert.equal(prepared.warnings.length, 1);
    assert.match(prepared.warnings[0], /已跳过该配置/);
    assert.equal(prepared.options.tabWidth, 4);
    assert.equal(prepared.options.printWidth, 12);

    const formatted = TASON.format(`{aaa: 1, bbb: 22}`, prepared.options);
    assert.deepEqual(formatted.diagnostics, []);
    assert.equal(formatted.text, "{\n    aaa: 1,\n    bbb: 22,\n}\n");
  });

  test(".tasonrc 与编辑器缩进一起作用，optimizeNumbers 原样传给核心", () => {
    const dir = tempDir();
    fs.writeFileSync(
      path.join(dir, ".tasonrc"),
      `{
        printWidth: 12,
        singleQuote: true,
        optimizeNumbers: true,
      }
      `,
    );
    const prepared = collectFormatInput({
      rootDir: dir,
      parse: (text) => TASON.parse(text),
      endOfLine: "lf",
      editor: editorIndentFromFormattingOptions({ tabSize: 2, insertSpaces: true }),
      readSetting: () => undefined,
    });
    assert.deepEqual(prepared.warnings, []);
    assert.equal(prepared.options.optimizeNumbers, true);
    assert.equal(prepared.options.singleQuote, true);
    assert.equal(prepared.options.tabWidth, 2);

    const source = `{aaa: 'x', bbb: 'y'}`;
    const formatted = TASON.format(source, prepared.options);
    const withoutOptimize = TASON.format(source, { ...prepared.options, optimizeNumbers: false });
    assert.equal(formatted.text, withoutOptimize.text);
    assert.match(formatted.text, /'x'/);
    const decision = decideFormatEdit(source, formatted);
    assert.equal(decision.warning, null);
    assert.equal(decision.replacement, formatted.text);
  });
});
