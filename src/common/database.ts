import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';
// import { Pool, Client, types, ClientConfig } from 'pg';
import { PgClient } from './connection';
import { IConnection } from "./IConnection";
import { OutputChannel } from './outputChannel';
import { performance } from 'perf_hooks';
import { SQLHistory } from './sqlHistory';
import { QueryHistoryManager } from './queryHistoryManager';


export interface FieldInfo {
  columnID: number;
  dataTypeID: number;
  dataTypeModifier: number;
  dataTypeSize: number;
  format: string;
  name: string;
  tableID: number;
  display_type?: string;
};

export interface QueryResults {
  rowCount: number;
  command: string;
  rows?: any[];
  fields?: FieldInfo[];
  flaggedForDeletion?: boolean;
  message?: string;
};

export interface TypeResult {
  oid: number;
  typname: string;
  display_type?: string;
};

export interface TypeResults {
  rowCount: number;
  command: string;
  rows?: TypeResult[];
  fields?: FieldInfo[];
}

let queryCounter: number = 0;

export class Database {

  private static queryHistoryManager = new QueryHistoryManager();
  // could probably be simplified, essentially matches Postgres' built-in algorithm without the char pointers
  static getQuotedIdent(name: string): string {
    let result = '"';
    for (let i = 0; i < name.length; i++) {
      if (name.charAt(i) === '"')
        result += name.charAt(i);
      result += name.charAt(i);
    }
    return result + '"';
  }

  static getConnectionWithDB(connection: IConnection, dbname?: string): IConnection {
    if (!dbname) return connection;
    return {
      label: connection.label,
      host: connection.host,
      user: connection.user,
      password: connection.password,
      port: connection.port,
      database: dbname,
      multipleStatements: connection.multipleStatements,
      certPath: connection.certPath
    };
  }

  public static async createConnection(connection: IConnection, dbname?: string): Promise<PgClient> {
    const connectionOptions: any = Object.assign({}, connection);
    connectionOptions.database = dbname ? dbname : connection.database;
    if (connectionOptions.certPath && fs.existsSync(connectionOptions.certPath)) {
      connectionOptions.ssl = {
        ca: fs.readFileSync(connectionOptions.certPath).toString(),
        rejectUnauthorized: false,
      }
    }

    if (connectionOptions.ssl === true) {
      connectionOptions.ssl = {rejectUnauthorized: false};
    }

    let client = new PgClient(connectionOptions);
    await client.connect();
    const versionRes = await client.query(`SELECT current_setting('server_version_num') as ver_num;`);
    /*
    return res.rows.map<ColumnNode>(column => {
      return new ColumnNode(this.connection, this.table, column);
    });
    */
    let versionNumber = parseInt(versionRes.rows[0].ver_num);
    client.pg_version = versionNumber;
    return client;
  }

  private static getDurationText(milliseconds: number): string {
    let sec = milliseconds / 1000.0;
    // More than 60 sec -> 2 min 5 sec
    if (sec > 60) {
      let min = Math.floor(sec / 60);
      sec = Math.round(sec - min * 60);
      return String(min) + ' min ' + String(Math.round(sec)) + 'sec';
    } 
    // More than 10 sec -> 33 sec.
    if (sec >= 20) {
      sec = Math.round(sec);
      return String(sec) + ' sec';
    }
    // More than 2 sec -> 3.3 sec.
    else if (sec > 2) {
      sec = Math.round(sec * 10) / 10;
      return String(sec) + ' sec';
    }
    // More than 0.1 sec -> 0.33 sec.
    else if (sec > 0.1) {
      sec = Math.round(sec * 100) / 100;
      return String(sec) + ' sec';
    }
    // Full precision
    sec = Math.round(sec * 1000) / 1000;
    return String(sec) + ' sec';
  }

