# Analyze Query Plan 功能使用指南

## 功能概述

`analyzeQueryPlan` 功能是 VSCode PostgreSQL 扩展的一部分，用于分析 SQL 查询的执行计划。该功能可以帮助开发者优化查询性能，识别潜在的性能瓶颈。

## 功能配置状态

✅ **配置检查结果：**
- 命令已注册：`vscode-postgres.analyzeQueryPlan`
- 快捷键已配置：`Ctrl+Shift+F5`
- 命令面板菜单项已配置
- 命令文件存在且功能完整
- 错误处理已修复：解决了"Cannot read properties of undefined"问题

## 使用方法

### 方法1：使用快捷键
1. 打开包含 PostgreSQL SQL 查询的文件（如 `complex_query_test.sql`）
2. 确保文件语言模式设置为 `PostgreSQL`
3. 按下 `Ctrl+Shift+F5` 快捷键
4. 查看生成的查询执行计划分析结果

### 方法2：通过命令面板
1. 打开命令面板 (`Ctrl+Shift+P`)
2. 搜索 "PostgreSQL: Analyze Query Plan"
3. 选择并执行该命令
4. 查看分析结果

## 测试查询文件

已创建以下测试文件用于验证功能：

### 1. complex_query_test.sql
- **文件路径**: `complex_query_test.sql`
- **特点**: 高度复杂的查询，包含：
  - 多层 CTE（公共表表达式）
  - 窗口函数（ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD）
  - CROSS JOIN 增加复杂度
  - 多层嵌套查询
  - 复杂的聚合和条件逻辑
- **用途**: 测试 analyzeQueryPlan 功能对复杂查询的分析能力

### 2. test_complex_query.sql
- **文件路径**: `test_complex_query.sql`
- **特点**: 简化版本的复杂查询，用于快速测试
- **用途**: 快速验证功能是否正常工作

## 功能技术实现

### 快捷键配置
```json
{
  "command": "vscode-postgres.analyzeQueryPlan",
  "key": "ctrl+shift+f5",
  "when": "editorLangId == postgres"
}
```

### 命令配置
```json
{
  "command": "vscode-postgres.analyzeQueryPlan",
  "title": "Analyze Query Plan",
  "category": "PostgreSQL"
}
```

### 核心功能文件
- `src/commands/analyzeQueryPlan.ts` - 主要命令实现
- `src/common/database.ts` - 执行计划分析逻辑
- `package.json` - 扩展配置

## 预期输出

执行 analyzeQueryPlan 功能后，将生成包含以下信息的执行计划分析：

1. **查询执行时间**
2. **执行计划树结构**
3. **节点类型和成本**
4. **扫描类型（Seq Scan, Index Scan等）**
5. **连接类型（Nested Loop, Hash Join等）**
6. **过滤条件和索引使用情况**
7. **内存使用和缓冲区统计**
8. **性能优化建议**

## 故障排除

### 常见问题

1. **快捷键不工作**
   - 检查文件语言模式是否为 PostgreSQL
   - 确认扩展已正确安装和激活

2. **命令未找到**
   - 重新加载 VSCode 窗口 (`Ctrl+Shift+P` → `Developer: Reload Window`)
   - 检查扩展是否已启用

3. **分析结果异常**
   - 确保数据库连接正常
   - 检查查询语法是否正确
   - 验证数据库表结构是否存在

### 调试方法

1. 打开 VSCode 开发者工具查看控制台输出
2. 检查扩展输出面板中的日志信息
3. 使用测试查询文件验证功能

## 最佳实践

1. **测试复杂查询**: 使用 `complex_query_test.sql` 测试功能对复杂场景的支持
2. **性能对比**: 分析不同查询变体的执行计划，选择最优方案
3. **索引优化**: 根据分析结果优化数据库索引设计
4. **查询重构**: 识别性能瓶颈并重构查询逻辑

## 相关文件

- `complex_query_test.sql` - 复杂测试查询
- `test_complex_query.sql` - 简化测试查询
- `ANALYZE_QUERY_PLAN_FIX_SUMMARY.md` - 功能修复总结
- `check_analyze_config.js` - 配置检查脚本

---

**最后更新**: 2025-09-23  
**功能状态**: ✅ 完全可用  
**测试状态**: ✅ 通过配置检查
