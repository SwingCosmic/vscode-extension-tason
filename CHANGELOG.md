# Change Log

All notable changes to the "vscode-tason" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.1.0] - 2026-10-10

### Added

- 格式化文档：把全文交给 `TASON.format` 重排。语法错误时提示，并且不修改文本。
- 配置链：工作区根目录 `.tasonrc` 家族、编辑器已解析的缩进、工作区与用户级 `tason.format.*`，逐字段合并。配置文件损坏时跳过并继续格式化。
- `optimizeNumbers` / `optimizeNumberTypeInstances` / `optimizeBlockComments` 可以写入配置，首版不改变输出。Prettier 配置首版不读取。

## [0.0.3]

- Initial release
