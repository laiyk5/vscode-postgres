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
