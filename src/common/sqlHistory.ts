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
    // 定义长度限制常量
    private static readonly MAX_QUERY_LENGTH = 65535;      // 64KB - 1 for query text
    private static readonly MAX_RESULT_LENGTH = 262144;    // 256KB for result data in JSON format
    
    private readonly CREATE_TABLE_SQL: string = `
        CREATE TABLE IF NOT EXISTS _vscode_sql_history (
            id SERIAL PRIMARY KEY,
            query_text VARCHAR(${SQLHistory.MAX_QUERY_LENGTH}) NOT NULL,
            execution_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            duration_ms INTEGER,
            success BOOLEAN NOT NULL,
            database_name TEXT NOT NULL,
            server_host TEXT NOT NULL,
            result_data VARCHAR(${SQLHistory.MAX_RESULT_LENGTH})
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
                const addColumnQuery = `ALTER TABLE _vscode_sql_history ADD COLUMN result_data VARCHAR(${SQLHistory.MAX_RESULT_LENGTH});`;
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

    /**
     * 截断字符串到指定长度，并在超长时记录警告
     */
    private truncateString(value: string, maxLength: number, fieldName: string): string {
        if (!value) return value;
        if (value.length > maxLength) {
            console.warn(`${fieldName} exceeds maximum length of ${maxLength} characters. Original length: ${value.length}. Data will be truncated.`);
            return value.substring(0, maxLength);
        }
        return value;
    }

    /**
     * 截断结果数据（JSON格式），确保不超过最大长度
     */
    private truncateResultData(data: any): any {
        if (!data) return data;
        
        try {
            const jsonStr = JSON.stringify(data);
            if (jsonStr.length > SQLHistory.MAX_RESULT_LENGTH) {
                console.warn(`Result data exceeds maximum length of ${SQLHistory.MAX_RESULT_LENGTH} characters. Original length: ${jsonStr.length}. Data will be truncated.`);
                
                // 截断行数以减小数据大小
                if (data.rows && Array.isArray(data.rows)) {
                    const originalRowCount = data.rows.length;
                    // 二分法逐步减少行数直到数据符合限制
                    let rowCount = Math.floor(originalRowCount / 2);
                    while (rowCount > 0) {
                        const truncatedData = {
                            ...data,
                            rows: data.rows.slice(0, rowCount),
                            rowCount: rowCount,
                            message: `Result truncated from ${originalRowCount} rows to ${rowCount} rows due to size limit`
                        };
                        const truncatedJsonStr = JSON.stringify(truncatedData);
                        if (truncatedJsonStr.length <= SQLHistory.MAX_RESULT_LENGTH) {
                            return truncatedData;
                        }
                        rowCount = Math.floor(rowCount / 2);
                    }
                    
                    // 如果仍然超大，返回元数据只
                    return {
                        rowCount: originalRowCount,
                        command: data.command,
                        message: 'Result data too large, only metadata stored'
                    };
                }
                
                // 如果不是行数据，直接截断JSON字符串
                return JSON.parse(jsonStr.substring(0, SQLHistory.MAX_RESULT_LENGTH));
            }
        } catch (err) {
            console.warn('Error processing result data:', err);
            // 返回安全的元数据
            return {
                message: 'Error processing result data'
            };
        }
        
        return data;
    }

    public async addEntry(entry: SQLHistoryEntry, connectionOptions: IConnection): Promise<void> {
        let connection: PgClient | null = null;
        try {
            console.log('Connecting to database for history recording...');
            connection = new PgClient(connectionOptions);
            await connection.connect();

            // 确保历史表存在
            await this.ensureHistoryTable(connection);

            // 截断长度
            const truncatedQuery = this.truncateString(entry.query, SQLHistory.MAX_QUERY_LENGTH, 'Query text');
            const truncatedResult = this.truncateResultData(entry.result);

            // 插入历史记录
            const insertSql = `
                INSERT INTO _vscode_sql_history 
                (query_text, database_name, server_host, success, duration_ms, result_data)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
            `;
            
            const result = await connection.query(insertSql, [
                truncatedQuery,
                entry.database,
                entry.server,
                entry.success,
                entry.executionTime || null,
                truncatedResult ? JSON.stringify(truncatedResult) : null
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