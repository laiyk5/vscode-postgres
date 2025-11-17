import BaseCommand from "../common/baseCommand";
import * as vscode from 'vscode';
import { IConnection } from "../common/IConnection";
import { Database } from "../common/database";
import { PostgreSQLTreeDataProvider } from "../tree/treeProvider";

'use strict';

export class createTableCommand extends BaseCommand {
  async run(treeNode: any) {
    if (!treeNode || !treeNode.connection || !treeNode.schemaName) {
      vscode.window.showErrorMessage('请选择一个模式来创建表');
      return;
    }

    const connection: IConnection = treeNode.connection;
    const schemaName: string = treeNode.schemaName;

    // 获取表名
    const tableName = await vscode.window.showInputBox({
      prompt: '请输入表名',
      placeHolder: 'table_name',
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) {
          return '表名不能为空';
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value.trim())) {
          return '表名只能包含字母、数字和下划线，且必须以字母或下划线开头';
        }
        return null;
      }
    });

    if (!tableName) {
      return;
    }

    // 收集列信息
    const columns: Array<{name: string, type: string, nullable: boolean, defaultValue?: string}> = [];
    let addingColumns = true;

    while (addingColumns) {
      // 获取列名
      const columnName = await vscode.window.showInputBox({
        prompt: `为表 '${tableName}' 添加列 (第 ${columns.length + 1} 列)`,
        placeHolder: 'column_name',
        validateInput: (value: string) => {
          if (!value || value.trim().length === 0) {
            return '列名不能为空';
          }
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value.trim())) {
            return '列名只能包含字母、数字和下划线，且必须以字母或下划线开头';
          }
          if (columns.some(col => col.name.toLowerCase() === value.trim().toLowerCase())) {
            return '列名已存在';
          }
          return null;
        }
      });

      if (!columnName) {
        if (columns.length === 0) {
          vscode.window.showWarningMessage('至少需要添加一列');
          continue;
        }
        break;
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
        continue;
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

      columns.push({
        name: columnName.trim(),
        type: finalType,
        nullable: nullable,
        defaultValue: defaultValue?.trim() || undefined
      });

      // 询问是否继续添加列
      const continueAdding = await vscode.window.showQuickPick(['继续添加列', '完成创建表'], {
        placeHolder: '选择下一步操作'
      });

      addingColumns = continueAdding === '继续添加列';
    }

    if (columns.length === 0) {
      vscode.window.showWarningMessage('表至少需要一列');
      return;
    }

    // 生成CREATE TABLE SQL语句
    let sql = `CREATE TABLE ${schemaName}.${tableName} (\n`;
    const columnDefinitions = columns.map(col => {
      let def = `  ${col.name} ${col.type}`;
      if (!col.nullable) {
        def += ' NOT NULL';
      }
      if (col.defaultValue) {
        // 对于字符串类型添加引号，对于数字类型不添加
        if (col.type.toLowerCase().includes('char') || col.type.toLowerCase().includes('text')) {
          def += ` DEFAULT '${col.defaultValue}'`;
        } else {
          def += ` DEFAULT ${col.defaultValue}`;
        }
      }
      return def;
    });
    sql += columnDefinitions.join(',\n');
    sql += '\n);';

    try {
      // 显示预览并确认
      const confirmed = await vscode.window.showInformationMessage(
        `将要执行以下SQL语句创建表：\n\n${sql}`,
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
        vscode.window.showInformationMessage(`表 '${schemaName}.${tableName}' 创建成功！`);
        
        // 刷新树视图
        const treeProvider = PostgreSQLTreeDataProvider.getInstance();
        if (treeProvider) {
          treeProvider.refresh(treeNode);
        }
      } finally {
        await dbConnection.end();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`创建表失败: ${error.message}`);
      console.error('Create table error:', error);
    }
  }
}