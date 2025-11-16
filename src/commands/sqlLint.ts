import * as vscode from 'vscode';
import BaseCommand from "../common/baseCommand";

'use strict';

export class sqlLintCommand extends BaseCommand {
    async run() {
        // 显示成功消息确认命令已触发
        vscode.window.showInformationMessage('🎉 SQL Lint 命令已成功执行！');
        
        // 获取当前编辑器
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('请先打开一个SQL文件');
            return;
        }
        
        // 获取SQL内容
        const sql = editor.document.getText();
        if (!sql.trim()) {
            vscode.window.showWarningMessage('当前文件没有SQL内容');
            return;
        }
        
        // 简单的Lint功能：关键字大写
        const lintedSql = this.lintSql(sql, 'upper');
        
        // 在新编辑器中显示结果
        const document = await vscode.workspace.openTextDocument({
            content: lintedSql,
            language: 'postgres'
        });
        
        await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
        vscode.window.showInformationMessage('SQL Lint 完成！');
    }
    
    private lintSql(sql: string, caseStyle: string): string {
        // 定义SQL关键字列表
        const keywords = [
            'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE',
            'TABLE', 'VIEW', 'INDEX', 'ON', 'AND', 'OR', 'NOT', 'NULL', 'AS',
            'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'GROUP BY',
            'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'VALUES', 'SET', 'INTO'
        ];
        
        let result = sql;
        
        // 转换关键字大小写
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            result = result.replace(regex, caseStyle === 'upper' 
                ? keyword.toUpperCase() 
                : keyword.toLowerCase());
        });
        
        return result;
    }
}