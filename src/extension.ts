import * as vscode from "vscode";
import { TasonFormattingProvider } from "./formattingProvider";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider("tason", new TasonFormattingProvider()),
  );
}

export function deactivate(): void {}
