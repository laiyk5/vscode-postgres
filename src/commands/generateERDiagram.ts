import BaseCommand from "../common/baseCommand";
import * as vscode from 'vscode';
import { IConnection } from "../common/IConnection";
import { Database } from "../common/database";
import { DatabaseNode } from "../tree/databaseNode";
import { SchemaNode } from "../tree/schemaNode";

'use strict';

interface TableInfo {
  table_name: string;
  table_schema: string;
  table_type: string;
  table_comment?: string;
}

interface ColumnInfo {
  table_name: string;
  table_schema: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string;
  is_primary_key: boolean;
  character_maximum_length?: number;
  column_comment?: string;
}

interface ForeignKeyInfo {
  constraint_name: string;
  table_schema: string;
  table_name: string;
  column_name: string;
  foreign_table_schema: string;
  foreign_table_name: string;
  foreign_column_name: string;
  update_rule: string;
  delete_rule: string;
}

export class generateERDiagramCommand extends BaseCommand {
  async run(node?: DatabaseNode | SchemaNode) {
    let connection: IConnection;
    let targetSchema: string | undefined;

    if (node instanceof DatabaseNode) {
      // 通过访问器方法获取连接信息
      connection = (node as any).connection;
      targetSchema = undefined; // 整个数据库
    } else if (node instanceof SchemaNode) {
      connection = (node as any).connection;
      targetSchema = node.schemaName;
    } else {
      vscode.window.showErrorMessage('请在数据库或模式节点上右键选择生成 ER 图');
      return;
    }

    try {
      // 询问用户生成范围
      const scopeOptions = [
        '当前模式',
        '选择多个模式',
        '整个数据库（所有模式）'
      ];

      const selectedScope = await vscode.window.showQuickPick(scopeOptions, {
        placeHolder: '选择 ER 图生成范围'
      });

      if (!selectedScope) {
        return;
      }

      let schemasToInclude: string[] = [];

      switch (selectedScope) {
        case '当前模式':
          if (!targetSchema) {
            vscode.window.showErrorMessage('请在模式节点上使用此选项');
            return;
          }
          schemasToInclude = [targetSchema];
          break;

        case '选择多个模式':
          const availableSchemas = await this.getAvailableSchemas(connection);
          const selectedSchemas = await vscode.window.showQuickPick(availableSchemas, {
            placeHolder: '选择要包含的模式',
            canPickMany: true
          });
          if (!selectedSchemas || selectedSchemas.length === 0) {
            return;
          }
          schemasToInclude = selectedSchemas;
          break;

        case '整个数据库（所有模式）':
          schemasToInclude = await this.getAvailableSchemas(connection);
          break;
      }

      // 询问是否包含系统表
      const includeSystemTables = await vscode.window.showQuickPick(['否', '是'], {
        placeHolder: '是否包含系统表？'
      });

      if (!includeSystemTables) {
        return;
      }

      const includeSystem = includeSystemTables === '是';

      // 显示进度
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在生成 ER 图...',
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: '获取数据库元数据...' });

        // 获取数据库元数据
        const metadata = await this.getDatabaseMetadata(connection, schemasToInclude, includeSystem);

        progress.report({ increment: 50, message: '生成图表数据...' });

        // 生成 Mermaid ER 图代码
        const mermaidCode = this.generateMermaidERD(metadata);

        progress.report({ increment: 80, message: '创建视图...' });

        // 创建并显示 ER 图视图
        await this.showERDiagram(mermaidCode, connection, schemasToInclude);

