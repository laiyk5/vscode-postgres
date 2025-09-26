const { Client } = require('pg');

// 用户提供的完整复杂SQL查询
const complexSQL = `WITH user_order_stats AS (
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
        COUNT(DISTINCT CAST(o.order_date AS DATE)) as unique_order_days
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
    fa.total_spent DESC;`;

// 模拟analyzeQueryPlan功能
async function analyzeQueryPlan(sql, connectionOptions) {
    let client = null;
    try {
        console.log('=== 测试analyzeQueryPlan功能 ===');
        console.log('SQL长度:', sql.length, '字符');
        console.log('SQL预览:', sql.substring(0, 200) + '...');
        
        client = new Client(connectionOptions);
        await client.connect();
        console.log('✅ 成功连接到PostgreSQL数据库');
        
        // 使用EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)获取详细执行计划
        const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
        console.log('执行EXPLAIN命令...');
        
        const res = await client.query(explainSql);
        
        console.log('EXPLAIN结果分析:');
        console.log('- rowCount:', res.rowCount);
        console.log('- command:', res.command);
        console.log('- rows长度:', res.rows ? res.rows.length : 0);
        console.log('- 第一行键:', res.rows && res.rows[0] ? Object.keys(res.rows[0]) : []);
        
        // 处理PostgreSQL EXPLAIN输出
        const explainData = res.rows[0];
        let planData = null;
        
        // 检查不同的字段名称变体
        if (explainData['QUERY PLAN'] !== undefined) {
            planData = explainData['QUERY PLAN'];
            console.log('✅ 找到QUERY PLAN字段, 类型:', typeof planData);
        } else if (explainData['query_plan'] !== undefined) {
            planData = explainData['query_plan'];
            console.log('✅ 找到query_plan字段, 类型:', typeof planData);
        } else {
            planData = explainData;
            console.log('✅ 使用整个行数据作为计划数据');
        }
        
        // PostgreSQL FORMAT JSON可能返回需要解析的JSON字符串
        if (typeof planData === 'string') {
            try {
                console.log('解析JSON字符串...');
                planData = JSON.parse(planData);
                console.log('✅ 成功解析JSON, 新类型:', typeof planData);
            } catch (parseError) {
                console.log('❌ JSON解析失败:', parseError.message);
                throw new Error('无法解析执行计划JSON数据');
            }
        }
        
        if (!planData) {
            throw new Error('无法从查询结果中提取执行计划');
        }
        
        // 分析执行计划
        const analysisResult = analyzeExecutionPlan(planData, sql);
        
        console.log('\n=== 分析结果 ===');
        console.log('- 效率评级:', analysisResult.efficiency.toUpperCase());
        console.log('- 总结:', analysisResult.summary);
        console.log('- 发现问题:', analysisResult.issues.length, '个');
        console.log('- 优化建议:', analysisResult.suggestions.length, '条');
        
        if (analysisResult.issues.length > 0) {
            console.log('\n具体问题:');
            analysisResult.issues.forEach((issue, index) => {
                console.log(`  ${index + 1}. ${issue}`);
            });
        }
        
        if (analysisResult.suggestions.length > 0) {
            console.log('\n优化建议:');
            analysisResult.suggestions.forEach((suggestion, index) => {
                console.log(`  ${index + 1}. ${suggestion}`);
            });
        }
        
        console.log('\n性能统计:');
        console.log('- 总成本:', analysisResult.statistics.totalCost.toFixed(2));
        console.log('- 执行时间:', analysisResult.statistics.executionTime.toFixed(2), 'ms');
        console.log('- 预估行数:', analysisResult.statistics.rowsReturned);
        console.log('- 缓冲区命中:', analysisResult.statistics.buffersHit);
        console.log('- 缓冲区读取:', analysisResult.statistics.buffersRead);
        
        return analysisResult;
        
    } catch (error) {
        console.error('❌ analyzeQueryPlan错误:', error.message);
        throw error;
    } finally {
        if (client) {
            await client.end();
            console.log('✅ 连接已关闭');
        }
    }
}

