import * as vscode from "vscode";
import TASON from "tason";
import { decideFormatEdit } from "./formatDocument";
import {
  collectFormatInput,
  editorIndentFromFormattingOptions,
  type FormatOptionKey,
} from "./resolveFormatConfig";

export class TasonFormattingProvider implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    editorOptions: vscode.FormattingOptions,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.TextEdit[]> {
    if (token.isCancellationRequested) return [];

    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    const prepared = collectFormatInput({
      rootDir: folder?.uri.fsPath,
      parse: (text) => TASON.parse(text),
      endOfLine: document.eol === vscode.EndOfLine.CRLF ? "crlf" : "lf",
      editor: editorIndentFromFormattingOptions(editorOptions),
      readSetting: (key: FormatOptionKey) =>
        vscode.workspace.getConfiguration("tason.format", document.uri).inspect(key),
    });

    if (token.isCancellationRequested) return [];

    for (const warning of prepared.warnings) {
      void vscode.window.showWarningMessage(warning);
    }

    const text = document.getText();
    const result = TASON.format(text, prepared.options);
    const decision = decideFormatEdit(text, result);
    if (decision.warning) void vscode.window.showWarningMessage(decision.warning);
    if (decision.replacement == null) return [];

    return [
      vscode.TextEdit.replace(
        new vscode.Range(document.positionAt(0), document.positionAt(text.length)),
        decision.replacement,
      ),
    ];
  }
}