        progress.report({ increment: 100, message: '完成' });
      });

      vscode.window.showInformationMessage('ER 图生成成功！');

    } catch (error) {
      vscode.window.showErrorMessage(`生成 ER 图失败: ${error.message}`);
      console.error('Generate ER diagram error:', error);
    }
  }

  private async getAvailableSchemas(connection: IConnection): Promise<string[]> {
    const dbConnection = await Database.createConnection(connection);
    try {
      const result = await dbConnection.query(`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY schema_name
      `);
      
      return result.rows.map(row => row.schema_name);
    } finally {
      await dbConnection.end();
    }
  }

  private async getDatabaseMetadata(connection: IConnection, schemas: string[], includeSystem: boolean): Promise<{
    tables: TableInfo[],
    columns: ColumnInfo[],
    foreignKeys: ForeignKeyInfo[]
  }> {
    const dbConnection = await Database.createConnection(connection);
    
    try {
      const schemaFilter = schemas.map(s => `'${s}'`).join(',');
      
      // 获取表信息
      const tablesQuery = `
        SELECT 
          t.table_name,
          t.table_schema,
          t.table_type,
          obj_description(c.oid) as table_comment
        FROM information_schema.tables t
        LEFT JOIN pg_class c ON c.relname = t.table_name
        LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
        WHERE t.table_schema IN (${schemaFilter})
        ${includeSystem ? '' : "AND t.table_type = 'BASE TABLE'"}
        ORDER BY t.table_schema, t.table_name
      `;

      const tablesResult = await dbConnection.query(tablesQuery);
      const tables: TableInfo[] = tablesResult.rows;

      // 获取列信息
      const columnsQuery = `
        SELECT 
          c.table_name,
          c.table_schema,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.character_maximum_length,
          COALESCE(pk.is_primary_key, false) as is_primary_key,
          col_description(pgc.oid, c.ordinal_position) as column_comment
        FROM information_schema.columns c
        LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
        LEFT JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace AND pgn.nspname = c.table_schema
        LEFT JOIN (
          SELECT 
            kcu.table_schema,
            kcu.table_name,
            kcu.column_name,
            true as is_primary_key
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
        ) pk ON pk.table_schema = c.table_schema 
            AND pk.table_name = c.table_name 
            AND pk.column_name = c.column_name
        WHERE c.table_schema IN (${schemaFilter})
        ORDER BY c.table_schema, c.table_name, c.ordinal_position
      `;

      const columnsResult = await dbConnection.query(columnsQuery);
      const columns: ColumnInfo[] = columnsResult.rows;

      // 获取外键关系
      const foreignKeysQuery = `
        SELECT 
          tc.constraint_name,
          tc.table_schema,
          tc.table_name,
          kcu.column_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          rc.update_rule,
          rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints rc 
          ON tc.constraint_name = rc.constraint_name
          AND tc.table_schema = rc.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema IN (${schemaFilter})
        ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position
      `;

      const foreignKeysResult = await dbConnection.query(foreignKeysQuery);
      const foreignKeys: ForeignKeyInfo[] = foreignKeysResult.rows;

      return { tables, columns, foreignKeys };

    } finally {
      await dbConnection.end();
    }
  }

  private generateMermaidERD(metadata: {
    tables: TableInfo[],
    columns: ColumnInfo[],
    foreignKeys: ForeignKeyInfo[]
  }): string {
    let mermaidCode = 'erDiagram\n';

    // 按模式分组表
    const tablesBySchema = new Map<string, TableInfo[]>();
    metadata.tables.forEach(table => {
      if (!tablesBySchema.has(table.table_schema)) {
        tablesBySchema.set(table.table_schema, []);
      }
      tablesBySchema.get(table.table_schema)!.push(table);
    });

    // 生成表定义 - 使用简化语法
    tablesBySchema.forEach((tables, schema) => {
      tables.forEach(table => {
        // 清理表名，确保符合 Mermaid 语法
        const cleanTableName = table.table_name.replace(/[^a-zA-Z0-9_]/g, '_');
        const cleanSchemaName = schema.replace(/[^a-zA-Z0-9_]/g, '_');
        const tableName = schema !== 'public' ? `${cleanSchemaName}_${cleanTableName}` : cleanTableName;
        
        mermaidCode += `    ${tableName} {\n`;

        // 获取该表的列 - 使用简化的列定义
        const tableColumns = metadata.columns.filter(col => 
          col.table_schema === table.table_schema && col.table_name === table.table_name
        );

        tableColumns.forEach(column => {
          // 简化列定义，只保留必要信息
          const cleanColumnName = column.column_name.replace(/[^a-zA-Z0-9_]/g, '_');
          const dataType = column.data_type.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
          
          let columnDef = `        ${dataType} ${cleanColumnName}`;
          
          if (column.is_primary_key) {
            columnDef += ' PK';
          }
          
          if (column.is_nullable === 'NO' && !column.is_primary_key) {
            columnDef += ' "NOT NULL"';
          }

          mermaidCode += `${columnDef}\n`;
        });

        mermaidCode += '    }\n';
      });
    });

    // 生成关系 - 使用简化语法
    metadata.foreignKeys.forEach(fk => {
      // 清理表名，确保符合 Mermaid 语法
      const cleanFromTableName = fk.table_name.replace(/[^a-zA-Z0-9_]/g, '_');
      const cleanFromSchemaName = fk.table_schema.replace(/[^a-zA-Z0-9_]/g, '_');
      const cleanToTableName = fk.foreign_table_name.replace(/[^a-zA-Z0-9_]/g, '_');
      const cleanToSchemaName = fk.foreign_table_schema.replace(/[^a-zA-Z0-9_]/g, '_');
      
      const fromTable = fk.table_schema !== 'public' 
        ? `${cleanFromSchemaName}_${cleanFromTableName}` 
        : cleanFromTableName;
      
      const toTable = fk.foreign_table_schema !== 'public' 
        ? `${cleanToSchemaName}_${cleanToTableName}` 
        : cleanToTableName;

      // 使用简单的关系语法
      mermaidCode += `    ${toTable} ||--o{ ${fromTable} : has\n`;
    });

    return mermaidCode;
  }

  private isUniqueColumn(metadata: {
    tables: TableInfo[],
    columns: ColumnInfo[],
    foreignKeys: ForeignKeyInfo[]
  }, schema: string, table: string, column: string): boolean {
    // 这里可以添加更复杂的逻辑来检查列是否唯一
    // 暂时简化处理，假设主键是唯一的
    const col = metadata.columns.find(c => 
      c.table_schema === schema && 
      c.table_name === table && 
      c.column_name === column
    );
    return col?.is_primary_key || false;
  }

  private async showERDiagram(mermaidCode: string, connection: IConnection, schemas: string[]) {
    const panel = vscode.window.createWebviewPanel(
      'erDiagram',
      `ER 图 - ${schemas.join(', ')}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.getWebviewContent(mermaidCode);
  }

  private getWebviewContent(mermaidCode: string): string {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ER 图</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .container {
            max-width: 100%;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            padding: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header h1 {
            margin: 0;
            color: var(--vscode-titleBar-activeForeground);
        }
        .controls {
            text-align: center;
            margin-bottom: 20px;
        }
        .controls button {
            margin: 0 10px;
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .controls button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .diagram-container {
            text-align: center;
            overflow: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
            background-color: white;
            min-height: 400px;
        }
        #diagram {
            max-width: 100%;
            height: auto;
        }
        .source-code {
            margin-top: 20px;
            padding: 20px;
            background-color: var(--vscode-textCodeBlock-background);
            border-radius: 8px;
            display: none;
        }
        .source-code pre {
            margin: 0;
            white-space: pre-wrap;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        }
        .error {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 16px;
            border-radius: 4px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 数据库 ER 图</h1>
            <p>实体关系图 - 可视化数据库结构和表关系</p>
        </div>
        
        <div class="controls">
            <button onclick="zoomIn()">🔍 放大</button>
            <button onclick="zoomOut()">🔍 缩小</button>
            <button onclick="resetZoom()">↩️ 重置</button>
            <button onclick="toggleSource()">📝 源码</button>
            <button onclick="exportSVG()">💾 导出</button>
        </div>

        <div class="diagram-container">
            <div id="diagram">
                <div class="mermaid">
${mermaidCode}
                </div>
            </div>
        </div>

        <div class="source-code" id="sourceCode">
            <h3>Mermaid 源码：</h3>
            <pre><code>${mermaidCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
        </div>
    </div>

    <script>
        // 初始化 Mermaid - 使用更稳定的配置
        mermaid.initialize({ 
            startOnLoad: true,
            theme: 'neutral',
            securityLevel: 'loose',
            er: {
                diagramPadding: 20,
                layoutDirection: 'TB',
                minEntityWidth: 100,
                minEntityHeight: 75,
                entityPadding: 15,
                stroke: '#333333',
                fill: '#ECECFF',
                fontSize: 12
            }
        });

        let currentZoom = 1;
        const zoomStep = 0.1;
        const minZoom = 0.5;
        const maxZoom = 3;

        function zoomIn() {
            if (currentZoom < maxZoom) {
                currentZoom += zoomStep;
                applyZoom();
            }
        }

        function zoomOut() {
            if (currentZoom > minZoom) {
                currentZoom -= zoomStep;
                applyZoom();
            }
        }

        function resetZoom() {
            currentZoom = 1;
            applyZoom();
        }

        function applyZoom() {
            const diagram = document.getElementById('diagram');
            diagram.style.transform = \`scale(\${currentZoom})\`;
            diagram.style.transformOrigin = 'center top';
        }

        function toggleSource() {
            const sourceCode = document.getElementById('sourceCode');
            if (sourceCode.style.display === 'none' || sourceCode.style.display === '') {
                sourceCode.style.display = 'block';
            } else {
                sourceCode.style.display = 'none';
            }
        }

        function exportSVG() {
            try {
                const svg = document.querySelector('#diagram svg');
                if (svg) {
                    const serializer = new XMLSerializer();
                    const svgString = serializer.serializeToString(svg);
                    const blob = new Blob([svgString], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'er-diagram.svg';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } else {
                    alert('无法找到 SVG 元素');
                }
            } catch (error) {
                alert('导出失败: ' + error.message);
            }
        }

        // 错误处理
        window.addEventListener('load', function() {
            setTimeout(function() {
                const mermaidElement = document.querySelector('.mermaid');
                if (mermaidElement && !mermaidElement.querySelector('svg')) {
                    document.getElementById('diagram').innerHTML = 
                        '<div class="error">ER 图渲染失败。这可能是由于数据库中没有表或 Mermaid 语法错误。</div>' +
                        '<div style="margin-top: 20px;"><button onclick="toggleSource()">查看源码</button></div>';
                }
            }, 5000);
        });
    </script>
</body>
</html>`;
  }
}