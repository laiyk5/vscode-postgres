import BaseCommand from "../common/baseCommand";
import * as vscode from 'vscode';
import { IConnection } from "../common/IConnection";
import { Database } from "../common/database";
import { PostgreSQLTreeDataProvider } from "../tree/treeProvider";
import { TableNode } from "../tree/tableNode";

'use strict';

export class createIndexCommand extends BaseCommand {
  async run(tableNode: TableNode) {
    if (!tableNode || !tableNode.connection || !tableNode.table) {
      vscode.window.showErrorMessage('请选择一个表来创建索引');
      return;
    }

    const connection: IConnection = tableNode.connection;
    const tableName: string = tableNode.table;
    const schemaName: string = tableNode.schema || 'public';

    try {
      // 获取索引名
      const indexName = await vscode.window.showInputBox({
        prompt: `为表 '${schemaName}.${tableName}' 创建索引`,
        placeHolder: 'idx_table_column',
        validateInput: (value: string) => {
          if (!value || value.trim().length === 0) {
            return '索引名不能为空';
          }
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value.trim())) {
            return '索引名只能包含字母、数字和下划线，且必须以字母或下划线开头';
          }
          return null;
        }
      });

      if (!indexName) {
        return;
      }

      // 检查索引名是否已存在
      const existingIndexes = await this.getTableIndexes(connection, tableName, schemaName);
      if (existingIndexes.some(idx => idx.toLowerCase() === indexName.trim().toLowerCase())) {
        vscode.window.showErrorMessage(`索引 '${indexName}' 已存在`);
        return;
      }

      // 选择索引类型
      const indexTypes = [
        { label: 'BTREE', description: '普通B树索引（默认）' },
        { label: 'HASH', description: '哈希索引' },
        { label: 'GIN', description: 'GIN索引（适用于数组、JSON等）' },
        { label: 'GIST', description: 'GIST索引（适用于几何数据等）' },
        { label: 'BRIN', description: 'BRIN索引（适用于大表）' }
      ];

      const selectedType = await vscode.window.showQuickPick(indexTypes, {
        placeHolder: '选择索引类型'
      });

      if (!selectedType) {
        return;
      }

      // 获取表的列信息
      const columns = await this.getTableColumns(connection, tableName, schemaName);
      if (columns.length === 0) {
        vscode.window.showErrorMessage('无法获取表的列信息');
        return;
      }

      // 选择要创建索引的列
      const selectedColumns = await vscode.window.showQuickPick(columns, {
        placeHolder: '选择要创建索引的列（支持多选）',
        canPickMany: true
      });

      if (!selectedColumns || selectedColumns.length === 0) {
        return;
      }

      // 询问是否为唯一索引
      const uniqueChoice = await vscode.window.showQuickPick(['普通索引', '唯一索引'], {
        placeHolder: '选择索引约束类型'
      });

      if (!uniqueChoice) {
        return;
      }

      const isUnique = uniqueChoice === '唯一索引';

      // 询问是否为部分索引
      const partialChoice = await vscode.window.showQuickPick(['完整索引', '部分索引（带WHERE条件）'], {
        placeHolder: '选择索引范围'
      });

      if (!partialChoice) {
        return;
      }

      let whereClause = '';
      if (partialChoice === '部分索引（带WHERE条件）') {
        const condition = await vscode.window.showInputBox({
          prompt: '输入WHERE条件（例如：status = \'active\'）',
          placeHolder: 'column_name = value'
        });
        if (condition && condition.trim()) {
          whereClause = ` WHERE ${condition.trim()}`;
        }
      }

      // 询问是否并发创建
      const concurrentChoice = await vscode.window.showQuickPick(['正常创建', '并发创建（不阻塞表）'], {
        placeHolder: '选择创建方式'
      });

      if (!concurrentChoice) {
        return;
      }

      const isConcurrent = concurrentChoice === '并发创建（不阻塞表）';

      // 生成CREATE INDEX SQL语句
      let sql = 'CREATE';
      if (isUnique) {
        sql += ' UNIQUE';
      }
      sql += ' INDEX';
      if (isConcurrent) {
        sql += ' CONCURRENTLY';
      }
      sql += ` ${Database.getQuotedIdent(indexName)}`;
      sql += ` ON ${Database.getQuotedIdent(schemaName)}.${Database.getQuotedIdent(tableName)}`;
      
      if (selectedType.label !== 'BTREE') {
        sql += ` USING ${selectedType.label}`;
      }
      
      sql += ` (${selectedColumns.map(col => Database.getQuotedIdent(col)).join(', ')})`;
      
      if (whereClause) {
        sql += whereClause;
      }
      
      sql += ';';

      // 显示预览并确认
      const confirmed = await vscode.window.showInformationMessage(
        `将要执行以下SQL语句创建索引：\n\n${sql}`,
        { modal: true },
        '确认创建', '取消'
      );

      if (confirmed !== '确认创建') {
        return;
      }

      // 执行SQL
      const dbConnection = await Database.createConnection(connection);
      try {
        await dbConnection.query(sql);
        
        if (isConcurrent) {
          vscode.window.showInformationMessage(`索引 '${indexName}' 正在后台创建中，请稍后查看结果。`);
        } else {
          vscode.window.showInformationMessage(`索引 '${indexName}' 创建成功！`);
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
      vscode.window.showErrorMessage(`创建索引失败: ${error.message}`);
      console.error('Create index error:', error);
    }
  }

  private async getTableIndexes(connection: IConnection, tableName: string, schemaName: string): Promise<string[]> {
    const dbConnection = await Database.createConnection(connection);
    try {
      const result = await dbConnection.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = $1 AND schemaname = $2
      `, [tableName, schemaName]);
      
      return result.rows.map(row => row.indexname);
    } finally {
      await dbConnection.end();
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