  public static async analyzeQueryPlan(sql: string, editor: vscode.TextEditor, connectionOptions: IConnection) {
    let uri = editor.document.uri.toString();
    let title = path.basename(editor.document.fileName);
    let resultsUri = vscode.Uri.parse('postgres-results://' + uri);

    OutputChannel.displayMessage(resultsUri, 'Query Plan Analysis: ' + title, 'Analyzing query execution plan...', false);
    let connection: PgClient = null;
    try {
      let startTime = performance.now();
      connection = await Database.createConnection(connectionOptions);
      
      console.log('Connection established successfully');
      console.log('Original SQL:', sql);
      
      // Use EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) to get detailed execution plan
      const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
      console.log('EXPLAIN SQL:', explainSql);
      
      const res = await connection.query(explainSql);
      
      console.log('Query result structure:', {
        rowCount: res.rowCount,
        command: res.command,
        rowsLength: res.rows ? res.rows.length : 0,
        rowsKeys: res.rows && res.rows[0] ? Object.keys(res.rows[0]) : []
      });
      
      let durationText = Database.getDurationText(performance.now() - startTime);
      
      // Analyze the execution plan and provide optimization suggestions
      if (!res.rows || res.rows.length === 0 || !res.rows[0]) {
        console.log('No rows returned from EXPLAIN command');
        throw new Error('No execution plan data returned from EXPLAIN command');
      }
      
      const explainData = res.rows[0];
      console.log('EXPLAIN data keys:', Object.keys(explainData));
      
      // Handle PostgreSQL FORMAT JSON output - it may return JSON string or parsed object
      let planData = null;
      
      // Check for different field name variations
      if (explainData['QUERY PLAN'] !== undefined) {
        planData = explainData['QUERY PLAN'];
        console.log('Found QUERY PLAN field, type:', typeof planData);
      } else if (explainData['query_plan'] !== undefined) {
        planData = explainData['query_plan'];
        console.log('Found query_plan field, type:', typeof planData);
      } else if (explainData.explain !== undefined) {
        planData = explainData.explain;
        console.log('Found explain field, type:', typeof planData);
      } else {
        // If no specific field found, use the entire row data
        planData = explainData;
        console.log('Using entire row data as plan data');
      }
      
      // PostgreSQL FORMAT JSON may return JSON string that needs parsing
      if (typeof planData === 'string') {
        try {
          console.log('Parsing JSON string from QUERY PLAN field');
          planData = JSON.parse(planData);
          console.log('Successfully parsed JSON, new type:', typeof planData);
        } catch (parseError) {
          console.log('Failed to parse JSON, keeping as string:', parseError.message);
          // If parsing fails, it might be text format, we'll handle it in analysis
        }
      }
      
      console.log('Plan data structure:', planData);
      
      if (!planData) {
        throw new Error('Could not extract execution plan from query results');
      }
      
      const analysisResult = Database.analyzeExecutionPlan(planData, sql);
      
      OutputChannel.displayMessage(resultsUri, 'Query Plan Analysis: ' + title, 
        `Analysis completed in ${durationText}. ${analysisResult.summary}`, false);
      
      // Display detailed analysis results
      const analysisContent = Database.formatAnalysisResults(analysisResult);
      OutputChannel.displayMessage(resultsUri, 'Query Plan Analysis: ' + title, analysisContent, false);
      
      vscode.window.showInformationMessage(`Query plan analysis completed in ${durationText}.`);
      
    } catch (err) {
      OutputChannel.displayMessage(resultsUri, 'Query Plan Analysis: ' + title, 'ERROR: ' + err.message, false);
      OutputChannel.appendLine(err);
      vscode.window.showErrorMessage(err.message);
    } finally {
      if (connection)
        await connection.end();
    }
  }

