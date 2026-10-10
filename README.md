# TASON Language Support

[TASON](https://github.com/SwingCosmic/tason) 的语法高亮与文档格式化。

语法高亮参考 VSCode 自带 JSON 的配置，把类型实例（TypeInstance）里的类型名渲染为 `entity.name.type`。

## 格式化文档

对 `.tason` 文件执行「格式化文档」。扩展只把全文交给 `TASON.format`，不自带第二套语法。语法有错误时弹出警告，文档保持原样。

选项与行为见 [格式化](https://github.com/SwingCosmic/tason/blob/master/docs/formatting.md)。三个 `optimize*` 首版未实现。Prettier 配置首版不读取。

### 配置从高到低

每一层只取**显式写上**的字段。设置页里的默认空值不参与合并。

1. 工作区根目录的 `.tasonrc`、`.tasonrc.json`、`.tasonrc.jsonc`、`.tasonrc.tason`（按此顺序取第一个存在的文件）。内容用 TASON 解析，键名与格式化选项一致。文件损坏或结果不是对象时提示并跳过，格式化继续。
2. 编辑器已经解析好的缩进（`tabSize` / `insertSpaces`，含 EditorConfig 扩展写进编辑器的结果），以及工作区设置 `tason.format.*`。同一字段以工作区里显式改过的 `tason.format.*` 为准。扩展不读 `.editorconfig`，也不读 `editor.*`。
3. 用户级全局设置 `tason.format.*`。其中的 `tabWidth` / `useTabs` 不会盖过第 2 层的编辑器缩进。
4. 默认：未设置引号时按文档统计（`singleQuote: "auto"`）；换行跟随文档，显式配置可以覆盖。

`.tasonrc` 只查文档所属工作区文件夹的根目录，不向上查找。

```js
// .tasonrc
{
  printWidth: 100,
  singleQuote: true,
  trailingComma: "none",
}
```

## 开发

本目录是 [tason](https://github.com/SwingCosmic/tason) 仓库里的 git submodule，依赖旁边的 `packages/tason`（`file:../../packages/tason`）。先在仓库根构建核心包，再在本目录安装并打包：

```bash
# 仓库根，Node.js 18+
yarn workspace tason build

# 本目录
npm install
npm test
npm run build
```

用 VSCode 打开本目录，按 F5 启动扩展开发主机。`npm run package` 生成 `.vsix`。
