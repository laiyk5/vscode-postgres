# VSCode PostgreSQL插件项目概述

## 项目简介
这是一个用于管理PostgreSQL数据库的VSCode插件，提供数据库连接管理、SQL查询执行、结果查看和性能分析等功能。

## 文件结构说明

### 配置文件
- **package.json** - 插件清单文件，定义命令、菜单、配置项和依赖
- **tsconfig.json** - TypeScript编译配置
- **webpack.config.js** - Webpack打包配置
- **language-configuration.json** - PostgreSQL语言配置

### 源代码目录 (src/)

#### 核心文件
- **extension.ts** - 插件入口点，注册所有命令和功能
- **common/constants.ts** - 常量定义
- **common/global.ts** - 全局变量和配置

#### 命令模块 (src/commands/)
- **addConnection.ts** - 添加数据库连接
- **deleteConnection.ts** - 删除数据库连接
- **editConnection.ts** - 编辑连接配置
- **selectConnection.ts** - 选择活动连接
- **newQuery.ts** - 创建新查询文件
- **runQuery.ts** - 执行SQL查询 (F5快捷键)
- **analyzeQueryPlan.ts** - **新增**: SQL执行计划分析功能
- **saveResult.ts** - 保存查询结果
- **copy*.ts** - 各种复制功能（表名、列名等）
- **selectTop*.ts** - 选择前N行数据

#### 数据库核心 (src/common/)
- **database.ts** - 数据库操作核心，包含查询执行和执行计划分析
- **connection.ts** - 数据库连接管理
- **baseCommand.ts** - 命令基类
- **editorState.ts** - 编辑器状态管理
- **outputChannel.ts** - 输出通道管理
- **multiStepInput.ts** - 多步输入界面

#### 树形视图 (src/tree/)
- **treeProvider.ts** - 数据库资源管理器树形视图
- ***Node.ts** - 各种节点类型（连接、数据库、表、列等）
- **INode.ts** - 节点接口定义

#### 结果视图 (src/resultsview/)
- **resultsManager.ts** - 查询结果管理
- **resultView.ts** - 结果展示界面
- **scripts/** - 前端脚本文件

#### 语言支持 (src/language/)
- **client.ts** - 语言客户端
- **server.ts** - 语言服务器
- **validator.ts** - SQL语法验证

### 资源文件
- **resources/** - 图标资源（深色/浅色主题）
- **syntaxes/** - SQL语法高亮定义
- **images/** - 功能演示图片

## 新增功能：SQL执行计划分析

### 实现文件
- **src/commands/analyzeQueryPlan.ts** - 命令处理逻辑
- **src/common/database.ts** - 新增analyzeQueryPlan方法

### 功能特性
1. **执行计划获取**: 使用`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`
2. **性能分析**: 自动检测常见性能问题
3. **优化建议**: 提供具体的改进措施
4. **评级系统**: 优秀/良好/需要优化三级评级

## 调试方法

### 1. 开发环境设置
```bash
# 安装依赖
npm install

# 开发模式编译（监听文件变化）
npm run watch

# 生产编译
npm run compile
```

### 2. VSCode调试配置
在VSCode中按F5启动调试：
- 选择"Extension"配置
- 新窗口中将加载插件进行测试

### 3. 调试技巧
- **断点设置**: 在TypeScript文件中设置断点
- **输出日志**: 查看"PostgreSQL"输出通道
- **错误追踪**: 使用VSCode的调试控制台

### 4. 测试方法
1. **连接测试**: 确保PostgreSQL服务器可访问
2. **功能测试**: 使用test_query_analysis.pgsql文件测试
3. **边界测试**: 测试空查询、错误SQL等情况

### 5. 常见问题排查
- **编译错误**: 检查TypeScript语法和类型
- **运行时错误**: 查看输出面板的错误信息
- **连接问题**: 验证数据库连接参数
- **权限问题**: 确保有执行EXPLAIN权限

## 插件使用流程

### 1. 数据库连接
- 使用"Add Connection"添加连接
- 配置主机、端口、用户名、密码等信息
- 选择默认数据库

### 2. SQL查询执行
- 创建.pgsql或.psql文件
- 编写SQL语句
- 按F5执行查询或使用右键菜单

### 3. 结果查看
- 查询结果在单独面板显示
- 支持结果导出和保存
- 可以查看执行时间统计

### 4. 执行计划分析
- 选中SQL语句
- 使用"Analyze Query Plan"命令
- 查看性能分析和优化建议

## 扩展开发指南

### 添加新命令
1. 在src/commands/创建新命令文件
2. 继承BaseCommand类
3. 在package.json的commands数组中注册
4. 在menus部分配置显示位置

### 修改现有功能
1. 理解相关模块的职责
2. 修改TypeScript源代码
3. 运行npm run watch自动编译
4. 重新加载插件测试

### 添加新功能
参考analyzeQueryPlan功能的实现模式：
1. 创建命令处理文件
2. 在database.ts中添加核心逻辑
3. 更新package.json配置
4. 创建测试用例

## 性能优化建议

### 插件性能
- 避免阻塞UI线程的长时操作
- 使用异步操作处理数据库查询
- 合理管理数据库连接池

### 查询优化
- 使用新增的执行计划分析功能
- 定期分析关键查询的性能
- 根据建议创建合适的索引

此插件为PostgreSQL数据库开发提供了完整的集成开发环境，支持高效的数据库管理和查询优化。
