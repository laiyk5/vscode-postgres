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

interface IndexDependency {
  type: string;
  object_name: string;
  schema_name: string;
  dependency_type: string;
  details?: string;
}

export class dropIndexCommand extends BaseCommand {
  async run(tableNode: TableNode) {
    if (!tableNode || !tableNode.connection || !tableNode.table) {
      vscode.window.showErrorMessage('请选择一个表来删除索引');
      return;
    }

    const connection: IConnection = tableNode.connection;
    const tableName: string = tableNode.table;
    const schemaName: string = tableNode.schema || 'public';

    try {
      // 获取表的所有索引
      const indexes = await this.getTableIndexes(connection, tableName, schemaName);
      
      if (indexes.length === 0) {
        vscode.window.showInformationMessage(`表 '${schemaName}.${tableName}' 没有可删除的索引`);
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
        placeHolder: '选择要删除的索引'
      });

      if (!selectedChoice) {
        return;
      }

      const selectedIndex = selectedChoice.index;

      // 检查是否为系统关键索引
      if (selectedIndex.is_primary) {
        const confirmed = await vscode.window.showWarningMessage(
          `⚠️ 警告：'${selectedIndex.indexname}' 是主键索引，删除它将同时删除主键约束。确定要继续吗？`,
          { modal: true },
          '确认删除主键', '取消'
        );
        
        if (confirmed !== '确认删除主键') {
          return;
        }
      }

      // 检查索引的依赖关系
      const dependencies = await this.checkIndexDependencies(connection, selectedIndex.indexname, schemaName);

      let confirmMessage = `确定要删除索引 '${selectedIndex.indexname}' 吗？`;
      let hasBlockingDependencies = false;

      if (dependencies.length > 0) {
        const depList = dependencies.map(dep => 
          `- ${dep.dependency_type}: ${dep.object_name}${dep.details ? ` (${dep.details})` : ''}`
        ).join('\n');
        
        confirmMessage = `索引 '${selectedIndex.indexname}' 存在以下依赖关系：\n\n${depList}\n\n删除此索引可能会影响这些对象。确定要继续吗？`;
        hasBlockingDependencies = true;
      }

      // 询问是否并发删除
      const deleteOptions = [
        '正常删除',
        '并发删除（不阻塞表）'
      ];

      if (hasBlockingDependencies) {
        deleteOptions.push('强制删除（CASCADE）');
      }

      const deleteChoice = await vscode.window.showQuickPick(deleteOptions, {
        placeHolder: confirmMessage
      });

      if (!deleteChoice) {
        return;
      }

      // 最终确认
      const finalConfirm = await vscode.window.showWarningMessage(
        `最终确认：删除索引 '${selectedIndex.indexname}'？`,
        { modal: true },
        '确认删除', '取消'
      );

      if (finalConfirm !== '确认删除') {
        return;
      }

      // 执行删除
      await this.executeDropIndex(connection, selectedIndex, deleteChoice);

      vscode.window.showInformationMessage(`索引 '${selectedIndex.indexname}' 删除成功！`);
      
      // 刷新树视图
      const treeProvider = PostgreSQLTreeDataProvider.getInstance();
      if (treeProvider) {
        treeProvider.refresh(tableNode);
      }

    } catch (error) {
      vscode.window.showErrorMessage(`删除索引失败: ${error.message}`);
      console.error('Drop index error:', error);
    }
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
          AND NOT idx.indisprimary  -- 排除主键索引，除非特别需要
        GROUP BY i.indexname, i.tablename, i.schemaname, i.indexdef, idx.indisunique, idx.indisprimary
        
        UNION ALL
        
        -- 包含主键索引，但单独标识
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
          AND idx.indisprimary  -- 只包含主键索引
        GROUP BY i.indexname, i.tablename, i.schemaname, i.indexdef, idx.indisunique, idx.indisprimary
        
        ORDER BY is_primary DESC, indexname
      `, [tableName, schemaName]);
      
      return result.rows;
    } finally {
      await dbConnection.end();
    }
  }

  private async checkIndexDependencies(connection: IConnection, indexName: string, schemaName: string): Promise<IndexDependency[]> {
    const dbConnection = await Database.createConnection(connection);
    const dependencies: IndexDependency[] = [];

    try {
      // 检查是否有外键约束依赖此索引
      const fkQuery = `
        SELECT DISTINCT
          'FOREIGN_KEY' as type,
          tc.constraint_name as object_name,
          tc.table_schema as schema_name,
          'FOREIGN_KEY' as dependency_type,
          'Foreign key constraint' as details
        FROM information_schema.table_constraints tc
        JOIN pg_constraint pgc ON pgc.conname = tc.constraint_name
        JOIN pg_class pgi ON pgi.oid = pgc.conindid
        WHERE pgi.relname = $1
          AND tc.table_schema = $2
          AND tc.constraint_type = 'FOREIGN KEY'
      `;

      const fkResult = await dbConnection.query(fkQuery, [indexName, schemaName]);
      dependencies.push(...fkResult.rows.map(row => ({
        type: row.type,
        object_name: row.object_name,
        schema_name: row.schema_name,
        dependency_type: row.dependency_type,
        details: row.details
      })));

      // 检查是否有唯一约束依赖此索引
      const uniqueQuery = `
        SELECT DISTINCT
          'UNIQUE_CONSTRAINT' as type,
          tc.constraint_name as object_name,
          tc.table_schema as schema_name,
          'UNIQUE_CONSTRAINT' as dependency_type,
          'Unique constraint' as details
        FROM information_schema.table_constraints tc
        JOIN pg_constraint pgc ON pgc.conname = tc.constraint_name
        JOIN pg_class pgi ON pgi.oid = pgc.conindid
        WHERE pgi.relname = $1
          AND tc.table_schema = $2
          AND tc.constraint_type = 'UNIQUE'
      `;

      const uniqueResult = await dbConnection.query(uniqueQuery, [indexName, schemaName]);
      dependencies.push(...uniqueResult.rows.map(row => ({
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

  private async executeDropIndex(connection: IConnection, indexInfo: IndexInfo, deleteMode: string): Promise<void> {
    const dbConnection = await Database.createConnection(connection);
    
    try {
      let sql: string;
      
      if (indexInfo.is_primary) {
        // 删除主键索引需要删除主键约束
        sql = `ALTER TABLE ${Database.getQuotedIdent(indexInfo.schemaname)}.${Database.getQuotedIdent(indexInfo.tablename)} DROP CONSTRAINT ${Database.getQuotedIdent(indexInfo.indexname)}`;
        if (deleteMode === '强制删除（CASCADE）') {
          sql += ' CASCADE';
        }
      } else {
        // 删除普通索引
        sql = 'DROP INDEX';
        
        if (deleteMode === '并发删除（不阻塞表）') {
          sql += ' CONCURRENTLY';
        }
        
        sql += ` ${Database.getQuotedIdent(indexInfo.schemaname)}.${Database.getQuotedIdent(indexInfo.indexname)}`;
        
        if (deleteMode === '强制删除（CASCADE）') {
          sql += ' CASCADE';
        }
      }

      await dbConnection.query(sql);

    } finally {
      await dbConnection.end();
    }
  }
}