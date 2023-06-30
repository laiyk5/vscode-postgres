import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PgClient } from './connection';
import { IConnection } from './IConnection';
import { Database } from "./database";

export interface SQLHistoryEntry {
    query: string;
    database: string;
    server: string;
    success: boolean;
    executionTime?: number;
    result?: any;
}

export class SQLHistory {
    private static instance: SQLHistory;
    private readonly CREATE_TABLE_SQL: string = `
        CREATE TABLE IF NOT EXISTS _vscode_sql_history (
            id SERIAL PRIMARY KEY,
            query_text TEXT NOT NULL,
            execution_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            duration_ms INTEGER,
            success BOOLEAN NOT NULL,
            database_name TEXT NOT NULL,
            server_host TEXT NOT NULL,
            result_data JSONB
        );
    `;

    private constructor() {}

    public static getInstance(): SQLHistory {
        if (!SQLHistory.instance) {
            SQLHistory.instance = new SQLHistory();
        }
        return SQLHistory.instance;
    }

    private async ensureHistoryTable(connection: PgClient): Promise<void> {
        try {
            console.log('Creating or verifying history table...');
            // 首先，确保表存在
            await connection.query(this.CREATE_TABLE_SQL);

            // 然后，检查 result_data 列是否存在
            const checkColumnQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='_vscode_sql_history' AND column_name='result_data';
            `;
            const result = await connection.query(checkColumnQuery);

            // 如果列不存在，就添加它
            if (result.rows.length === 0) {
                console.log('Adding result_data column to history table...');
                const addColumnQuery = `ALTER TABLE _vscode_sql_history ADD COLUMN result_data JSONB;`;
                await connection.query(addColumnQuery);
                console.log('result_data column added.');
            }

            console.log('History table is ready');
        } catch (err) {
            console.error('Error ensuring history table exists:', err);
            vscode.window.showErrorMessage('Failed to create or update SQL history table: ' + err.message);
            throw err;
        }
    }

    public async addEntry(entry: SQLHistoryEntry, connectionOptions: IConnection): Promise<void> {
        let connection: PgClient | null = null;
        try {
            console.log('Connecting to database for history recording...');
            connection = new PgClient(connectionOptions);
            await connection.connect();

            // 确保历史表存在
            await this.ensureHistoryTable(connection);

            // 插入历史记录
            const insertSql = `
                INSERT INTO _vscode_sql_history 
                (query_text, database_name, server_host, success, duration_ms, result_data)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
            `;
            
            const result = await connection.query(insertSql, [
                entry.query,
                entry.database,
                entry.server,
                entry.success,
                entry.executionTime || null,
                entry.result ? JSON.stringify(entry.result) : null
            ]);

            console.log('SQL history entry saved with ID:', result.rows[0]?.id);
            // 不显示通知以避免过多的弹窗
            // vscode.window.showInformationMessage('SQL查询历史已保存到数据库');

        } catch (err) {
            console.error('Error saving SQL history:', err);
            // 只在开发模式下显示错误
            if (process.env.NODE_ENV === 'development') {
                vscode.window.showErrorMessage('Failed to save SQL history: ' + err.message);
            }
        } finally {
            if (connection) {
                try {
                    await connection.end();
                } catch (err) {
                    console.error('Error closing connection:', err);
                }
            }
        }
    }

    public async viewHistory(connectionOptions: IConnection): Promise<void> {
        const viewSql = `
            SELECT 
                id,
                query_text,
                execution_time,
                duration_ms,
                success,
                database_name,
                server_host,
                result_data
            FROM _vscode_sql_history
            ORDER BY execution_time DESC
            LIMIT 100
        `;

        try {
            // 创建一个新的查询窗口并执行查询
            const document = await vscode.workspace.openTextDocument({
                content: viewSql,
                language: 'postgres'
            });
            const editor = await vscode.window.showTextDocument(document);
            
            // 使用 Database.runQuery 来执行查询并显示结果
            await Database.runQuery(viewSql, editor, connectionOptions, true);

        } catch (err) {
            console.error('Error viewing SQL history:', err);
            vscode.window.showErrorMessage('Failed to view SQL history: ' + err.message);
        }
    }
}