// 执行计划分析函数（从database.ts复制）
function analyzeExecutionPlan(plan, originalSql) {
    const analysis = {
        summary: '',
        efficiency: 'good',
        issues: [],
        suggestions: [],
        statistics: {
            totalCost: 0,
            executionTime: 0,
            rowsReturned: 0,
            buffersHit: 0,
            buffersRead: 0
        }
    };

    const analyzeNode = (node, depth = 0) => {
        if (!node) return;

        // 提取PostgreSQL JSON格式的基本统计信息
        if (node['Total Cost']) analysis.statistics.totalCost += parseFloat(node['Total Cost']);
        if (node['Actual Total Time']) analysis.statistics.executionTime += parseFloat(node['Actual Total Time']);
        if (node['Plan Rows']) analysis.statistics.rowsReturned += parseInt(node['Plan Rows']);
        if (node['Shared Hit Blocks']) analysis.statistics.buffersHit += parseInt(node['Shared Hit Blocks']);
        if (node['Shared Read Blocks']) analysis.statistics.buffersRead += parseInt(node['Shared Read Blocks']);

        // 处理不同字段名称
        if (node['total_cost']) analysis.statistics.totalCost += parseFloat(node['total_cost']);
        if (node['actual_total_time']) analysis.statistics.executionTime += parseFloat(node['actual_total_time']);
        if (node['plan_rows']) analysis.statistics.rowsReturned += parseInt(node['plan_rows']);
        if (node['shared_hit_blocks']) analysis.statistics.buffersHit += parseInt(node['shared_hit_blocks']);
        if (node['shared_read_blocks']) analysis.statistics.buffersRead += parseInt(node['shared_read_blocks']);

        // 检查常见性能问题
        const nodeType = node['Node Type'] || node['node_type'];
        
        if (nodeType === 'Seq Scan') {
            const relationName = node['Relation Name'] || node['relation_name'] || 'unknown';
            analysis.issues.push(`检测到顺序扫描: ${relationName}`);
            analysis.suggestions.push(`考虑为表 ${relationName} 的WHERE条件列添加索引`);
        }

        // 递归分析子节点
        const childPlans = node['Plans'] || node['plans'];
        if (childPlans && Array.isArray(childPlans)) {
            childPlans.forEach((child) => analyzeNode(child, depth + 1));
        }
    };

    // 处理不同的PostgreSQL EXPLAIN输出格式
    let rootPlan = null;
    
    if (plan && Array.isArray(plan) && plan.length > 0) {
        rootPlan = plan[0];
    } else if (plan && plan['Plan']) {
        rootPlan = plan;
    } else if (plan) {
        rootPlan = plan;
    }

    // 从根节点开始分析
    if (rootPlan) {
        if (rootPlan['Plan']) {
            analyzeNode(rootPlan['Plan']);
        } else {
            analyzeNode(rootPlan);
        }
    }

    // 根据实际统计确定整体效率
    if (analysis.statistics.executionTime > 1000 || analysis.issues.length > 3) {
        analysis.efficiency = 'poor';
        analysis.summary = '查询性能需要显著优化';
    } else if (analysis.statistics.executionTime > 100 || analysis.issues.length > 0) {
        analysis.efficiency = 'fair';
        analysis.summary = '查询性能可以改进';
    } else {
        analysis.efficiency = 'good';
        analysis.summary = '查询性能高效';
    }

    // 添加查询特定信息到总结
    if (originalSql) {
        const sqlType = originalSql.trim().toLowerCase().split(' ')[0];
        analysis.summary += ` (${sqlType.toUpperCase()}查询)`;
    }

    return analysis;
}

// 数据库连接配置
const connectionOptions = {
    host: 'localhost',
    user: 'app_user',
    password: 'Qq159753',
    port: 5432,
    database: 'app_db'
};

// 运行测试
async function runTest() {
    try {
        console.log('=== 最终验证测试: analyzeQueryPlan功能 ===');
        console.log('连接配置:', connectionOptions);
        
        // 测试完整复杂SQL
        await analyzeQueryPlan(complexSQL, connectionOptions);
        
        console.log('\n✅ analyzeQueryPlan功能测试完成！');
        console.log('功能能够正确处理复杂的SQL查询，包括：');
        console.log('- CTE (WITH查询)');
        console.log('- 窗口函数 (ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD)');
        console.log('- CROSS JOIN');
        console.log('- 多层嵌套查询');
        console.log('- 复杂聚合和条件逻辑');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        process.exit(1);
    }
}

runTest();
