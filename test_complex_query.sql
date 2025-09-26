-- 简化版本的复杂查询用于语法验证
-- 这个版本移除了可能导致语法错误的复杂特性

WITH user_order_stats AS (
    SELECT 
        u.id as user_id,
        u.username,
        COUNT(o.id) as total_orders,
        SUM(o.total_amount) as total_spent
    FROM users u
    JOIN orders o ON u.id = o.user_id
    WHERE o.status = 'completed'
    GROUP BY u.id, u.username
),
product_popularity AS (
    SELECT 
        p.id as product_id,
        p.name as product_name,
        COUNT(o.id) as order_count
    FROM products p
    LEFT JOIN orders o ON 1=1  -- 简化连接条件
    WHERE p.stock_quantity > 0
    GROUP BY p.id, p.name
)

SELECT 
    uos.user_id,
    uos.username,
    uos.total_orders,
    uos.total_spent,
    pp.product_name,
    pp.order_count
FROM user_order_stats uos
CROSS JOIN product_popularity pp
WHERE uos.total_orders > 0
ORDER BY uos.total_spent DESC
LIMIT 50;
