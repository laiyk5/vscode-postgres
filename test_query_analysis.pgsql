-- 测试SQL执行计划分析功能的示例查询
-- 这个文件包含不同类型的SQL查询用于测试分析功能

-- 示例1：简单的索引查询（应该显示优秀性能）
SELECT * FROM users WHERE id = 1;

-- 示例2：可能产生顺序扫描的查询（可能需要优化）
SELECT * FROM orders WHERE customer_name LIKE '%smith%';

-- 示例3：连接查询
SELECT u.name, o.order_date, o.total_amount 
FROM users u 
JOIN orders o ON u.id = o.user_id 
WHERE u.created_at > '2023-01-01';

-- 示例4：聚合查询
SELECT category, COUNT(*) as product_count, AVG(price) as avg_price
FROM products 
GROUP BY category 
ORDER BY product_count DESC;

-- 示例5：子查询
SELECT name, email 
FROM users 
WHERE id IN (SELECT user_id FROM orders WHERE total_amount > 1000);

-- 示例6：窗口函数
SELECT 
    name,
    department,
    salary,
    RANK() OVER (PARTITION BY department ORDER BY salary DESC) as rank_in_dept
FROM employees;
