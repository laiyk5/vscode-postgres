-- 复杂查询测试 - 基于提供的表结构
-- 这个查询设计为会产生高消耗的执行计划，用于测试analyzeQueryPlan功能

-- 查询目标：分析用户购买行为、产品热度和订单模式
-- 使用多层CTE、窗口函数、复杂连接和聚合操作

WITH user_order_stats AS (
    -- 用户订单统计
    SELECT 
        u.id as user_id,
        u.username,
        u.email,
        COUNT(o.id) as total_orders,
        SUM(o.total_amount) as total_spent,
        AVG(o.total_amount) as avg_order_value,
        MAX(o.order_date) as last_order_date,
        MIN(o.order_date) as first_order_date,
        COUNT(DISTINCT DATE(o.order_date)) as unique_order_days
    FROM users u
    JOIN orders o ON u.id = o.user_id
    WHERE o.status = 'completed'
    GROUP BY u.id, u.username, u.email
    HAVING COUNT(o.id) > 0
),
product_popularity AS (
    -- 产品受欢迎度分析（通过订单关联）
    SELECT 
        p.id as product_id,
        p.name as product_name,
        p.price,
        COUNT(DISTINCT o.id) as order_count,
        SUM(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        AVG(p.price) as avg_product_price,
        MAX(o.order_date) as last_ordered
    FROM products p
    CROSS JOIN orders o  -- 故意使用CROSS JOIN增加复杂度
    WHERE p.stock_quantity > 0
    GROUP BY p.id, p.name, p.price
),
user_product_affinity AS (
    -- 用户-产品亲和度分析（多层嵌套）
    SELECT 
        uos.user_id,
        uos.username,
        pp.product_id,
        pp.product_name,
        ROW_NUMBER() OVER (PARTITION BY uos.user_id ORDER BY pp.order_count DESC) as product_rank,
        CASE 
            WHEN uos.total_spent > (SELECT AVG(total_spent) FROM user_order_stats) 
            THEN 'high_spender'
            ELSE 'regular_spender'
        END as spending_category
    FROM user_order_stats uos
    CROSS JOIN product_popularity pp  -- 再次使用CROSS JOIN增加复杂度
    WHERE pp.order_count > 0
),
complex_analysis AS (
    -- 复杂分析：结合所有数据
    SELECT 
        upa.user_id,
        upa.username,
        upa.product_name,
        upa.product_rank,
        upa.spending_category,
        uos.total_orders,
        uos.total_spent,
        uos.avg_order_value,
        pp.order_count as product_popularity,
        (uos.total_spent * pp.order_count) as weighted_score,
        LAG(uos.total_spent) OVER (PARTITION BY upa.user_id ORDER BY upa.product_rank) as prev_user_spend,
        LEAD(pp.order_count) OVER (PARTITION BY upa.product_id ORDER BY upa.product_rank) as next_product_popularity
    FROM user_product_affinity upa
    JOIN user_order_stats uos ON upa.user_id = uos.user_id
    JOIN product_popularity pp ON upa.product_id = pp.product_id
    WHERE upa.product_rank <= 10  -- 只分析前10个产品
),
final_analysis AS (
    -- 最终分析结果
    SELECT 
        ca.user_id,
        ca.username,
        ca.product_name,
        ca.product_rank,
        ca.spending_category,
        ca.total_orders,
        ca.total_spent,
        ca.avg_order_value,
        ca.product_popularity,
        ca.weighted_score,
        ca.prev_user_spend,
        ca.next_product_popularity,
        CASE 
            WHEN ca.weighted_score > (SELECT AVG(weighted_score) FROM complex_analysis) 
            THEN 'high_affinity'
            ELSE 'low_affinity'
        END as affinity_level,
        RANK() OVER (ORDER BY ca.weighted_score DESC) as overall_rank,
        DENSE_RANK() OVER (PARTITION BY ca.spending_category ORDER BY ca.weighted_score DESC) as category_rank
    FROM complex_analysis ca
    WHERE ca.prev_user_spend IS NOT NULL OR ca.next_product_popularity IS NOT NULL
)

-- 最终查询结果
SELECT 
    fa.user_id,
    fa.username,
    fa.product_name,
    fa.product_rank,
    fa.spending_category,
    fa.total_orders,
    fa.total_spent,
    fa.avg_order_value,
    fa.product_popularity,
    fa.weighted_score,
    fa.affinity_level,
    fa.overall_rank,
    fa.category_rank,
    CASE 
        WHEN fa.overall_rank <= 10 THEN 'top_10'
        WHEN fa.overall_rank <= 50 THEN 'top_50'
        ELSE 'other'
    END as ranking_group,
    (fa.total_spent / NULLIF(fa.total_orders, 0)) as spend_per_order
FROM final_analysis fa
WHERE fa.overall_rank <= 100  -- 限制结果数量
ORDER BY 
    fa.overall_rank ASC,
    fa.weighted_score DESC,
    fa.total_spent DESC
LIMIT 200;
