import BaseCommand from "../common/baseCommand";
import * as vscode from 'vscode';
import { IConnection } from "../common/IConnection";
import { Database } from "../common/database";
import { PostgreSQLTreeDataProvider } from "../tree/treeProvider";
import { ColumnNode } from "../tree/columnNode";

'use strict';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  character_maximum_length: number;
  is_nullable: string;
  column_default: string;
  table_name: string;
  table_schema: string;
}

export class alterColumnCommand extends BaseCommand {
  async run(columnNode: ColumnNode) {
    if (!columnNode || !columnNode.column) {
      vscode.window.showErrorMessage('请选择一个列来修改');
      return;
    }

    const connection: IConnection = (columnNode as any).connection;
    const tableName: string = (columnNode as any).tablename;
    const columnName: string = columnNode.column.column_name;
    const schemaName: string = (columnNode as any).schemaname || 'public';

    try {
      // 获取当前列的详细信息
      const columnInfo = await this.getColumnInfo(connection, tableName, columnName, schemaName);
      if (!columnInfo) {
        vscode.window.showErrorMessage('无法获取列信息');
        return;
      }

      // 选择修改类型
      const modifyTypes = [
        '修改数据类型',
        '修改默认值',
        '修改是否可为空',
        '重命名列'
      ];

      const selectedModifyType = await vscode.window.showQuickPick(modifyTypes, {
        placeHolder: `选择要对列 '${columnName}' 进行的修改`
      });

      if (!selectedModifyType) {
        return;
      }

      let sql: string = '';

      switch (selectedModifyType) {
        case '修改数据类型':
          sql = await this.handleDataTypeChange(connection, tableName, columnName, schemaName, columnInfo);
          break;
        case '修改默认值':
          sql = await this.handleDefaultValueChange(connection, tableName, columnName, schemaName, columnInfo);
          break;
        case '修改是否可为空':
          sql = await this.handleNullabilityChange(connection, tableName, columnName, schemaName, columnInfo);
          break;
        case '重命名列':
          sql = await this.handleColumnRename(connection, tableName, columnName, schemaName);
          break;
      }

      if (!sql) {
        return;
      }

      // 显示预览并确认
      const confirmed = await vscode.window.showInformationMessage(
        `将要执行以下SQL语句修改列：\n\n${sql}`,
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
        vscode.window.showInformationMessage(`列 '${columnName}' 修改成功！`);
        
        // 刷新树视图
        const treeProvider = PostgreSQLTreeDataProvider.getInstance();
        if (treeProvider) {
          treeProvider.refresh();
        }
      } finally {
        await dbConnection.end();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`修改列失败: ${error.message}`);
      console.error('Alter column error:', error);
    }
  }

  private async handleDataTypeChange(connection: IConnection, tableName: string, columnName: string, schemaName: string, columnInfo: ColumnInfo): Promise<string> {
    const dataTypes = [
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
      placeHolder: `当前类型: ${columnInfo.data_type}，选择新的数据类型`
    });

    if (!selectedType) {
      return '';
    }

    let finalType = selectedType;

