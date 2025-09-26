# SQL执行计划分析功能使用指南

## 功能概述

此VSCode PostgreSQL插件新增了SQL执行计划分析功能，可以分析SQL查询的执行计划，评估查询效率，并提供优化建议。

## 使用方法

### 1. 通过命令面板
1. 打开包含SQL查询的文件（.pgsql或.psql扩展名）
2. 按 `Ctrl+Shift+P` 打开命令面板
3. 输入 "Analyze Query Plan" 并选择该命令
4. 系统将分析当前选中的SQL或整个文件的SQL

### 2. 通过右键菜单
1. 在SQL文件中选中要分析的SQL语句
2. 右键点击选择 "Analyze Query Plan"

### 3. 快捷键（可选配置）
可以在keybindings.json中添加快捷键：
```json
{
    "command": "vscode-postgres.analyzeQueryPlan",
    "key": "ctrl+shift+f5",
    "when": "editorLangId == postgres"
}
```

## 功能特性

### 执行计划分析
- 使用 `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` 获取详细执行计划
- 分析查询成本、执行时间、缓冲区使用等指标

### 性能评估
- **优秀**：执行时间 < 100ms，无性能问题
- **良好**：执行时间 100ms-1s，有少量优化空间  
- **需要优化**：执行时间 > 1s，存在明显性能问题

### 常见问题检测
- 顺序扫描（Seq Scan）检测
- 嵌套循环连接性能问题
- 大排序操作检测
- 哈希连接性能问题

### 优化建议
- 索引创建建议
- 连接方式优化
- 查询重写建议
- 统计信息更新建议

## 示例分析

### 示例1：高效查询
```sql
SELECT * FROM users WHERE id = 1;
```
**分析结果**：
- 效率评级：优秀
- 使用索引扫描，执行时间 < 10ms
- 无优化建议

### 示例2：需要优化的查询
```sql
SELECT * FROM orders o 
JOIN customers c ON o.customer_id = c.id 
WHERE c.name LIKE '%smith%';
```
**分析结果**：
- 效率评级：需要优化
- 检测到顺序扫描
- 建议：在customers.name列添加索引

## 输出格式

分析结果以Markdown格式显示，包含：
1. **效率评级**：优秀/良好/需要优化
2. **性能统计**：成本、时间、行数、缓冲区使用
3. **检测到的问题**：具体性能问题列表
4. **优化建议**：具体的改进措施
5. **额外建议**：通用的性能优化建议

## 调试方法

### 1. 启用调试模式
在VSCode中按F5启动调试会话，选择"Extension"配置。

### 2. 查看日志输出
- 打开VSCode的输出面板（View → Output）
- 选择"PostgreSQL"输出通道查看详细日志

### 3. 常见问题排查
- **连接问题**：确保PostgreSQL服务器可访问
- **权限问题**：确保用户有执行EXPLAIN权限
- **语法错误**：检查SQL语法是否正确

## 技术实现

### 核心文件
- `src/commands/analyzeQueryPlan.ts` - 命令处理逻辑
- `src/common/database.ts` - 执行计划分析核心逻辑

### 分析方法
1. 执行`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`查询
2. 递归分析执行计划树结构
3. 提取性能指标和问题模式
4. 生成优化建议和评级

## 最佳实践

1. **定期分析**：对关键查询定期进行执行计划分析
2. **索引优化**：根据建议创建合适的索引
3. **统计更新**：定期运行`ANALYZE`更新统计信息
4. **查询优化**：避免全表扫描和不必要的排序操作

此功能帮助开发者快速识别SQL性能瓶颈，提高数据库查询效率。
