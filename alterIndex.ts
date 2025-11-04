import BaseCommand from "../common/baseCommand";
import * as vscode from 'vscode';
import { IConnection } from "../common/IConnection";
import { Database } from "../common/database";
import { PostgreSQLTreeDataProvider } from "../tree/treeProvider";
import { TableNode } from "../tree/tableNode";

'use strict';

interface IndexInfo {
  indexname: string;
  tablename: string;
  schemaname: string;
  indexdef: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string[];
}

export class alterIndexCommand extends BaseCommand {
  async run(tableNode: TableNode) {
    if (!tableNode || !tableNode.connection || !tableNode.table) {
      vscode.window.showErrorMessage('请选择一个表来修改索引');
      return;
    }

    const connection: IConnection = tableNode.connection;
    const tableName: string = tableNode.table;
    const schemaName: string = tableNode.schema || 'public';

    try {
      // 获取表的所有索引
      const indexes = await this.getTableIndexes(connection, tableName, schemaName);
      
      if (indexes.length === 0) {
        vscode.window.showInformationMessage(`表 '${schemaName}.${tableName}' 没有可修改的索引`);
        return;
      }

      // 创建索引选择列表
      const indexChoices = indexes.map(index => ({
        label: index.indexname,
        description: index.is_primary ? '主键索引' : index.is_unique ? '唯一索引' : '普通索引',
        detail: `列: ${index.columns.join(', ')}`,
        index: index
      }));

      const selectedChoice = await vscode.window.showQuickPick(indexChoices, {
        placeHolder: '选择要修改的索引'
      });

      if (!selectedChoice) {
        return;
      }

      const selectedIndex = selectedChoice.index;

      // 检查是否为系统关键索引
      if (selectedIndex.is_primary) {
        vscode.window.showWarningMessage('主键索引不支持直接修改，请考虑删除后重新创建');
        return;
      }

      // 选择修改类型
      const alterTypes = [
        '重命名索引',
        '重建索引',
        '重建索引（并发）'
      ];

      const selectedAlterType = await vscode.window.showQuickPick(alterTypes, {
        placeHolder: `选择对索引 '${selectedIndex.indexname}' 的修改操作`
      });

      if (!selectedAlterType) {
        return;
      }

      let sql: string = '';

      switch (selectedAlterType) {
        case '重命名索引':
          sql = await this.handleIndexRename(connection, selectedIndex, schemaName);
          break;
        case '重建索引':
          sql = await this.handleIndexReindex(connection, selectedIndex, false);
          break;
        case '重建索引（并发）':
          sql = await this.handleIndexReindex(connection, selectedIndex, true);
          break;
      }

      if (!sql) {
        return;
      }

      // 显示预览并确认
      const confirmed = await vscode.window.showInformationMessage(
        `将要执行以下SQL语句修改索引：\n\n${sql}`,
        { modal: true },
        '确认修改', '取消'
      );

      if (confirmed !== '确认修改') {
        return;
      }

      // 执行SQL
      const dbConnection = await Database.createConnection(connection);
      try {
        await dbConnection.query(sql);
        vscode.window.showInformationMessage(`索引 '${selectedIndex.indexname}' 修改成功！`);
        
        // 刷新树视图
        const treeProvider = PostgreSQLTreeDataProvider.getInstance();
        if (treeProvider) {
          treeProvider.refresh(tableNode);
        }
      } finally {
        await dbConnection.end();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`修改索引失败: ${error.message}`);
      console.error('Alter index error:', error);
    }
  }

  private async handleIndexRename(connection: IConnection, indexInfo: IndexInfo, schemaName: string): Promise<string> {
    const newName = await vscode.window.showInputBox({
      prompt: '输入新的索引名',
      value: indexInfo.indexname,
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) {
          return '索引名不能为空';
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value.trim())) {
          return '索引名只能包含字母、数字和下划线，且必须以字母或下划线开头';
        }
        if (value.trim() === indexInfo.indexname) {
          return '新索引名与当前索引名相同';
        }
        return null;
      }
    });

    if (!newName) {
      return '';
    }

    // 检查新名称是否已存在
    const existingIndexes = await this.getTableIndexes(connection, indexInfo.tablename, schemaName);
    if (existingIndexes.some(idx => idx.indexname.toLowerCase() === newName.trim().toLowerCase())) {
      vscode.window.showErrorMessage(`索引名 '${newName}' 已存在`);
      return '';
    }

    return `ALTER INDEX ${Database.getQuotedIdent(schemaName)}.${Database.getQuotedIdent(indexInfo.indexname)} RENAME TO ${Database.getQuotedIdent(newName)}`;
  }

  private async handleIndexReindex(connection: IConnection, indexInfo: IndexInfo, concurrent: boolean): Promise<string> {
    const warningMessage = concurrent 
      ? `重建索引 '${indexInfo.indexname}' 将并发执行，不会阻塞表的访问，但会消耗更多资源。确定要继续吗？`
      : `重建索引 '${indexInfo.indexname}' 将阻塞表的访问，建议在维护窗口期间执行。确定要继续吗？`;
    
    const confirmed = await vscode.window.showWarningMessage(
      warningMessage,
      { modal: true },
      '确认重建', '取消'
    );

    if (confirmed !== '确认重建') {
      return '';
    }

    let sql = 'REINDEX';
    if (concurrent) {
      sql += ' (VERBOSE)';
    }
    sql += ` INDEX`;
    if (concurrent) {
      sql += ' CONCURRENTLY';
    }
    sql += ` ${Database.getQuotedIdent(indexInfo.schemaname)}.${Database.getQuotedIdent(indexInfo.indexname)}`;

    return sql;
  }

  private async getTableIndexes(connection: IConnection, tableName: string, schemaName: string): Promise<IndexInfo[]> {
    const dbConnection = await Database.createConnection(connection);
    try {
      const result = await dbConnection.query(`
        SELECT 
          i.indexname,
          i.tablename,
          i.schemaname,
          i.indexdef,
          idx.indisunique as is_unique,
          idx.indisprimary as is_primary,
          array_agg(a.attname ORDER BY array_position(idx.indkey, a.attnum)) as columns
        FROM pg_indexes i
        JOIN pg_class c ON c.relname = i.indexname
        JOIN pg_index idx ON idx.indexrelid = c.oid
        JOIN pg_attribute a ON a.attrelid = idx.indrelid AND a.attnum = ANY(idx.indkey)
        WHERE i.tablename = $1 
          AND i.schemaname = $2
          AND NOT idx.indisprimary  -- 排除主键索引
        GROUP BY i.indexname, i.tablename, i.schemaname, i.indexdef, idx.indisunique, idx.indisprimary
        ORDER BY i.indexname
      `, [tableName, schemaName]);
      
      return result.rows;
    } finally {
      await dbConnection.end();
    }
  }
}