    // 如果是VARCHAR或CHAR，询问长度
    if (selectedType === 'VARCHAR' || selectedType === 'CHAR') {
      const currentLength = columnInfo.character_maximum_length ? columnInfo.character_maximum_length.toString() : '255';
      const length = await vscode.window.showInputBox({
        prompt: `输入 ${selectedType} 的长度`,
        value: currentLength,
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

    // 检查是否需要USING子句进行类型转换
    const needsUsing = await vscode.window.showQuickPick(['自动转换', '手动指定转换表达式'], {
      placeHolder: '选择类型转换方式'
    });

    let usingClause = '';
    if (needsUsing === '手动指定转换表达式') {
      const expression = await vscode.window.showInputBox({
        prompt: '输入USING表达式（例如：column_name::text）',
        placeHolder: `${columnName}::${finalType}`
      });
      if (expression) {
        usingClause = ` USING ${expression}`;
      }
    }

    return `ALTER TABLE ${Database.getQuotedIdent(schemaName)}.${Database.getQuotedIdent(tableName)} ALTER COLUMN ${Database.getQuotedIdent(columnName)} TYPE ${finalType}${usingClause}`;
  }

  private async handleDefaultValueChange(connection: IConnection, tableName: string, columnName: string, schemaName: string, columnInfo: ColumnInfo): Promise<string> {
    const currentDefault = columnInfo.column_default || '无默认值';
    
    const action = await vscode.window.showQuickPick([
      '设置新默认值',
      '删除默认值'
    ], {
      placeHolder: `当前默认值: ${currentDefault}`
    });

    if (!action) {
      return '';
    }

    if (action === '删除默认值') {
      return `ALTER TABLE ${Database.getQuotedIdent(schemaName)}.${Database.getQuotedIdent(tableName)} ALTER COLUMN ${Database.getQuotedIdent(columnName)} DROP DEFAULT`;
    } else {
      const newDefault = await vscode.window.showInputBox({
        prompt: '输入新的默认值',
        value: columnInfo.column_default || '',
        placeHolder: 'NULL, CURRENT_TIMESTAMP, 0, \'text\' 等'
      });

      if (newDefault === undefined) {
        return '';
      }

      return `ALTER TABLE ${Database.getQuotedIdent(schemaName)}.${Database.getQuotedIdent(tableName)} ALTER COLUMN ${Database.getQuotedIdent(columnName)} SET DEFAULT ${newDefault}`;
    }
  }

  private async handleNullabilityChange(connection: IConnection, tableName: string, columnName: string, schemaName: string, columnInfo: ColumnInfo): Promise<string> {
    const currentNullable = columnInfo.is_nullable === 'YES' ? '可为空' : '不可为空';
    const newNullable = columnInfo.is_nullable === 'YES' ? 'SET NOT NULL' : 'DROP NOT NULL';
    const newNullableText = columnInfo.is_nullable === 'YES' ? '不可为空' : '可为空';

    const confirmed = await vscode.window.showQuickPick(['确认修改', '取消'], {
      placeHolder: `当前: ${currentNullable} → 修改为: ${newNullableText}`
    });

    if (confirmed !== '确认修改') {
      return '';
    }

    return `ALTER TABLE ${Database.getQuotedIdent(schemaName)}.${Database.getQuotedIdent(tableName)} ALTER COLUMN ${Database.getQuotedIdent(columnName)} ${newNullable}`;
  }

  private async handleColumnRename(connection: IConnection, tableName: string, columnName: string, schemaName: string): Promise<string> {
    const newName = await vscode.window.showInputBox({
      prompt: '输入新的列名',
      value: columnName,
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) {
          return '列名不能为空';
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value.trim())) {
          return '列名只能包含字母、数字和下划线，且必须以字母或下划线开头';
        }
        if (value.trim() === columnName) {
          return '新列名与当前列名相同';
        }
        return null;
      }
    });

    if (!newName) {
      return '';
    }

    return `ALTER TABLE ${Database.getQuotedIdent(schemaName)}.${Database.getQuotedIdent(tableName)} RENAME COLUMN ${Database.getQuotedIdent(columnName)} TO ${Database.getQuotedIdent(newName)}`;
  }

  private async getColumnInfo(connection: IConnection, tableName: string, columnName: string, schemaName: string): Promise<ColumnInfo | null> {
    const dbConnection = await Database.createConnection(connection);
    try {
      const result = await dbConnection.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default,
          table_name,
          table_schema
        FROM information_schema.columns
        WHERE table_name = $1 
          AND column_name = $2 
          AND table_schema = $3
      `, [tableName, columnName, schemaName]);
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } finally {
      await dbConnection.end();
    }
  }
}