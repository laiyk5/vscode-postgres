import BaseCommand from "../common/baseCommand";
import * as vscode from 'vscode';
import { EditorState } from "../common/editorState";
import { SQLHistoryVisualization } from "../common/sqlHistoryVisualization";
import { IConnection } from "../common/IConnection";
import { Global } from "../common/global";
import { QuickPickItem } from "vscode";

interface IConnQuickPick extends QuickPickItem {
  connection: IConnection;
}

export class sqlHistoryVisualizationCommand extends BaseCommand {
  async run() {
    let connection: IConnection;

    // 检查是否已有活动连接
    if (EditorState.connection) {
      connection = EditorState.connection;
    } else {
      // 如果没有，提示用户选择一个
      const connections = Global.context.globalState.get<{[key: string]: IConnection}>(`connections`);
      if (!connections || Object.keys(connections).length === 0) {
        vscode.window.showInformationMessage('No database connections found.');
        return;
      }
      
      const quickPicks: IConnQuickPick[] = Object.keys(connections).map(key => {
        let conn = connections[key];
        return {
          label: conn.label || `${conn.user}@${conn.host}`,
          connection: conn
        };
      });

      const selectedConnection = await vscode.window.showQuickPick(
        quickPicks,
        { placeHolder: 'Select a connection to visualize its history' }
      );

      if (selectedConnection) {
        connection = selectedConnection.connection;
      } else {
        // 用户取消了选择
        return;
      }
    }

    // 获取密码（如果需要）
    if (connection.hasPassword || !connection.hasOwnProperty('hasPassword')) {
      const connections = Global.context.globalState.get<{[key: string]: IConnection}>(`connections`);
      const connectionKey = Object.keys(connections || {}).find(key => 
        connections?.[key]?.host === connection.host && 
        connections?.[key]?.user === connection.user
      );
      
      if (connectionKey) {
        connection.password = await Global.context.secrets.get(connectionKey);
      }
    }

    // 调用可视化面板
    await SQLHistoryVisualization.getInstance().visualize(connection);
  }
}
