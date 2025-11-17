import BaseCommand from "../common/baseCommand";
import * as vscode from 'vscode';
import { IConnection } from "../common/IConnection";
import { Database } from "../common/database";
import { PostgreSQLTreeDataProvider } from "../tree/treeProvider";
import { TableNode } from "../tree/tableNode";

'use strict';

interface TableDependency {
  type: string;
  object_name: string;
  schema_name: string;
  dependency_type: string;
}

export class dropTableCommand extends BaseCommand {
  async run(tableNode: TableNode) {
    if (!tableNode || !tableNode.connection || !tableNode.table) {
      vscode.window.showErrorMessage('请选择一个表来删除');
      return;
    }

    const connection: IConnection = tableNode.connection;
    const tableName: string = tableNode.table;
    const schemaName: string = tableNode.schema || 'public';

    try {
      // 检查表的依赖关系
      const dependencies = await this.checkTableDependencies(connection, tableName, schemaName);
      
      let confirmMessage = `确定要删除表 '${schemaName}.${tableName}' 吗？`;
      let hasBlockingDependencies = false;

      if (dependencies.length > 0) {
        const blockingDeps = dependencies.filter(dep => 
          dep.dependency_type === 'FOREIGN_KEY' || 
          dep.dependency_type === 'VIEW' || 
          dep.dependency_type === 'TRIGGER' ||
          dep.dependency_type === 'FUNCTION'
        );

        if (blockingDeps.length > 0) {
          hasBlockingDependencies = true;
          const depList = blockingDeps.map(dep => 
            `- ${dep.dependency_type}: ${dep.schema_name}.${dep.object_name}`
          ).join('\n');
          
          confirmMessage = `⚠️ 警告：表 '${schemaName}.${tableName}' 存在以下依赖关系：\n\n${depList}\n\n删除此表可能会影响这些对象。确定要继续吗？`;
        } else {
          const depList = dependencies.map(dep => 
            `- ${dep.dependency_type}: ${dep.schema_name}.${dep.object_name}`
          ).join('\n');
          
          confirmMessage = `表 '${schemaName}.${tableName}' 存在以下依赖关系：\n\n${depList}\n\n确定要删除吗？`;
        }
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
      await this.executeDropTable(connection, tableName, schemaName, isForceDelete);

      vscode.window.showInformationMessage(`表 '${schemaName}.${tableName}' 删除成功！`);
      
      // 刷新树视图
      const treeProvider = PostgreSQLTreeDataProvider.getInstance();
      if (treeProvider) {
        // 刷新父节点（schema节点）
        treeProvider.refresh();
      }

    } catch (error) {
      vscode.window.showErrorMessage(`删除表失败: ${error.message}`);
      console.error('Drop table error:', error);
    }
  }

  private async checkTableDependencies(connection: IConnection, tableName: string, schemaName: string): Promise<TableDependency[]> {
    const dbConnection = await Database.createConnection(connection);
    const dependencies: TableDependency[] = [];

    try {
      // 检查外键依赖（其他表引用此表）
      const foreignKeyQuery = `
        SELECT 
          'FOREIGN_KEY' as type,
          tc.table_name as object_name,
          tc.table_schema as schema_name,
          'FOREIGN_KEY' as dependency_type
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = $1
          AND ccu.table_schema = $2
          AND (tc.table_name != $1 OR tc.table_schema != $2)
      `;

      const fkResult = await dbConnection.query(foreignKeyQuery, [tableName, schemaName]);
      dependencies.push(...fkResult.rows.map(row => ({
        type: row.type,
        object_name: row.object_name,
        schema_name: row.schema_name,
        dependency_type: row.dependency_type
      })));

      // 检查视图依赖
      const viewQuery = `
        SELECT DISTINCT
          'VIEW' as type,
          v.table_name as object_name,
          v.table_schema as schema_name,
          'VIEW' as dependency_type
        FROM information_schema.views v
        WHERE v.view_definition ILIKE '%' || $2 || '.' || $1 || '%'
           OR v.view_definition ILIKE '%' || $1 || '%'
      `;

      const viewResult = await dbConnection.query(viewQuery, [tableName, schemaName]);
      dependencies.push(...viewResult.rows.map(row => ({
        type: row.type,
        object_name: row.object_name,
        schema_name: row.schema_name,
        dependency_type: row.dependency_type
      })));

      // 检查触发器
      const triggerQuery = `
        SELECT 
          'TRIGGER' as type,
          trigger_name as object_name,
          trigger_schema as schema_name,
          'TRIGGER' as dependency_type
        FROM information_schema.triggers
        WHERE event_object_table = $1
          AND event_object_schema = $2
      `;

      const triggerResult = await dbConnection.query(triggerQuery, [tableName, schemaName]);
      dependencies.push(...triggerResult.rows.map(row => ({
        type: row.type,
        object_name: row.object_name,
        schema_name: row.schema_name,
        dependency_type: row.dependency_type
      })));

      // 检查存储过程和函数依赖
      const functionQuery = `
        SELECT DISTINCT
          'FUNCTION' as type,
          p.proname as object_name,
          n.nspname as schema_name,
          'FUNCTION' as dependency_type
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.prosrc ILIKE '%' || $2 || '.' || $1 || '%'
           OR p.prosrc ILIKE '%' || $1 || '%'
      `;

      const functionResult = await dbConnection.query(functionQuery, [tableName, schemaName]);
      dependencies.push(...functionResult.rows.map(row => ({
        type: row.type,
        object_name: row.object_name,
        schema_name: row.schema_name,
        dependency_type: row.dependency_type
      })));

      // 检查索引（非主键和唯一约束的索引）
      const indexQuery = `
        SELECT 
          'INDEX' as type,
          i.indexname as object_name,
          i.schemaname as schema_name,
          'INDEX' as dependency_type
        FROM pg_indexes i
        WHERE i.tablename = $1
          AND i.schemaname = $2
          AND i.indexname NOT LIKE '%_pkey'
          AND i.indexname NOT LIKE '%_key'
      `;

      const indexResult = await dbConnection.query(indexQuery, [tableName, schemaName]);
      dependencies.push(...indexResult.rows.map(row => ({
        type: row.type,
        object_name: row.object_name,
        schema_name: row.schema_name,
        dependency_type: row.dependency_type
      })));

    } finally {
      await dbConnection.end();
    }

    return dependencies;
  }

  private async executeDropTable(connection: IConnection, tableName: string, schemaName: string, forceDelete: boolean): Promise<void> {
    const dbConnection = await Database.createConnection(connection);
    
    try {
      let sql: string;
      
      if (forceDelete) {
        // 强制删除，使用 CASCADE
        sql = `DROP TABLE ${Database.getQuotedIdent(schemaName)}.${Database.getQuotedIdent(tableName)} CASCADE`;
      } else {
        // 普通删除，使用 RESTRICT（默认行为）
        sql = `DROP TABLE ${Database.getQuotedIdent(schemaName)}.${Database.getQuotedIdent(tableName)} RESTRICT`;
      }

      await dbConnection.query(sql);

    } finally {
      await dbConnection.end();
    }
  }
}