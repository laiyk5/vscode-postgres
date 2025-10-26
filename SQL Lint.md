SQL Lint 功能使用指南.

📌 简介

SQL Lint 是 VS Code PostgreSQL 扩展的一个功能，它可以个性化自动格式化 SQL 代码，应用最佳实践规则，并检测潜在的性能和安全问题。本指南将介绍如何使用这个功能以及它包含的各种规则。

🚀 如何使用 SQL Lint

方法 1：通过命令面板

1. 打开一个 SQL 文件（.pgsql 或 .sql）
2. 按 Ctrl+Shift+P（Windows/Linux）或 Cmd+Shift+P（Mac）
3. 输入 "SQL Lint"
4. 选择并执行命令
5. 格式化后的 SQL 将显示在侧边的新编辑器中

方法 2：在新建查询时自动应用

1. 使用 "New Query" 命令创建新查询
2. 输入 SQL 代码
3. 执行 SQL Lint 命令格式化代码
4. 格式化后的代码将替换原始内容

⚠️ 重要提示

Lint 结果窗口是只读的，不能直接执行查询。您需要：
1. 将格式化后的 SQL 复制到原始编辑器
2. 在原始编辑器中使用 F5 或右键菜单执行查询

🔧 配置选项

在 VS Code 设置中（settings.json）可以配置 SQL Lint 的行为：
{
    "vscode-postgres.sqlLint.caseStyle": "upper",
    "vscode-postgres.sqlLint.indentSize": 4,
    "vscode-postgres.sqlLint.enableWarnings": true,
    "vscode-postgres.sqlLint.autoCopyToOriginal": false
}（还没实现）


或者在 package.json 中定义配置属性：
"configuration": {
    "properties": {
        "vscode-postgres.sqlLint.caseStyle": {
            "type": "string",
            "enum": ["upper", "lower"],
            "default": "upper",
            "description": "SQL关键字大小写风格"
        },
        "vscode-postgres.sqlLint.indentSize": {
            "type": "number",
            "default": 4,
            "description": "缩进空格数"
        },
        "vscode-postgres.sqlLint.enableWarnings": {
            "type": "boolean",
            "default": true,
            "description": "启用潜在问题检测"
        },
        "vscode-postgres.sqlLint.autoCopyToOriginal": {
            "type": "boolean",
            "default": false,
            "description": "自动将Lint结果复制回原编辑器"
        }
    }
}


📋 已实现的 Lint 规则

1. 关键字大小写统一

• 统一 SQL 关键字的大小写（大写或小写）

• 支持的关键字：SELECT, FROM, WHERE, JOIN, GROUP BY 等

2. 缩进格式化

• 自动添加适当的缩进

• 根据 SQL 结构调整缩进级别

• 可配置缩进大小（默认 4 空格）

3. 避免 SELECT *

• 检测并标记 SELECT * 的使用

• 建议明确指定需要的列

4. 显式 JOIN 转换

• 将隐式 JOIN（逗号分隔）转换为显式 JOIN 语法

• 提高可读性和可维护性

5. 别名格式化

• 统一别名格式（添加 AS 关键字）

• 示例：FROM users u → FROM users AS u

6. 分号结尾

• 确保 SQL 语句以分号结尾

• 符合 SQL 标准

7. 潜在问题检测

• N+1 查询警告：检测可能的 N+1 查询模式

• 索引提示：建议为 WHERE/JOIN 条件添加索引

• SQL 注入警告：检测直接拼接字符串值

• 性能提示：标记可能影响性能的模式

8. 函数调用格式化

• 统一聚合函数调用格式

• 示例：count(*) → COUNT(*)

📝 示例代码

示例 1：基本查询（Lint 前）

select * from orders o, customers c 
where o.customer_id = c.id 
and c.country = 'USA'
order by o.order_date desc


示例 1：Lint 后

