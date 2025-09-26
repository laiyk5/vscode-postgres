# VSCode PostgreSQL插件调试指南

## F5调试问题解决方案

### 问题描述
按F5没有弹出调试窗口，可能是因为npm run watch已经在运行，导致调试任务冲突。

### 解决方案

#### 方法1：停止现有进程后调试
1. **停止正在运行的watch进程**：
   - 在终端中按 `Ctrl+C` 停止npm run watch
   - 或者使用任务管理器结束node.exe进程

2. **重新启动调试**：
   - 按F5选择"Extension"配置
   - 系统会自动运行npm run watch作为preLaunchTask
   - 等待编译完成后会打开新的VSCode窗口

#### 方法2：修改调试配置（推荐）
编辑 `.vscode/launch.json`，将preLaunchTask改为compile：

```json
{
    "name": "Extension",
    "type": "extensionHost",
    "request": "launch",
    "runtimeExecutable": "${execPath}",
    "args": ["--extensionDevelopmentPath=${workspaceRoot}" ],
    "stopOnEntry": false,
    "sourceMaps": true,
    "outFiles": [ "${workspaceRoot}/out/**/*.js" ],
    "preLaunchTask": "npm: compile"  // 改为compile而不是watch
}
```

#### 方法3：手动编译后调试
1. 停止所有Node进程
2. 运行编译命令：
   ```bash
   cd vscode-postgres-master
   npm run compile
   ```
3. 按F5启动调试

### 正确的调试步骤

#### 步骤1：准备工作
1. 确保项目依赖已安装：
   ```bash
   npm install
   ```

2. 检查TypeScript编译：
   ```bash
   npm run compile
   ```

#### 步骤2：启动调试
1. 在VSCode中打开项目根目录
2. 按F5或点击调试侧边栏
3. 选择"Extension"配置
4. 点击绿色播放按钮

#### 步骤3：测试功能
1. 在新打开的VSCode窗口中：
   - 打开一个.pgsql文件
   - 添加PostgreSQL连接
   - 测试SQL查询执行（F5）
   - 测试新增的"Analyze Query Plan"功能

### 常见调试问题

#### 问题1：调试窗口不弹出
- **原因**: preLaunchTask失败或端口冲突
- **解决**: 检查终端输出，停止冲突进程

#### 问题2：编译错误
- **原因**: TypeScript语法错误
- **解决**: 查看终端错误信息，修复代码

#### 问题3：插件不加载
- **原因**: 输出文件路径错误
- **解决**: 检查outFiles配置和实际文件路径

#### 问题4：命令不显示
- **原因**: package.json命令注册错误
- **解决**: 验证commands和menus配置

### 调试技巧

#### 1. 断点调试
- 在TypeScript文件中设置断点
- 断点会在编译后的JavaScript文件中生效
- 使用调试控制台查看变量值

#### 2. 输出日志
- 打开输出面板（View → Output）
- 选择"PostgreSQL"通道查看插件日志
- 查看调试控制台获取详细错误信息

#### 3. 热重载
- 修改代码后保存
- 在新调试窗口中重新加载窗口（Ctrl+R）
- 或者停止调试后重新启动

### 测试新增的Analyze Query Plan功能

1. **创建测试连接**：
   - 使用"PostgreSQL: Add Connection"命令
   - 配置有效的PostgreSQL连接参数

2. **测试SQL文件**：
   - 打开test_query_analysis.pgsql
   - 选中一个SQL查询
   - 右键选择"Analyze Query Plan"

3. **验证输出**：
   - 检查结果面板是否显示分析报告
   - 确认效率评级和优化建议正确显示

### 故障排除清单

- [ ] Node进程是否冲突？
- [ ] TypeScript编译是否成功？
- [ ] out目录是否有最新文件？
- [ ] package.json命令是否正确注册？
- [ ] 数据库连接是否可访问？
- [ ] 是否有权限执行EXPLAIN命令？

按照以上步骤操作，应该能够成功启动调试并测试所有功能。
