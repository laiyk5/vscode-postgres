import * as vscode from 'vscode';
import { PgClient } from './connection';
import { IConnection } from './IConnection';
import * as path from 'path';

export interface HistoryRecord {
    id: number;
    query_text: string;
    execution_time: string;
    duration_ms: number | null;
    success: boolean;
    database_name: string;
    server_host: string;
    result_data: any;
}

export class SQLHistoryVisualization {
    private panel: vscode.WebviewPanel | undefined;
    private static instance: SQLHistoryVisualization;

    private constructor() {}

    public static getInstance(): SQLHistoryVisualization {
        if (!SQLHistoryVisualization.instance) {
            SQLHistoryVisualization.instance = new SQLHistoryVisualization();
        }
        return SQLHistoryVisualization.instance;
    }

    public async visualize(connectionOptions: IConnection): Promise<void> {
        const records = await this.fetchHistoryRecords(connectionOptions);
        
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'sqlHistoryVisualization',
                'SQL History Visualization',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });

            this.panel.webview.onDidReceiveMessage(async (message) => {
                await this.handleWebviewMessage(message, connectionOptions);
            });
        }

        this.panel.webview.html = this.getWebviewContent(records);
    }

    private async fetchHistoryRecords(connectionOptions: IConnection): Promise<HistoryRecord[]> {
        let connection: PgClient | null = null;
        try {
            connection = new PgClient(connectionOptions);
            await connection.connect();

            const query = `
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

            const result = await connection.query(query);
            return result.rows as HistoryRecord[];
        } catch (err) {
            console.error('Error fetching history records:', err);
            vscode.window.showErrorMessage('Failed to fetch SQL history: ' + err.message);
            return [];
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

    private async handleWebviewMessage(message: any, connectionOptions: IConnection): Promise<void> {
        switch (message.command) {
            case 'export':
                await this.exportData(message.format, message.data);
                break;
            case 'copyQuery':
                await vscode.env.clipboard.writeText(message.query);
                vscode.window.showInformationMessage('Query copied to clipboard');
                break;
            case 'runQuery':
                await this.runQuery(message.query, connectionOptions);
                break;
        }
    }

    private async exportData(format: string, data: HistoryRecord[]): Promise<void> {
        try {
            let content: string;
            let fileExtension: string;

            if (format === 'json') {
                content = JSON.stringify(data, null, 2);
                fileExtension = 'json';
            } else if (format === 'csv') {
                content = this.convertToCSV(data);
                fileExtension = 'csv';
            } else {
                return;
            }

            const fileName = `sql_history_${new Date().getTime()}.${fileExtension}`;
            const fileUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(fileName),
                filters: {
                    [format.toUpperCase()]: [fileExtension]
                }
            });

            if (fileUri) {
                await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
                vscode.window.showInformationMessage(`History exported to ${fileUri.fsPath}`);
            }
        } catch (err) {
            vscode.window.showErrorMessage('Failed to export data: ' + err.message);
        }
    }

    private convertToCSV(data: HistoryRecord[]): string {
        const headers = ['ID', 'Query', 'Database', 'Server', 'Success', 'Duration (ms)', 'Execution Time', 'Result Data'];
        const rows = data.map(record => [
            record.id,
            `"${record.query_text.replace(/"/g, '""')}"`,
            record.database_name,
            record.server_host,
            record.success,
            record.duration_ms || '',
            record.execution_time,
            `"${JSON.stringify(record.result_data || {}).replace(/"/g, '""')}"`
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        return csv;
    }

    private async runQuery(query: string, connectionOptions: IConnection): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument({
                content: query,
                language: 'postgres'
            });
            const editor = await vscode.window.showTextDocument(document);
            
            // Import Database to run the query
            const { Database } = await import('./database');
            await Database.runQuery(query, editor, connectionOptions, true);
        } catch (err) {
            vscode.window.showErrorMessage('Failed to run query: ' + err.message);
        }
    }

    private getWebviewContent(records: HistoryRecord[]): string {
        const nonce = this.getNonce();
        const recordsJson = JSON.stringify(records);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SQL History Visualization</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 16px;
            overflow-x: hidden;
        }

        .container {
            max-width: 100%;
            margin: 0 auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .header h1 {
            font-size: 18px;
            font-weight: 600;
        }

        .controls {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .control-group {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        input[type="text"],
        select {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-family: inherit;
        }

        input[type="text"]:focus,
        select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid transparent;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-family: inherit;
            transition: background-color 0.2s;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button:active {
            background-color: var(--vscode-button-background);
        }

        .stats {
            display: flex;
            gap: 16px;
            margin-bottom: 16px;
            padding: 12px;
            background-color: var(--vscode-editor-inlineValueBackground);
            border-radius: 4px;
        }

        .stat-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .stat-label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .stat-value {
            font-size: 16px;
            font-weight: 600;
        }

        .table-wrapper {
            overflow-x: auto;
            margin-bottom: 20px;
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }

        thead {
            background-color: var(--vscode-editor-lineNumberActiveForeground);
            position: sticky;
            top: 0;
        }

        th {
            padding: 8px 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 1px solid var(--vscode-widget-border);
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }

        th:hover {
            background-color: var(--vscode-editor-selectionBackground);
        }

        td {
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        tbody tr:hover {
            background-color: var(--vscode-editor-inlineValueBackground);
        }

        .status {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
        }

        .status.success {
            background-color: rgba(76, 175, 80, 0.2);
            color: #4caf50;
        }

        .status.failed {
            background-color: rgba(244, 67, 54, 0.2);
            color: #f44336;
        }

        .query-cell {
            max-width: 300px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
            text-decoration: underline;
            text-decoration-color: transparent;
            transition: text-decoration-color 0.2s;
        }

        .query-cell:hover {
            text-decoration-color: inherit;
        }

        .actions {
            display: flex;
            gap: 4px;
        }

        .action-btn {
            background-color: transparent;
            border: 1px solid var(--vscode-widget-border);
            padding: 4px 8px;
            font-size: 11px;
            cursor: pointer;
            border-radius: 3px;
            transition: all 0.2s;
        }

        .action-btn:hover {
            background-color: var(--vscode-editor-inlineValueBackground);
        }

        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
        }

        .modal.active {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background-color: var(--vscode-editor-background);
            padding: 20px;
            border-radius: 4px;
            border: 1px solid var(--vscode-widget-border);
            max-width: 90%;
            max-height: 80%;
            overflow-y: auto;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .modal-header h2 {
            font-size: 16px;
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .json-tree {
            background-color: var(--vscode-editor-inlineValueBackground);
            padding: 12px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.5;
            max-height: 400px;
            overflow-y: auto;
            word-break: break-all;
            white-space: pre-wrap;
        }

        .result-table-wrapper {
            max-height: 600px;
            overflow: auto;
            margin: 12px 0;
        }

        .result-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            background-color: var(--vscode-editor-background);
        }

        .result-table thead {
            background-color: var(--vscode-editor-lineNumberActiveForeground);
            position: sticky;
            top: 0;
        }

        .result-table th {
            padding: 8px 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 1px solid var(--vscode-widget-border);
            word-break: break-word;
            max-width: 300px;
        }

        .result-table td {
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
            word-break: break-word;
            max-width: 300px;
            overflow-wrap: break-word;
        }

        .result-table tbody tr:hover {
            background-color: var(--vscode-editor-inlineValueBackground);
        }

        .result-info {
            padding: 8px 12px;
            background-color: var(--vscode-editor-inlineValueBackground);
            border-radius: 3px;
            margin-bottom: 12px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .modal-actions {
            display: flex;
            gap: 8px;
            margin-top: 16px;
            justify-content: flex-end;
        }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state p {
            margin-bottom: 12px;
        }

        .sort-indicator {
            margin-left: 4px;
        }

        @media (max-width: 768px) {
            .controls {
                flex-direction: column;
            }

            .control-group {
                flex-direction: column;
            }

            .stats {
                flex-direction: column;
            }

            .table-wrapper {
                font-size: 11px;
            }

            td, th {
                padding: 6px 8px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 SQL Query History</h1>
            <div class="controls">
                <div class="control-group">
                    <input type="text" id="searchInput" placeholder="Search queries..." />
                </div>
                <div class="control-group">
                    <select id="filterStatus">
                        <option value="">All Status</option>
                        <option value="success">Success</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>
                <div class="control-group">
                    <select id="filterDatabase">
                        <option value="">All Databases</option>
                    </select>
                </div>
                <div class="control-group">
                    <button onclick="exportData('json')">📥 Export JSON</button>
                    <button onclick="exportData('csv')">📥 Export CSV</button>
                </div>
            </div>
        </div>

        <div class="stats">
            <div class="stat-item">
                <span class="stat-label">Total Queries</span>
                <span class="stat-value" id="totalCount">0</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Success Rate</span>
                <span class="stat-value" id="successRate">0%</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Avg Duration</span>
                <span class="stat-value" id="avgDuration">-</span>
            </div>
        </div>

        <div id="tableContainer"></div>

        <div id="resultModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="resultModalTitle">Query Result Data</h2>
                    <button class="close-btn" onclick="closeModal()">&times;</button>
                </div>
                <div id="resultContainer"></div>
                <div class="modal-actions">
                    <button onclick="toggleResultView()">Toggle View</button>
                    <button onclick="closeModal()">Close</button>
                </div>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const records = ${recordsJson};
        let filteredRecords = [...records];

        function initializeTable() {
            updateStats();
            populateDatabases();
            renderTable();
            setupEventListeners();
        }

        function updateStats() {
            const totalCount = records.length;
            const successCount = records.filter(r => r.success).length;
            const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
            const durations = records
                .filter(r => r.duration_ms !== null && r.success)
                .map(r => r.duration_ms);
            const avgDuration = durations.length > 0 
                ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
                : 0;

            document.getElementById('totalCount').textContent = totalCount;
            document.getElementById('successRate').textContent = successRate + '%';
            document.getElementById('avgDuration').textContent = avgDuration > 0 
                ? avgDuration + 'ms'
                : '-';
        }

        function populateDatabases() {
            const databases = [...new Set(records.map(r => r.database_name))];
            const select = document.getElementById('filterDatabase');
            databases.forEach(db => {
                const option = document.createElement('option');
                option.value = db;
                option.textContent = db;
                select.appendChild(option);
            });
        }

        function setupEventListeners() {
            document.getElementById('searchInput').addEventListener('input', filterTable);
            document.getElementById('filterStatus').addEventListener('change', filterTable);
            document.getElementById('filterDatabase').addEventListener('change', filterTable);
        }

        function filterTable() {
            const searchText = document.getElementById('searchInput').value.toLowerCase();
            const statusFilter = document.getElementById('filterStatus').value;
            const databaseFilter = document.getElementById('filterDatabase').value;

            filteredRecords = records.filter(record => {
                const matchesSearch = record.query_text.toLowerCase().includes(searchText);
                const matchesStatus = !statusFilter || (statusFilter === 'success' ? record.success : !record.success);
                const matchesDatabase = !databaseFilter || record.database_name === databaseFilter;
                return matchesSearch && matchesStatus && matchesDatabase;
            });

            renderTable();
        }

        function renderTable() {
            if (filteredRecords.length === 0) {
                document.getElementById('tableContainer').innerHTML = '<div class="empty-state"><p>No query history found</p></div>';
                return;
            }

            let html = '<div class="table-wrapper"><table><thead><tr>';
            html += '<th onclick="sortTable(\\'id\\')">ID <span class="sort-indicator">↕️</span></th>';
            html += '<th onclick="sortTable(\\'query_text\\')">Query <span class="sort-indicator">↕️</span></th>';
            html += '<th onclick="sortTable(\\'database_name\\')">Database <span class="sort-indicator">↕️</span></th>';
            html += '<th onclick="sortTable(\\'server_host\\')">Server <span class="sort-indicator">↕️</span></th>';
            html += '<th onclick="sortTable(\\'success\\')">Status <span class="sort-indicator">↕️</span></th>';
            html += '<th onclick="sortTable(\\'duration_ms\\')">Duration (ms) <span class="sort-indicator">↕️</span></th>';
            html += '<th onclick="sortTable(\\'execution_time\\')">Time <span class="sort-indicator">↕️</span></th>';
            html += '<th>Result</th>';
            html += '<th>Actions</th>';
            html += '</tr></thead><tbody>';

            filteredRecords.forEach(record => {
                const statusClass = record.success ? 'success' : 'failed';
                const statusText = record.success ? '✓ Success' : '✗ Failed';
                const duration = record.duration_ms !== null ? record.duration_ms : '-';
                const executionTime = new Date(record.execution_time).toLocaleString();

                html += '<tr>';
                html += '<td>' + record.id + '</td>';
                html += '<td><span class="query-cell" title="' + escapeHtml(record.query_text) + '" onclick="viewQuery(' + record.id + ')">' + escapeHtml(record.query_text.substring(0, 50)) + (record.query_text.length > 50 ? '...' : '') + '</span></td>';
                html += '<td>' + record.database_name + '</td>';
                html += '<td>' + record.server_host + '</td>';
                html += '<td><span class="status ' + statusClass + '">' + statusText + '</span></td>';
                html += '<td>' + duration + '</td>';
                html += '<td>' + executionTime + '</td>';
                html += '<td>' + (record.result_data ? '📋 View' : '-') + '</td>';
                html += '<td><div class="actions">';
                html += '<button class="action-btn" onclick="copyQuery(' + record.id + ')">Copy</button>';
                html += '<button class="action-btn" onclick="runQuery(' + record.id + ')">Run</button>';
                html += '<button class="action-btn" onclick="showResult(' + record.id + ')">Result</button>';
                html += '</div></td>';
                html += '</tr>';
            });

            html += '</tbody></table></div>';
            document.getElementById('tableContainer').innerHTML = html;
        }

        function viewQuery(id) {
            const record = records.find(r => r.id === id);
            if (record) {
                const modal = document.getElementById('resultModal');
                const jsonTree = document.getElementById('jsonTree');
                jsonTree.textContent = record.query_text;
                modal.classList.add('active');
            }
        }

        let currentResultData = null;
        let resultViewMode = 'table'; // 'table' or 'json'

        function showResult(id) {
            const record = records.find(r => r.id === id);
            if (record && record.result_data) {
                currentResultData = record.result_data;
                resultViewMode = 'table';
                renderResultData();
                const modal = document.getElementById('resultModal');
                modal.classList.add('active');
            }
        }

        function renderResultData() {
            const container = document.getElementById('resultContainer');
            if (!currentResultData) return;

            if (resultViewMode === 'table') {
                container.innerHTML = renderResultAsTable(currentResultData);
            } else {
                container.innerHTML = '<div class="json-tree">' + escapeHtml(JSON.stringify(currentResultData, null, 2)) + '</div>';
            }
        }

        function toggleResultView() {
            resultViewMode = resultViewMode === 'table' ? 'json' : 'table';
            renderResultData();
        }

        function renderResultAsTable(data) {
            if (!data) return '<div class="result-info">No result data available</div>';

            // Parse JSON string if needed (for backward compatibility)
            let parsedData = data;
            if (typeof data === 'string') {
                try {
                    parsedData = JSON.parse(data);
                } catch (e) {
                    return '<div class="result-info">Error parsing result data</div>';
                }
            }

            // Handle different data structures
            if (Array.isArray(parsedData)) {
                return renderArrayAsTable(parsedData);
            } else if (parsedData.rows && Array.isArray(parsedData.rows)) {
                // PostgreSQL result format
                return renderArrayAsTable(parsedData.rows);
            } else if (typeof parsedData === 'object' && Object.keys(parsedData).length > 0) {
                // Single object
                return renderArrayAsTable([parsedData]);
            } else {
                return '<div class="result-info">' + escapeHtml(JSON.stringify(parsedData)) + '</div>';
            }
        }

        function renderArrayAsTable(rows) {
            if (!Array.isArray(rows) || rows.length === 0) {
                return '<div class="result-info">No rows returned</div>';
            }

            // Get all unique column names
            const columns = new Set();
            rows.forEach(row => {
                if (typeof row === 'object' && row !== null) {
                    Object.keys(row).forEach(key => columns.add(key));
                }
            });

            const columnArray = Array.from(columns);
            if (columnArray.length === 0) {
                return '<div class="result-info">Invalid data format</div>';
            }

            let html = '<div class="result-info">📊 Showing ' + rows.length + ' row' + (rows.length !== 1 ? 's' : '') + ' with ' + columnArray.length + ' column' + (columnArray.length !== 1 ? 's' : '') + '</div>';
            html += '<div class="result-table-wrapper"><table class="result-table"><thead><tr>';

            // Header row
            columnArray.forEach(col => {
                html += '<th>' + escapeHtml(String(col)) + '</th>';
            });
            html += '</tr></thead><tbody>';

            // Data rows
            rows.forEach((row, rowIndex) => {
                html += '<tr>';
                columnArray.forEach(col => {
                    const value = row[col];
                    const displayValue = formatCellValue(value);
                    html += '<td>' + displayValue + '</td>';
                });
                html += '</tr>';
            });

            html += '</tbody></table></div>';
            return html;
        }

        function formatCellValue(value) {
            if (value === null || value === undefined) {
                return '<span style="color: var(--vscode-descriptionForeground); font-style: italic;">NULL</span>';
            }
            if (typeof value === 'boolean') {
                return '<span style="color: ' + (value ? '#4caf50' : '#f44336') + '">' + (value ? 'true' : 'false') + '</span>';
            }
            if (typeof value === 'object') {
                return '<pre style="background-color: var(--vscode-editor-inlineValueBackground); padding: 4px; border-radius: 2px; margin: 0; font-size: 11px;">' + escapeHtml(JSON.stringify(value)) + '</pre>';
            }
            const strValue = String(value);
            if (strValue.length > 100) {
                return escapeHtml(strValue.substring(0, 100)) + '...';
            }
            return escapeHtml(strValue);
        }

        function copyQuery(id) {
            const record = records.find(r => r.id === id);
            if (record) {
                vscode.postMessage({
                    command: 'copyQuery',
                    query: record.query_text
                });
            }
        }

        function runQuery(id) {
            const record = records.find(r => r.id === id);
            if (record) {
                vscode.postMessage({
                    command: 'runQuery',
                    query: record.query_text
                });
            }
        }

        function exportData(format) {
            vscode.postMessage({
                command: 'export',
                format: format,
                data: filteredRecords
            });
        }

        function closeModal() {
            document.getElementById('resultModal').classList.remove('active');
        }

        function sortTable(column) {
            filteredRecords.sort((a, b) => {
                const aVal = a[column];
                const bVal = b[column];

                if (typeof aVal === 'string') {
                    return aVal.localeCompare(bVal);
                }
                return aVal - bVal;
            });

            renderTable();
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Close modal when clicking outside
        document.getElementById('resultModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('resultModal')) {
                closeModal();
            }
        });

        // Initialize on load
        window.addEventListener('load', initializeTable);
    </script>
</body>
</html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
