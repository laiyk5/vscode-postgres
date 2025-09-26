# PostgreSQL VSCode 扩展功能开发指南

## 功能开发流程

### 1. 确定功能类型
根据要添加的功能类型，确定需要修改的文件：

#### A. 新命令功能
- 需要用户交互的命令（如新的查询操作、管理功能等）

#### B. 核心功能增强
- 数据库操作、连接管理、查询执行等底层功能

#### C. UI/UX 改进
- 界面显示、状态栏、资源管理器等

#### D. 语言服务增强
- 代码补全、语法检查、智能提示等

## 文件修改指南

### 1. 添加新命令（最常见）

#### 步骤 1: 在 package.json 中注册命令
```json
{
  "contributes": {
    "commands": [
      {
        "command": "vscode-postgres.yourNewCommand",
        "title": "Your New Command",
        "category": "PostgreSQL"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "vscode-postgres.yourNewCommand",
          "when": "editorLangId == postgres"
        }
      ],
      "editor/context": [
        {
          "command": "vscode-postgres.yourNewCommand",
          "when": "editorLangId == postgres",
          "group": "navigation"
        }
      ]
    }
  }
}
```

#### 步骤 2: 创建命令文件
在 `src/commands/` 目录下创建新文件，如 `yourNewCommand.ts`：

```typescript
import BaseCommand from "../common/baseCommand";
import * as vscode from 'vscode';

export class yourNewCommandCommand extends BaseCommand {
  async run() {
    // 你的命令逻辑
    vscode.window.showInformationMessage('新命令执行成功！');
  }
}
```

#### 步骤 3: 注册命令
命令会自动通过 `extension.ts` 中的动态加载机制注册。

### 2. 修改核心功能

#### 数据库操作相关
- 修改 `src/common/database.ts` - 核心数据库操作
- 修改 `src/common/connection.ts` - 连接管理

#### 状态管理相关
- 修改 `src/common/editorState.ts` - 编辑器状态
- 修改 `src/common/global.ts` - 全局状态

#### 结果处理相关
- 修改 `src/resultsview/` 目录下的文件

### 3. 添加新的树节点

#### 步骤 1: 创建节点类
在 `src/tree/` 目录下创建新的节点类，如 `yourNode.ts`：

```typescript
import { INode } from './INode';

export class YourNode implements INode {
  constructor(
    public readonly label: string,
    public readonly contextValue: string
  ) {}

  getTreeItem(): vscode.TreeItem {
    // 返回树项
  }

  getChildren(): INode[] {
    // 返回子节点
  }
}
```

#### 步骤 2: 在树提供者中集成
修改 `src/tree/treeProvider.ts` 来包含新节点。

### 4. 语言服务增强

#### 代码补全
- 修改 `src/language/server.ts` - 语言服务器
- 修改 `src/language/validator.ts` - 验证逻辑

#### 语法高亮
- 修改 `syntaxes/pgsql.tmLanguage` - 语法定义

## 具体功能示例

### 示例 1: 添加"导出表结构"功能

#### 需要修改的文件：
1. `package.json` - 注册新命令
2. `src/commands/exportTableSchema.ts` - 新命令实现
3. `src/common/database.ts` - 添加导出表结构的数据库方法
4. `src/tree/tableNode.ts` - 在表节点的上下文菜单中添加选项

### 示例 2: 添加"查询历史"功能

#### 需要修改的文件：
1. `package.json` - 注册查询历史命令和视图
2. `src/commands/showQueryHistory.ts` - 显示历史命令
3. `src/common/global.ts` - 添加历史记录存储
4. `src/tree/queryHistoryNode.ts` - 查询历史节点
5. `src/tree/treeProvider.ts` - 集成查询历史视图

### 示例 3: 添加"数据导入"功能

#### 需要修改的文件：
1. `package.json` - 注册导入命令
2. `src/commands/importData.ts` - 导入命令实现
3. `src/common/database.ts` - 添加批量插入方法
4. `src/resultsview/` - 可能需要修改结果视图支持导入预览

## 开发最佳实践

### 1. 遵循现有模式
- 使用 `BaseCommand` 作为命令基类
- 遵循现有的命名约定
- 使用现有的错误处理模式

### 2. 状态管理
- 通过 `EditorState` 管理编辑器状态
- 使用 `Global.context` 访问扩展上下文
- 通过 `Global.Configuration` 访问配置

### 3. 数据库操作
- 使用 `Database` 类进行数据库操作
- 遵循现有的连接管理方式
- 使用 `PgClient` 进行实际的数据库通信

### 4. 错误处理
- 使用 `try-catch` 包装数据库操作
- 通过 `vscode.window.showErrorMessage` 显示错误
- 使用 `OutputChannel.appendLine` 记录详细错误

### 5. 测试和调试
- 使用 `npm run watch` 进行开发
- 通过 F5 启动调试会话
- 检查 PostgreSQL 输出通道的错误信息

## 编译和测试

1. **开发模式**: `npm run watch`
2. **生产构建**: `npm run build-preview`
3. **调试**: 按 F5 启动扩展开发主机

## 注意事项

- 确保新功能与现有功能兼容
- 遵循 PostgreSQL 扩展的代码风格
- 考虑性能影响，特别是对于大数据量操作
- 添加适当的错误处理和用户反馈
- 更新文档（如 GUIDE.md）说明新功能

通过遵循这个指南，你可以系统地添加新功能到 PostgreSQL VSCode 扩展中。
