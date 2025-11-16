import { IConnection } from "./IConnection";
import { SQLHistory, SQLHistoryEntry } from "./sqlHistory";
import { QueryResults } from "./database";

/**
 * 查询历史记录管理器
 * 负责将查询执行结果转换并保存到历史记录
 */
export class QueryHistoryManager {
  private sqlHistory: SQLHistory;

  constructor() {
    this.sqlHistory = SQLHistory.getInstance();
  }

  /**
   * 检查是否应该记录此查询
   * 某些查询（如历史记录查询本身）不应被记录
   */
  shouldRecordQuery(sql: string): boolean {
    return !sql.toLowerCase().includes('_vscode_sql_history');
  }

  /**
   * 将查询结果转换为历史记录格式
   */
  convertResultsToHistoryFormat(results: QueryResults[]): any {
    return results.map(result => {
      const fields = result.fields.map(field => field.name);
      const rows = result.rows.map(row => {
        const rowData: { [key: string]: any } = {};
        fields.forEach((field, index) => {
          rowData[field] = row[index];
        });
        return rowData;
      });
      return {
        rows: rows,
        rowCount: result.rowCount,
        command: result.command
      };
    });
  }

  /**
   * 记录成功的查询
   */
  async recordSuccessfulQuery(
    sql: string,
    results: QueryResults[],
    connectionOptions: IConnection,
    executionTime: number
  ): Promise<void> {
    if (!this.shouldRecordQuery(sql)) {
      return;
    }

    const historyResults = this.convertResultsToHistoryFormat(results);
    
    await this.sqlHistory.addEntry({
      query: sql,
      database: connectionOptions.database,
      server: connectionOptions.host,
      success: true,
      executionTime: Math.round(executionTime),
      result: historyResults[0] || { rows: [], rowCount: 0, command: '' }
    }, connectionOptions);
  }

  /**
   * 记录失败的查询
   */
  async recordFailedQuery(
    sql: string,
    connectionOptions: IConnection,
    executionTime: number
  ): Promise<void> {
    if (!this.shouldRecordQuery(sql)) {
      return;
    }

    await this.sqlHistory.addEntry({
      query: sql,
      database: connectionOptions.database,
      server: connectionOptions.host,
      success: false,
      executionTime: Math.round(executionTime)
    }, connectionOptions);
  }
}