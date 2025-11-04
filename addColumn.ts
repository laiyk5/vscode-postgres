import BaseCommand from "../common/baseCommand";
import * as vscode from 'vscode';
import { IConnection } from "../common/IConnection";
import { Database } from "../common/database";
import { PostgreSQLTreeDataProvider } from "../tree/treeProvider";
import { TableNode } from "../tree/tableNode";

'use strict';

export class addColumnCommand extends BaseCommand {
  async run(tableNode: TableNode) {
    if (!tableNode || !tableNode.connection || !tableNode.table) {
      vscode.window.showErrorMessage('请选择一个表来添加列');
      return;
    }

    const connection: IConnection = tableNode.connection;
    const tableName: string = tableNode.table;
    const schemaName: string = tableNode.schema || 'public';

    try {
      // 获取列名
      const columnName = await vscode.window.showInputBox({
        prompt: `为表 '${schemaName}.${tableName}' 添加新列`,
        placeHolder: 'column_name',
        validateInput: (value: string) => {
          if (!value || value.trim().length === 0) {
            return '列名不能为空';
          }
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value.trim())) {
            return '列名只能包含字母、数字和下划线，且必须以字母或下划线开头';
          }
          return null;
        }
      });

      if (!columnName) {
        return;
      }

      // 检查列名是否已存在
      const existingColumns = await this.getTableColumns(connection, tableName, schemaName);
      if (existingColumns.some(col => col.toLowerCase() === columnName.trim().toLowerCase())) {
        vscode.window.showErrorMessage(`列 '${columnName}' 已存在`);
        return;
      }

      // 选择数据类型
      const dataTypes = [
        'SERIAL', 'BIGSERIAL', 'SMALLSERIAL',
        'INTEGER', 'BIGINT', 'SMALLINT',
        'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION',
        'CHAR', 'VARCHAR', 'TEXT',
        'BOOLEAN',
        'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ',
        'UUID',
        'JSON', 'JSONB',
        'BYTEA'
      ];

      const selectedType = await vscode.window.showQuickPick(dataTypes, {
        placeHolder: `选择 '${columnName}' 的数据类型`
      });

      if (!selectedType) {
        return;
      }

      let finalType = selectedType;

      // 如果是VARCHAR或CHAR，询问长度
      if (selectedType === 'VARCHAR' || selectedType === 'CHAR') {
        const length = await vscode.window.showInputBox({
          prompt: `输入 ${selectedType} 的长度`,
          placeHolder: '255',
          validateInput: (value: string) => {
            const num = parseInt(value);
            if (isNaN(num) || num <= 0) {
              return '请输入一个正整数';
            }
            return null;
          }
        });
        if (length) {
          finalType = `${selectedType}(${length})`;
        }
      }

      // 询问是否可为空
      const nullableChoice = await vscode.window.showQuickPick(['NOT NULL', 'NULL'], {
        placeHolder: `'${columnName}' 是否可为空？`
      });

      const nullable = nullableChoice === 'NULL';

      // 询问默认值（可选）
      const defaultValue = await vscode.window.showInputBox({
        prompt: `为 '${columnName}' 设置默认值 (可选，直接回车跳过)`,
        placeHolder: '留空表示无默认值'
      });

      // 询问添加位置
      const positionChoice = await vscode.window.showQuickPick([
        '添加到表末尾',
        '添加到指定列之后'
      ], {
        placeHolder: '选择添加位置'
      });

      let afterColumn: string | undefined;
      if (positionChoice === '添加到指定列之后') {
        const columns = await this.getTableColumns(connection, tableName, schemaName);
        afterColumn = await vscode.window.showQuickPick(columns, {
          placeHolder: '选择在哪一列之后添加'
        });
        if (!afterColumn) {
          return;
        }
      }

      // 生成ALTER TABLE SQL语句
      let sql = `ALTER TABLE ${Database.getQuotedIdent(schemaName)}.${Database.getQuotedIdent(tableName)} ADD COLUMN ${Database.getQuotedIdent(columnName)} ${finalType}`;
      
      if (!nullable) {
        sql += ' NOT NULL';
      }
      
      if (defaultValue && defaultValue.trim()) {
        // 对于字符串类型添加引号，对于数字类型不添加
        if (finalType.toLowerCase().includes('char') || finalType.toLowerCase().includes('text')) {
          sql += ` DEFAULT '${defaultValue.trim()}'`;
        } else {
          sql += ` DEFAULT ${defaultValue.trim()}`;
        }
      }

      // 显示预览并确认
      const confirmed = await vscode.window.showInformationMessage(
        `将要执行以下SQL语句添加列：\n\n${sql}`,
        { modal: true },
        '确认添加', '取消'
      );

      if (confirmed !== '确认添加') {
        return;
      }

      // 执行SQL
      const dbConnection = await Database.createConnection(connection);
      try {
        await dbConnection.query(sql);
        
        // 如果指定了位置，需要重新排列列顺序（PostgreSQL不直接支持指定位置）
        if (afterColumn) {
          vscode.window.showInformationMessage(
            `列 '${columnName}' 添加成功！注意：PostgreSQL 不支持直接指定列位置，新列已添加到表末尾。如需调整顺序，请手动重建表。`
          );
        } else {
          vscode.window.showInformationMessage(`列 '${columnName}' 添加成功！`);
        }
        
        // 刷新树视图
        const treeProvider = PostgreSQLTreeDataProvider.getInstance();
        if (treeProvider) {
          treeProvider.refresh(tableNode);
        }
      } finally {
        await dbConnection.end();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`添加列失败: ${error.message}`);
      console.error('Add column error:', error);
    }
  }

  private async getTableColumns(connection: IConnection, tableName: string, schemaName: string): Promise<string[]> {
    const dbConnection = await Database.createConnection(connection);
    try {
      const result = await dbConnection.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = $2
        ORDER BY ordinal_position
      `, [tableName, schemaName]);
      
      return result.rows.map(row => row.column_name);
    } finally {
      await dbConnection.end();
    }
  }
}