  private static analyzeExecutionPlan(plan: any, originalSql: string) {
    const analysis = {
      summary: '',
      efficiency: 'good', // good, fair, poor
      issues: [] as string[],
      suggestions: [] as string[],
      statistics: {
        totalCost: 0,
        executionTime: 0,
        rowsReturned: 0,
        buffersHit: 0,
        buffersRead: 0
      }
    };

    // Recursively analyze the execution plan
    const analyzeNode = (node: any, depth: number = 0) => {
      if (!node) return;

      // Extract basic statistics from PostgreSQL JSON format
      if (node['Total Cost']) analysis.statistics.totalCost += parseFloat(node['Total Cost']);
      if (node['Actual Total Time']) analysis.statistics.executionTime += parseFloat(node['Actual Total Time']);
      if (node['Plan Rows']) analysis.statistics.rowsReturned += parseInt(node['Plan Rows']);
      if (node['Shared Hit Blocks']) analysis.statistics.buffersHit += parseInt(node['Shared Hit Blocks']);
      if (node['Shared Read Blocks']) analysis.statistics.buffersRead += parseInt(node['Shared Read Blocks']);

      // Handle PostgreSQL JSON format with different field names
      if (node['total_cost']) analysis.statistics.totalCost += parseFloat(node['total_cost']);
      if (node['actual_total_time']) analysis.statistics.executionTime += parseFloat(node['actual_total_time']);
      if (node['plan_rows']) analysis.statistics.rowsReturned += parseInt(node['plan_rows']);
      if (node['shared_hit_blocks']) analysis.statistics.buffersHit += parseInt(node['shared_hit_blocks']);
      if (node['shared_read_blocks']) analysis.statistics.buffersRead += parseInt(node['shared_read_blocks']);

      // Check for common performance issues
      const nodeType = node['Node Type'] || node['node_type'];
      
      if (nodeType === 'Seq Scan') {
        const relationName = node['Relation Name'] || node['relation_name'] || 'unknown';
        analysis.issues.push(`Sequential scan detected on table: ${relationName}`);
        analysis.suggestions.push(`Consider adding an index on columns used in WHERE clause for table ${relationName}`);
      }

      if (nodeType === 'Nested Loop' && (parseFloat(node['Actual Total Time'] || node['actual_total_time'] || 0) > 100)) {
        analysis.issues.push('Slow nested loop join detected');
        analysis.suggestions.push('Consider using hash join or merge join instead, or add appropriate indexes');
      }

      if (nodeType === 'Sort' && (parseFloat(node['Sort Space Used'] || node['sort_space_used'] || 0) > 100000)) {
        analysis.issues.push('Large sort operation detected');
        analysis.suggestions.push('Consider adding indexes to avoid sorting, or use LIMIT to reduce result set size');
      }

      if (nodeType === 'Hash Join' && (parseFloat(node['Hash Buckets'] || node['hash_buckets'] || 0) > 10000)) {
        analysis.issues.push('Large hash join operation detected');
        analysis.suggestions.push('Consider using indexed joins or reducing join size');
      }

      // Recursively analyze child nodes
      const childPlans = node['Plans'] || node['plans'];
      if (childPlans && Array.isArray(childPlans)) {
        childPlans.forEach((child: any) => analyzeNode(child, depth + 1));
      }
    };

    // Handle different PostgreSQL EXPLAIN output formats
    let rootPlan = null;
    
    if (plan && Array.isArray(plan) && plan.length > 0) {
      // JSON array format from EXPLAIN (FORMAT JSON)
      rootPlan = plan[0];
    } else if (plan && plan['Plan']) {
      // Single object format
      rootPlan = plan;
    } else if (plan) {
      // Direct plan object
      rootPlan = plan;
    }

    // Start analysis from the root node
    if (rootPlan) {
      if (rootPlan['Plan']) {
        analyzeNode(rootPlan['Plan']);
      } else {
        analyzeNode(rootPlan);
      }
    }

    // Determine overall efficiency based on actual statistics
    if (analysis.statistics.executionTime > 1000 || analysis.issues.length > 3) {
      analysis.efficiency = 'poor';
      analysis.summary = 'Query performance needs significant optimization';
    } else if (analysis.statistics.executionTime > 100 || analysis.issues.length > 0) {
      analysis.efficiency = 'fair';
      analysis.summary = 'Query performance could be improved';
    } else {
      analysis.efficiency = 'good';
      analysis.summary = 'Query performance is efficient';
    }

    // Add query-specific information to summary
    if (originalSql) {
      const sqlType = originalSql.trim().toLowerCase().split(' ')[0];
      analysis.summary += ` (${sqlType.toUpperCase()} query)`;
    }

    return analysis;
  }

  private static formatAnalysisResults(analysis: any): string {
    let result = `# Query Plan Analysis Report\n\n`;
    
    result += `## Efficiency Rating: ${analysis.efficiency.toUpperCase()}\n`;
    result += `**${analysis.summary}**\n\n`;
    
    result += `## Performance Statistics\n`;
    result += `- Total Cost: ${analysis.statistics.totalCost.toFixed(2)}\n`;
    result += `- Execution Time: ${analysis.statistics.executionTime.toFixed(2)} ms\n`;
    result += `- Estimated Rows: ${analysis.statistics.rowsReturned}\n`;
    result += `- Buffers Hit: ${analysis.statistics.buffersHit}\n`;
    result += `- Buffers Read: ${analysis.statistics.buffersRead}\n\n`;
    
    if (analysis.issues.length > 0) {
      result += `## Performance Issues Found\n`;
      analysis.issues.forEach((issue: string, index: number) => {
        result += `${index + 1}. ${issue}\n`;
      });
      result += `\n`;
    }
    
    if (analysis.suggestions.length > 0) {
      result += `## Optimization Suggestions\n`;
      analysis.suggestions.forEach((suggestion: string, index: number) => {
        result += `${index + 1}. ${suggestion}\n`;
      });
      result += `\n`;
    }
    
    result += `## Additional Recommendations\n`;
    result += `1. Consider using EXPLAIN (ANALYZE, BUFFERS) regularly to monitor query performance\n`;
    result += `2. Ensure statistics are up to date with ANALYZE command\n`;
    result += `3. Monitor index usage and consider adding missing indexes\n`;
    result += `4. Consider partitioning large tables if appropriate\n`;
    
    return result;
  }


