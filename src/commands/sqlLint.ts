import * as vscode from 'vscode';
import BaseCommand from "../common/baseCommand";

'use strict';

export class sqlLintCommand extends BaseCommand {
    async run() {
        // 获取配置
        const config = vscode.workspace.getConfiguration('vscode-postgres');
        const caseStyle = config.get<string>('sqlLint.caseStyle', 'upper');
        
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
        
        // Lint SQL
        const lintedSql = this.lintSql(sql, caseStyle);
        
        // 在新编辑器中显示结果
        const document = await vscode.workspace.openTextDocument({
            content: lintedSql,
            language: 'postgres'
        });
        
        await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
        vscode.window.showInformationMessage('✅ SQL Lint 完成！');
    }
    
    private lintSql(sql: string, caseStyle: string): string {
    // 应用所有规则
    let result = sql;
    
    result = this.formatKeywords(result, caseStyle);
    result = this.replaceSelectStar(result);
    result = this.convertImplicitJoins(result);
    result = this.formatAliases(result);
    result = this.formatIndentation(result);
    result = this.addSemicolon(result);
    result = this.detectPotentialIssues(result);
    
    return result;
}
    
    private formatKeywords(sql: string, caseStyle: string): string {
    const keywords = [
        'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE',
        'TABLE', 'VIEW', 'INDEX', 'ON', 'AND', 'OR', 'NOT', 'NULL', 'AS',
        'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'GROUP BY',
        'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'VALUES', 'SET', 'INTO',
        'DISTINCT', 'BETWEEN', 'LIKE', 'IN', 'IS', 'EXISTS', 'CASE', 'WHEN',
        'THEN', 'ELSE', 'END', 'UNION', 'ALL', 'HAVING', 'WITH', 'RECURSIVE'
    ];
    
    return sql.replace(
        new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi'),
        (match) => caseStyle === 'upper' 
            ? match.toUpperCase() 
            : match.toLowerCase()
    );
}
    
    private formatIndentation(sql: string): string {
    const indentSize = 4;
    let indentLevel = 0;
    let result = '';
    
    const clauses = [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
        'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'UNION ALL'
    ];
    
    const lines = sql.split('\n');
    
    for (let line of lines) {
        const trimmedLine = line.trim();
        
        // 减少缩进级别
        if (trimmedLine.startsWith('END') || 
            trimmedLine.startsWith('ELSE') || 
            trimmedLine.startsWith(')')) {
            indentLevel = Math.max(0, indentLevel - 1);
        }
        
        // 添加缩进
        result += ' '.repeat(indentLevel * indentSize) + trimmedLine + '\n';
        
        // 增加缩进级别
        if (trimmedLine.startsWith('CASE') || 
            trimmedLine.startsWith('WHEN') || 
            trimmedLine.startsWith('THEN') || 
            trimmedLine.startsWith('ELSE') ||
            trimmedLine.startsWith('(')) {
            indentLevel++;
        }
        
        // 检查子句增加缩进
        if (clauses.some(clause => trimmedLine.startsWith(clause))) {
            indentLevel++;
        }
    }
    
    return result.trim();
}
    
    private replaceSelectStar(sql: string): string {
    return sql.replace(
        /SELECT\s+\*\s+FROM/gi,
        (match) => {
            return match.replace('*', '/* 避免使用 SELECT *，明确指定需要的列 */');
        }
    );
}
    
    private convertImplicitJoins(sql: string): string {
    return sql.replace(
        /FROM\s+([\w\s,]+)\s+WHERE\s+([\w.]+)\s*=\s*([\w.]+)/gi,
        (match, tables, col1, col2) => {
            const [table1, table2] = tables.split(',').map(t => t.trim());
            return `FROM ${table1}\nJOIN ${table2} ON ${col1} = ${col2}`;
        }
    );
}
    
    private addSemicolon(sql: string): string {
    const trimmed = sql.trim();
    if (!trimmed.endsWith(';')) {
        return trimmed + ';';
    }
    return sql;
}
    
    private detectPotentialIssues(sql: string): string {
    let warnings = [];
    
    // 检测 N+1 查询模式
    if (sql.includes('SELECT') && sql.includes('WHERE') && 
        sql.match(/SELECT/g)?.length > 1) {
        warnings.push('⚠️ 警告：可能存在 N+1 查询问题，考虑使用 JOIN 优化');
    }
    
    // 检测缺少索引的列
    const whereColumns = sql.match(/WHERE\s+([\w.]+)\s*[=<>]/gi) || [];
    const joinColumns = sql.match(/JOIN\s+[\w.]+\s+ON\s+([\w.]+)\s*=\s*[\w.]+/gi) || [];
    
    const allColumns = [...whereColumns, ...joinColumns]
        .map(col => col.replace(/WHERE\s+|JOIN\s+[\w.]+\s+ON\s+/gi, '').split(/\s*[=<>]\s*/)[0]);
    
    if (allColumns.length > 0) {
        warnings.push('🔍 提示：确保以下列有索引: ' + [...new Set(allColumns)].join(', '));
    }
    
    // 检测 SQL 注入风险
    if (sql.includes("'") && !sql.includes('$1')) {
        warnings.push('🛡️ 警告：直接拼接字符串值，考虑使用参数化查询防止 SQL 注入');
    }
    
    return warnings.length > 0 
        ? `/*\n${warnings.join('\n')}\n*/\n\n${sql}` 
        : sql;
}
    
    private formatAliases(sql: string): string {
    return sql.replace(
        /(FROM|JOIN)\s+(\w+)\s+(\w+)/gi,
        (match, clause, table, alias) => {
            return `${clause} ${table} AS ${alias}`;
        }
    );
}
}