/*
⚠️ 警告：可能存在 N+1 查询问题，考虑使用 JOIN 优化
🔍 提示：确保以下列有索引: o.customer_id, c.id, c.country, o.order_date
🛡️ 警告：直接拼接字符串值，考虑使用参数化查询防止 SQL 注入
*/

SELECT /* 避免使用 SELECT *，明确指定需要的列 */ FROM orders AS o
    JOIN customers AS c ON o.customer_id = c.id
        AND c.country = 'USA'
        ORDER BY o.order_date DESC;


示例 2：聚合查询（Lint 前）

select product_name, count(*) as order_count
from order_details od
join products p on od.product_id = p.id
where p.category = 'Electronics'
group by product_name
having count(*) > 10


示例 2：Lint 后

/*
🔍 提示：确保以下列有索引: od.product_id, p.id, p.category
🛡️ 警告：直接拼接字符串值，考虑使用参数化查询防止 SQL 注入
*/

SELECT product_name, COUNT(*) AS order_count
    FROM order_details AS od
        JOIN products AS p ON od.product_id = p.id
            WHERE p.category = 'Electronics'
                GROUP BY product_name
                    HAVING COUNT(*) > 10;


示例 3：复杂查询（Lint 前）

select u.name, o.order_date, p.name as product_name, od.quantity
from users u
inner join orders o on u.id = o.user_id
inner join order_details od on o.id = od.order_id
inner join products p on od.product_id = p.id
where u.country = 'Canada' and o.status = 'completed'
order by o.order_date desc


示例 3：Lint 后

/*
🔍 提示：确保以下列有索引: u.id, o.user_id, o.id, od.order_id, od.product_id, p.id, u.country, o.status
🛡️ 警告：直接拼接字符串值，考虑使用参数化查询防止 SQL 注入
*/

SELECT u.name, o.order_date, p.name AS product_name, od.quantity
    FROM users AS u
        INNER JOIN orders AS o ON u.id = o.user_id
        INNER JOIN order_details AS od ON o.id = od.order_id
        INNER JOIN products AS p ON od.product_id = p.id
            WHERE u.country = 'Canada'
                AND o.status = 'completed'
                ORDER BY o.order_date DESC;


示例 4：CTE 和窗口函数（Lint 前）

with monthly_sales as (
    select date_trunc('month', order_date) as month,
    product_id,
    sum(quantity) as total_quantity
    from orders
    group by month, product_id
)
select month, product_id, total_quantity,
rank() over (partition by month order by total_quantity desc) as sales_rank
from monthly_sales
where total_quantity > 100


示例 4：Lint 后

/*
🔍 提示：确保以下列有索引: order_date, product_id, quantity
🛡️ 警告：直接拼接字符串值，考虑使用参数化查询防止 SQL 注入
*/

WITH monthly_sales AS (
    SELECT DATE_TRUNC('month', order_date) AS month,
        product_id,
        SUM(quantity) AS total_quantity
        FROM orders
            GROUP BY month, product_id
)
SELECT month, product_id, total_quantity,
    RANK() OVER (PARTITION BY month ORDER BY total_quantity DESC) AS sales_rank
    FROM monthly_sales
        WHERE total_quantity > 100;


💡 使用建议

1. 开发过程中使用：在编写 SQL 时定期运行 Lint，确保代码质量
2. 代码审查前：在提交代码前运行 Lint，修复潜在问题
3. 性能优化：关注 Lint 提供的索引建议，优化查询性能
4. 安全加固：注意 SQL 注入警告，使用参数化查询
5. 结果处理：记得将 Lint 结果复制回原始编辑器才能执行查询

🛠️ 故障排除

如果 SQL Lint 不工作：
1. 确保文件语言模式设置为 "Postgres"
2. 检查 VS Code 输出面板是否有错误信息
3. 尝试重新加载 VS Code 窗口
4. 确保扩展已更新到最新版本
5. 记住：Lint 结果窗口不能直接执行查询，需要复制回原编辑器

📞 支持与反馈


SQL Lint 功能将持续更新，添加更多规则和改进！