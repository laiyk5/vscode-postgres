import BaseCommand from "../common/baseCommand";
import * as vscode from 'vscode';
import { IConnection } from "../common/IConnection";
import { Database } from "../common/database";
import { PostgreSQLTreeDataProvider } from "../tree/treeProvider";
import { ColumnNode } from "../tree/columnNode";

'use strict';

interface ColumnDependency {
  type: string;
  object_name: string;
  schema_name: string;
  dependency_type: string;
  details?: string;
}

export class dropColumnCommand extends BaseCommand {
  async run(columnNode: ColumnNode) {
    if (!columnNode || !columnNode.column) {
      vscode.window.showErrorMessage('请选择一个列来删除');
      return;
    }

    const connection: IConnection = (columnNode as any).connection;
    const tableName: string = (columnNode as any).tablename;
    const columnName: string = columnNode.column.column_name;
    const schemaName: string = (columnNode as any).schemaname || 'public';

    try {
      // 检查列的依赖关系
      const dependencies = await this.checkColumnDependencies(connection, tableName, columnName, schemaName);
      
      // 检查是否为主键列
      const isPrimaryKey = await this.isPrimaryKeyColumn(connection, tableName, columnName, schemaName);
      
      // 检查是否为外键列
      const isForeignKey = await this.isForeignKeyColumn(connection, tableName, columnName, schemaName);

      let confirmMessage = `确定要删除列 '${schemaName}.${tableName}.${columnName}' 吗？`;
      let hasBlockingDependencies = false;
      let warnings: string[] = [];

      // 检查主键约束
      if (isPrimaryKey) {
        warnings.push('⚠️ 警告：这是一个主键列');
        hasBlockingDependencies = true;
      }

      // 检查外键约束
      if (isForeignKey) {
        warnings.push('⚠️ 警告：这是一个外键列');
        hasBlockingDependencies = true;
      }

      // 检查其他依赖关系
      if (dependencies.length > 0) {
        const blockingDeps = dependencies.filter(dep => 
          dep.dependency_type === 'INDEX' || 
          dep.dependency_type === 'VIEW' || 
          dep.dependency_type === 'TRIGGER' ||
          dep.dependency_type === 'FUNCTION' ||
          dep.dependency_type === 'CHECK_CONSTRAINT'
        );

        if (blockingDeps.length > 0) {
          hasBlockingDependencies = true;
          const depList = blockingDeps.map(dep => 
            `- ${dep.dependency_type}: ${dep.object_name}${dep.details ? ` (${dep.details})` : ''}`
          ).join('\n');
          
          warnings.push(`发现以下依赖关系：\n${depList}`);
        }
      }

      if (warnings.length > 0) {
        confirmMessage = `${warnings.join('\n\n')}\n\n删除此列可能会影响这些对象。确定要继续吗？`;
      }

      // 显示确认对话框
      const choice = await vscode.window.showWarningMessage(
        confirmMessage,
        { modal: true },
        hasBlockingDependencies ? '强制删除' : '确认删除',
        '取消'
      );

      if (choice === '取消' || !choice) {
        return;
      }

      // 根据用户选择执行不同的删除策略
      const isForceDelete = choice === '强制删除';
      await this.executeDropColumn(connection, tableName, columnName, schemaName, isForceDelete);

      vscode.window.showInformationMessage(`列 '${columnName}' 删除成功！`);
      
      // 刷新树视图
      const treeProvider = PostgreSQLTreeDataProvider.getInstance();
      if (treeProvider) {
        treeProvider.refresh();
      }

    } catch (error) {
      vscode.window.showErrorMessage(`删除列失败: ${error.message}`);
      console.error('Drop column error:', error);
    }
  }

