// src/commands/sqlLintSelection.ts
import * as vscode from 'vscode';
import BaseCommand from "../common/baseCommand";

'use strict';

export class sqlLintSelectionCommand extends BaseCommand {
    async run() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('请先打开一个SQL文件');
            return;
        }
        
        // 获取选中的文本
        const selection = editor.selection;
        let sql = editor.document.getText(selection);
        
        if (!sql.trim()) {
            vscode.window.showWarningMessage('请先选择要Lint的SQL代码');
            return;
        }
        
        // Lint 选中的SQL
        const lintedSql = this.lintSql(sql, 'upper');
        
        // 替换选中的文本
        await editor.edit(editBuilder => {
            editBuilder.replace(selection, lintedSql);
        });
        
        vscode.window.showInformationMessage('✅ 选中文本的 SQL Lint 完成！');
    }
    
    private lintSql(sql: string, caseStyle: string): string {
        // 使用之前实现的Lint逻辑
        // ...
    }
}