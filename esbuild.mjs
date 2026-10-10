import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import * as esbuild from "esbuild";

// antlr4 的 node ESM 包用 import.meta.url 取 fs。打进 CJS 后 import.meta 是空对象，
// createRequire 会抛错。改走它自带的 CJS 构建。包的 exports 未列出 package.json，
// 所以从导入方目录向上找 node_modules，而不是 require.resolve 子路径。
function findAntlr4Cjs(startDir) {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, "node_modules", "antlr4", "dist", "antlr4.node.cjs");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`找不到 antlr4 的 CJS 构建（从 ${startDir} 向上）`);
    }
    dir = parent;
  }
}

const antlr4Cjs = {
  name: "antlr4-cjs",
  setup(build) {
    build.onResolve({ filter: /^antlr4$/ }, (args) => ({
      path: findAntlr4Cjs(args.resolveDir),
    }));
  },
};

const test = process.argv.includes("--test");
const watch = process.argv.includes("--watch");

if (test) {
  await esbuild.build({
    entryPoints: ["test/resolveFormatConfig.test.ts"],
    bundle: true,
    outfile: "dist-test/resolveFormatConfig.test.cjs",
    format: "cjs",
    platform: "node",
    target: "node18",
    sourcemap: true,
    logLevel: "info",
    plugins: [antlr4Cjs],
  });
  const result = spawnSync(
    process.execPath,
    ["--test", "dist-test/resolveFormatConfig.test.cjs"],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  logLevel: "info",
  plugins: [antlr4Cjs],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
