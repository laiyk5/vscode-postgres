# PostgreSQL VSCode 扩展指南

## 项目概述

这是一个用于管理 PostgreSQL 数据库的 VSCode 扩展，提供数据库连接管理、查询执行、代码补全等功能。

## 项目结构

### 根目录文件
- `package.json` - 扩展清单文件，定义命令、快捷键、配置等
- `tsconfig.json` - TypeScript 编译配置
- `webpack.config.js` - Webpack 打包配置
- `README.md` - 项目说明文档
- `CHANGELOG.md` - 版本变更记录
- `LICENSE` - MIT 许可证

### 资源文件
- `images/` - 演示 GIF 图片
- `resources/` - 图标资源（深色/浅色主题）
- `syntaxes/` - PostgreSQL 语法高亮配置

### 源代码目录 (src/)

#### 核心文件
- `extension.ts` - 扩展入口点，注册所有命令和服务
- `common/` - 公共工具类和基础功能
  - `baseCommand.ts` - 命令基类
  - `connection.ts` - PostgreSQL 连接封装
  - `database.ts` - 数据库操作核心逻辑
  - `editorState.ts` - 编辑器状态管理
  - `global.ts` - 全局状态和配置
  - `outputChannel.ts` - 输出通道管理
  - `constants.ts` - 常量定义

#### 命令模块 (commands/)
- `addConnection.ts` - 添加数据库连接
- `deleteConnection.ts` - 删除数据库连接  
- `editConnection.ts` - 编辑数据库连接
- `renameConnection.ts` - 重命名连接
- `selectConnection.ts` - 选择连接
- `selectDatabase.ts` - 选择数据库
- `newQuery.ts` - 新建查询文件  
- `runQuery.ts` - 执行查询 (F5 快捷键)
- `runSelectTop.ts` - 执行选择前N行查询
- `runSelectTop1000.ts` - 执行选择前1000行
- `saveResult.ts` - 保存查询结果
- `refresh.ts` - 刷新资源管理器
- 各种复制命令：表名、列名、函数名、模式名

#### 树形视图 (tree/)
- `treeProvider.ts` - 数据库资源管理器提供者
- 各种节点类型：连接、数据库、模式、表、列、函数等

#### 语言服务 (language/)
- `client.ts` - 语言客户端
- `server.ts` - 语言服务器
- `validator.ts` - SQL 验证器
- `functionValidator.ts` - 函数验证器

#### 结果视图 (resultsview/)
- `resultsManager.ts` - 结果管理器
- `resultView.ts` - 结果视图渲染
- `scripts/` - 前端脚本文件

#### 查询模块 (queries/)
- `index.ts` - 预定义查询语句

## 支持的功能

### 1. 连接管理
- 添加/删除/编辑/重命名数据库连接
- 多连接支持
- 连接信息加密存储
- SSL 证书支持

### 2. 数据库资源管理器
- 可视化浏览服务器、数据库、模式、表、列
- 上下文菜单操作
- 实时刷新功能
- 虚拟文件夹支持（函数等）

### 3. 查询执行
- **F5 快捷键**执行当前查询或选择
- 支持多查询语句（分号分隔）
- 在任何文件中执行选中的 SQL
- 选择前N行查询
- 异步查询执行

### 4. 结果处理
- 表格形式显示查询结果
- 支持 JSON、XML、CSV 格式导出
- 多结果集支持
- 性能统计显示

### 5. 代码智能
- 语法高亮（.pgsql, .psql 文件）
- 连接感知的代码补全
  - 关键字补全
  - 函数签名提示
  - 表名和列名补全
- 实时错误检测（基于 EXPLAIN）
- 函数验证

### 6. 编辑器集成
- 状态栏显示当前连接信息
- 每个编辑器可设置不同连接
- 快速切换数据库
- 上下文菜单集成

### 7. 配置选项
- 默认连接设置
- 默认数据库设置
- 资源管理器显示控制
- JSON 字段美化打印
- 列排序方式
- 时间间隔格式
- 虚拟文件夹配置

## 调试和开发

### 编译命令
```bash
npm run watch      # 开发模式监听编译
npm run compile    # 一次性编译
npm run build-preview # 生产环境构建
```

### 调试设置
1. 在 VSCode 中打开项目
2. 按 F5 启动调试扩展
3. 在新窗口中测试扩展功能

### 常见问题
- **F5 不工作**: 检查文件扩展名(.pgsql/.psql)、连接状态、错误输出
- **连接失败**: 检查数据库服务器状态、网络连接、认证信息
- **编译错误**: Node.js 版本兼容性问题，使用 `--openssl-legacy-provider` 标志

## 技术架构

- **语言**: TypeScript
- **数据库驱动**: pg (node-postgres)
- **通信协议**: VSCode Language Server Protocol
- **构建工具**: Webpack + TypeScript Compiler
- **UI 框架**: VSCode Extension API

## 文件依赖关系

```
extension.ts → 注册所有命令和服务
    ├── commands/* → 用户操作处理
    ├── tree/treeProvider.ts → 资源管理器
    ├── language/client.ts → 语言服务
    └── common/database.ts → 数据库核心操作
        └── common/connection.ts → PostgreSQL 连接
```

这个扩展提供了一个完整的 PostgreSQL 数据库管理解决方案，集成了连接管理、查询执行、代码智能和结果处理等功能。