  public static async runQuery(
    sql: string,
    editor: vscode.TextEditor,
    connectionOptions: IConnection,
    showInCurrentPanel: boolean = false
  ) {
    // 检查是否需要记录历史
    if (!Database.queryHistoryManager.shouldRecordQuery(sql)) {
      return this.executeQuery(sql, editor, connectionOptions, showInCurrentPanel);
    }

    let uri: string = '';
    let title: string = '';
    if (showInCurrentPanel) {
      queryCounter++;
      uri = `unnamed-query-${queryCounter}`;
      title = `Unnamed Query ${queryCounter}`;
    } else {
      uri = editor.document.uri.toString();
      title = path.basename(editor.document.fileName);
    }

    const startTime = performance.now();
    let resultsUri = vscode.Uri.parse('postgres-results://' + uri);

    OutputChannel.displayMessage(resultsUri, 'Results: ' + title, 'Waiting for the query to complete...', showInCurrentPanel);
    let connection: PgClient = null;
    try {
      connection = await Database.createConnection(connectionOptions);
      const typeNamesQuery = `select oid, format_type(oid, typtypmod) as display_type, typname from pg_type`;
      const types: TypeResults = await connection.query(typeNamesQuery);
      const res: QueryResults | QueryResults[] = await connection.query({ text: sql, rowMode: 'array' });
      const results: QueryResults[] = Array.isArray(res) ? res : [res];
      const endTime = performance.now();
      let durationText = Database.getDurationText(endTime - startTime);

      // ✨ 使用 QueryHistoryManager 记录历史
      await Database.queryHistoryManager.recordSuccessfulQuery(
        sql,
        results,
        connectionOptions,
        endTime - startTime
      );

      OutputChannel.displayMessage(resultsUri, 'Results: ' + title, 'Query completed in ' + durationText + '. Building results view...', showInCurrentPanel);
      vscode.window.showInformationMessage('Query completed in ' + durationText + '.');
      results.forEach((result) => {
        result.fields.forEach((field) => {
          let type = types.rows.find((t) => t.oid === field.dataTypeID);
          if (type) {
            field.format = type.typname;
            field.display_type = type.display_type;
          }
        });
      });

      OutputChannel.displayResults(resultsUri, 'Results: ' + title, results, showInCurrentPanel);
      if (!showInCurrentPanel) {
        vscode.window.showTextDocument(editor.document, editor.viewColumn);
      }
    } catch (err) {
      // ✨ 使用 QueryHistoryManager 记录失败
      await Database.queryHistoryManager.recordFailedQuery(
        sql,
        connectionOptions,
        performance.now() - startTime
      );

      OutputChannel.displayMessage(resultsUri, 'Results: ' + title, 'ERROR: ' + err.message, showInCurrentPanel);
      OutputChannel.appendLine(err);
      vscode.window.showErrorMessage(err.message);
    } finally {
      if (connection)
        await connection.end();
    }
  }

  private static async executeQuery(sql: string, editor: vscode.TextEditor, connectionOptions: IConnection, showInCurrentPanel: boolean) {
    let uri: string = '';
    let title: string = '';
    if (showInCurrentPanel) {
      queryCounter++;
      uri = `unnamed-query-${queryCounter}`;
      title = `Unnamed Query ${queryCounter}`;
    } else {
      uri = editor.document.uri.toString();
      title = path.basename(editor.document.fileName);
    }

    let resultsUri = vscode.Uri.parse('postgres-results://' + uri);

    OutputChannel.displayMessage(resultsUri, 'Results: ' + title, 'Waiting for the query to complete...', showInCurrentPanel);
    let connection: PgClient = null;
    try {
      let startTime = performance.now();
      connection = await Database.createConnection(connectionOptions);
      const typeNamesQuery = `select oid, format_type(oid, typtypmod) as display_type, typname from pg_type`;
      const types: TypeResults = await connection.query(typeNamesQuery);
      const res: QueryResults | QueryResults[] = await connection.query({ text: sql, rowMode: 'array' });
      const results: QueryResults[] = Array.isArray(res) ? res : [res];
      let durationText = Database.getDurationText(performance.now() - startTime);

      OutputChannel.displayMessage(resultsUri, 'Results: ' + title, 'Query completed in ' + durationText + '. Building results view...', showInCurrentPanel);
      vscode.window.showInformationMessage('Query completed in ' + durationText + '.');
      results.forEach((result) => {
        result.fields.forEach((field) => {
          let type = types.rows.find((t) => t.oid === field.dataTypeID);
          if (type) {
            field.format = type.typname;
            field.display_type = type.display_type;
          }
        });
      });
      OutputChannel.displayResults(resultsUri, 'Results: ' + title, results, showInCurrentPanel);
      if (!showInCurrentPanel) {
        vscode.window.showTextDocument(editor.document, editor.viewColumn);
      }
    } catch (err) {
      OutputChannel.displayMessage(resultsUri, 'Results: ' + title, 'ERROR: ' + err.message, showInCurrentPanel);
      OutputChannel.appendLine(err);
      vscode.window.showErrorMessage(err.message);
    } finally {
      if (connection)
        await connection.end();
    }
  }
}