  private async checkColumnDependencies(connection: IConnection, tableName: string, columnName: string, schemaName: string): Promise<ColumnDependency[]> {
    const dbConnection = await Database.createConnection(connection);
    const dependencies: ColumnDependency[] = [];

    try {
      // 检查索引依赖
      const indexQuery = `
        SELECT DISTINCT
          'INDEX' as type,
          i.indexname as object_name,
          i.schemaname as schema_name,
          'INDEX' as dependency_type,
          'Index on column' as details
        FROM pg_indexes i
        JOIN pg_attribute a ON a.attname = ANY(string_to_array(replace(replace(i.indexdef, '(', ''), ')', ''), ', '))
        JOIN pg_class c ON c.relname = i.tablename
        JOIN pg_namespace n ON n.nspname = i.schemaname AND n.oid = c.relnamespace
        WHERE i.tablename = $1 
          AND i.schemaname = $2
          AND a.attname = $3
          AND a.attrelid = c.oid
      `;

      const indexResult = await dbConnection.query(indexQuery, [tableName, schemaName, columnName]);
      dependencies.push(...indexResult.rows.map(row => ({
        type: row.type,
        object_name: row.object_name,
        schema_name: row.schema_name,
        dependency_type: row.dependency_type,
        details: row.details
      })));

      // 检查视图依赖
      const viewQuery = `
        SELECT DISTINCT
          'VIEW' as type,
          v.table_name as object_name,
          v.table_schema as schema_name,
          'VIEW' as dependency_type,
          'View references column' as details
        FROM information_schema.views v
        WHERE v.view_definition ILIKE '%' || $2 || '.' || $1 || '.' || $3 || '%'
           OR v.view_definition ILIKE '%' || $1 || '.' || $3 || '%'
           OR v.view_definition ILIKE '%' || $3 || '%'
      `;

      const viewResult = await dbConnection.query(viewQuery, [tableName, schemaName, columnName]);
      dependencies.push(...viewResult.rows.map(row => ({
        type: row.type,
        object_name: row.object_name,
        schema_name: row.schema_name,
        dependency_type: row.dependency_type,
        details: row.details
      })));

      // 检查触发器依赖
      const triggerQuery = `
        SELECT 
          'TRIGGER' as type,
          trigger_name as object_name,
          trigger_schema as schema_name,
          'TRIGGER' as dependency_type,
          'Trigger on table' as details
        FROM information_schema.triggers
        WHERE event_object_table = $1
          AND event_object_schema = $2
      `;

      const triggerResult = await dbConnection.query(triggerQuery, [tableName, schemaName]);
      dependencies.push(...triggerResult.rows.map(row => ({
        type: row.type,
        object_name: row.object_name,
        schema_name: row.schema_name,
        dependency_type: row.dependency_type,
        details: row.details
      })));

      // 检查CHECK约束
      const checkQuery = `
        SELECT 
          'CHECK_CONSTRAINT' as type,
          tc.constraint_name as object_name,
          tc.table_schema as schema_name,
          'CHECK_CONSTRAINT' as dependency_type,
          'Check constraint on column' as details
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc ON cc.constraint_name = tc.constraint_name
        WHERE tc.table_name = $1 
          AND tc.table_schema = $2
          AND tc.constraint_type = 'CHECK'
          AND cc.check_clause ILIKE '%' || $3 || '%'
      `;

      const checkResult = await dbConnection.query(checkQuery, [tableName, schemaName, columnName]);
      dependencies.push(...checkResult.rows.map(row => ({
        type: row.type,
        object_name: row.object_name,
        schema_name: row.schema_name,
        dependency_type: row.dependency_type,
        details: row.details
      })));

    } finally {
      await dbConnection.end();
    }

    return dependencies;
  }

  private async isPrimaryKeyColumn(connection: IConnection, tableName: string, columnName: string, schemaName: string): Promise<boolean> {
    const dbConnection = await Database.createConnection(connection);
    try {
      const result = await dbConnection.query(`
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 
          AND tc.table_schema = $2
          AND kcu.column_name = $3
          AND tc.constraint_type = 'PRIMARY KEY'
      `, [tableName, schemaName, columnName]);
      
      return result.rows.length > 0;
    } finally {
      await dbConnection.end();
    }
  }

  private async isForeignKeyColumn(connection: IConnection, tableName: string, columnName: string, schemaName: string): Promise<boolean> {
    const dbConnection = await Database.createConnection(connection);
    try {
      const result = await dbConnection.query(`
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 
          AND tc.table_schema = $2
          AND kcu.column_name = $3
          AND tc.constraint_type = 'FOREIGN KEY'
      `, [tableName, schemaName, columnName]);
      
      return result.rows.length > 0;
    } finally {
      await dbConnection.end();
    }
  }

  private async executeDropColumn(connection: IConnection, tableName: string, columnName: string, schemaName: string, forceDelete: boolean): Promise<void> {
    const dbConnection = await Database.createConnection(connection);
    
    try {
      let sql: string;
      
      if (forceDelete) {
        // 强制删除，使用 CASCADE
        sql = `ALTER TABLE ${Database.getQuotedIdent(schemaName)}.${Database.getQuotedIdent(tableName)} DROP COLUMN ${Database.getQuotedIdent(columnName)} CASCADE`;
      } else {
        // 普通删除，使用 RESTRICT（默认行为）
        sql = `ALTER TABLE ${Database.getQuotedIdent(schemaName)}.${Database.getQuotedIdent(tableName)} DROP COLUMN ${Database.getQuotedIdent(columnName)} RESTRICT`;
      }

      await dbConnection.query(sql);

    } finally {
      await dbConnection.end();
    }
  }
}