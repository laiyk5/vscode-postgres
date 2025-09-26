// 使用用户提供的复杂SQL测试analyzeQueryPlan功能
const { Client } = require('pg');

// 连接配置
const clientConfig = {
    host: 'localhost',
    user: 'app_user',
    password: 'Qq159753',
    port: 5432,
    database: 'app_db'
};

// 用户提供的完整复杂SQL查询
const complexSql = `WITH user_order_stats AS (
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

// 简化的SQL用于测试（如果完整版本失败）
const simplifiedSql = `WITH user_order_stats AS (
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
)
SELECT COUNT(*) as total_users_with_orders FROM user_order_stats;`;

async function testComplexSQLAnalyze() {
    console.log('=== 使用复杂SQL测试analyzeQueryPlan功能 ===');
    console.log('连接配置:', clientConfig);
    
    const client = new Client(clientConfig);
    
    try {
        await client.connect();
        console.log('✅ 成功连接到PostgreSQL数据库');
        
        // 首先检查数据库中是否存在必要的表
        console.log('\n=== 检查数据库表结构 ===');
        const tableCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('users', 'orders', 'products')
        `);
        
        console.log('存在的表:', tableCheck.rows.map(row => row.table_name));
        
        if (tableCheck.rows.length < 3) {
            console.log('⚠️  警告: 数据库中缺少必要的表，将创建测试数据');
            await createTestData(client);
        }
        
        // 测试完整复杂SQL
        console.log('\n=== 测试完整复杂SQL查询 ===');
        await testSQLWithExplain(client, complexSql, '完整复杂SQL');
        
        // 测试简化SQL
        console.log('\n=== 测试简化SQL查询 ===');
        await testSQLWithExplain(client, simplifiedSql, '简化SQL');
        
        // 测试analyzeQueryPlan功能
        console.log('\n=== 测试analyzeQueryPlan分析功能 ===');
        await testAnalyzeFunctionality(client);
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        console.error('错误堆栈:', error.stack);
        
        console.log('\n=== 故障排除建议 ===');
        console.log('1. 检查PostgreSQL服务是否正在运行');
        console.log('2. 确认连接配置正确');
        console.log('3. 检查SQL语法是否正确');
        console.log('4. 尝试简化SQL查询进行测试');
    } finally {
        await client.end();
        console.log('\n✅ 连接已关闭');
    }
}

async function testSQLWithExplain(client, sql, testName) {
    console.log(`\n--- ${testName} ---`);
    console.log('SQL长度:', sql.length, '字符');
    console.log('SQL预览:', sql.substring(0, 200) + '...');
    
    try {
        // 首先测试SQL语法是否正确
        const syntaxCheck = await client.query(`EXPLAIN ${sql}`);
        console.log('✅ SQL语法检查通过');
        
        // 测试EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
        console.log('执行EXPLAIN命令...');
        
        const explainResult = await client.query(explainSql);
        
        console.log('EXPLAIN结果分析:');
        console.log('- rowCount:', explainResult.rowCount);
        console.log('- command:', explainResult.command);
        console.log('- rows长度:', explainResult.rows ? explainResult.rows.length : 0);
        
        if (explainResult.rows && explainResult.rows.length > 0) {
            const firstRow = explainResult.rows[0];
            console.log('- 第一行键:', Object.keys(firstRow));
            
            // 分析QUERY PLAN字段
            const planData = firstRow['QUERY PLAN'] || firstRow['query_plan'] || firstRow.explain || firstRow;
            console.log('- 计划数据类型:', typeof planData);
            
            if (typeof planData === 'string') {
                try {
                    const parsedData = JSON.parse(planData);
                    console.log('✅ JSON解析成功');
                    console.log('- 解析后类型:', typeof parsedData);
                    console.log('- 解析后结构:', Array.isArray(parsedData) ? '数组' : '对象');
                    
                    // 分析执行计划
                    analyzeExecutionPlan(parsedData, sql);
                } catch (e) {
                    console.log('❌ JSON解析失败:', e.message);
                }
            } else {
                console.log('✅ 已解析的对象格式');
                analyzeExecutionPlan(planData, sql);
            }
        }
        
    } catch (error) {
        console.log(`❌ ${testName} 测试失败:`, error.message);
        
        // 如果是表不存在错误，创建测试数据
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
            console.log('尝试创建测试数据...');
            await createTestData(client);
            // 重试测试
            await testSQLWithExplain(client, sql, testName + ' (重试)');
        }
    }
}

async function testAnalyzeFunctionality(client) {
    console.log('\n--- 模拟analyzeQueryPlan功能测试 ---');
    
    // 使用简化SQL进行功能测试
    const testSql = simplifiedSql;
    const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${testSql}`;
    
    try {
        const explainResult = await client.query(explainSql);
        
        if (explainResult.rows && explainResult.rows.length > 0) {
            const firstRow = explainResult.rows[0];
            const planData = firstRow['QUERY PLAN'] || firstRow['query_plan'] || firstRow.explain || firstRow;
            
            let parsedPlan = planData;
            if (typeof planData === 'string') {
                parsedPlan = JSON.parse(planData);
            }
            
            // 模拟analyzeQueryPlan的分析功能
            const analysis = simulateAnalyzeQueryPlan(parsedPlan, testSql);
            console.log('分析结果:');
            console.log('- 效率评级:', analysis.efficiency);
            console.log('- 总结:', analysis.summary);
            console.log('- 发现问题:', analysis.issues.length, '个');
            console.log('- 优化建议:', analysis.suggestions.length, '条');
            
            if (analysis.issues.length > 0) {
                console.log('\n具体问题:');
                analysis.issues.forEach((issue, index) => {
                    console.log(`  ${index + 1}. ${issue}`);
                });
            }
            
            if (analysis.suggestions.length > 0) {
                console.log('\n优化建议:');
                analysis.suggestions.forEach((suggestion, index) => {
                    console.log(`  ${index + 1}. ${suggestion}`);
                });
            }
        }
        
    } catch (error) {
        console.log('❌ analyzeQueryPlan功能测试失败:', error.message);
    }
}

function simulateAnalyzeQueryPlan(plan, sql) {
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
    
    // 模拟分析逻辑
    const analyzeNode = (node) => {
        if (!node) return;
        
        // 提取统计信息
        if (node['Total Cost']) analysis.statistics.totalCost += parseFloat(node['Total Cost']);
        if (node['Actual Total Time']) analysis.statistics.executionTime += parseFloat(node['Actual Total Time']);
        if (node['Plan Rows']) analysis.statistics.rowsReturned += parseInt(node['Plan Rows']);
        if (node['Shared Hit Blocks']) analysis.statistics.buffersHit += parseInt(node['Shared Hit Blocks']);
        if (node['Shared Read Blocks']) analysis.statistics.buffersRead += parseInt(node['Shared Read Blocks']);
        
        // 检查性能问题
        const nodeType = node['Node Type'];
        
        if (nodeType === 'Seq Scan') {
            analysis.issues.push(`检测到顺序扫描: ${node['Relation Name'] || '未知表'}`);
            analysis.suggestions.push(`考虑为表 ${node['Relation Name']} 的WHERE条件列添加索引`);
        }
        
        if (nodeType === 'Hash Join' && parseFloat(node['Actual Total Time'] || 0) > 100) {
            analysis.issues.push('检测到慢速哈希连接');
            analysis.suggestions.push('考虑使用索引连接或减少连接数据量');
        }
        
        // 递归分析子节点
        if (node['Plans'] && Array.isArray(node['Plans'])) {
            node['Plans'].forEach(child => analyzeNode(child));
        }
    };
    
    // 开始分析
    if (plan && plan[0] && plan[0]['Plan']) {
        analyzeNode(plan[0]['Plan']);
    }
    
    // 确定效率评级
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
    
    // 添加查询类型信息
    if (sql) {
        const sqlType = sql.trim().toLowerCase().split(' ')[0];
        analysis.summary += ` (${sqlType.toUpperCase()}查询)`;
    }
    
    return analysis;
}

function analyzeExecutionPlan(plan, sql) {
    console.log('\n执行计划分析:');
    
    if (Array.isArray(plan) && plan.length > 0 && plan[0]['Plan']) {
        const rootPlan = plan[0]['Plan'];
        console.log('- 根节点类型:', rootPlan['Node Type']);
        console.log('- 总成本:', rootPlan['Total Cost']);
        console.log('- 实际执行时间:', rootPlan['Actual Total Time'], 'ms');
        console.log('- 预估行数:', rootPlan['Plan Rows']);
        
        // 检查子计划
        if (rootPlan['Plans'] && Array.isArray(rootPlan['Plans'])) {
            console.log('- 子计划数量:', rootPlan['Plans'].length);
            rootPlan['Plans'].forEach((child, index) => {
                console.log(`  ${index + 1}. ${child['Node Type']} on ${child['Relation Name'] || 'N/A'}`);
            });
        }
    }
}

async function createTestData(client) {
    console.log('\n=== 创建测试数据 ===');
    
    try {
        // 创建测试表
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50),
                email VARCHAR(100)
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                total_amount DECIMAL(10,2),
                order_date TIMESTAMP,
                status VARCHAR(20)
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                price DECIMAL(10,2),
                stock_quantity INTEGER
            )
        `);
        
        // 插入测试数据
        await client.query(`
            INSERT INTO users (username, email) VALUES 
            ('user1', 'user1@example.com'),
            ('user2', 'user2@example.com'),
            ('user3', 'user3@example.com')
            ON CONFLICT DO NOTHING
        `);
        
        await client.query(`
            INSERT INTO orders (user_id, total_amount, order_date, status) VALUES 
            (1, 100.50, '2024-01-01', 'completed'),
            (1, 200.75, '2024-01-02', 'completed'),
            (2, 150.25, '2024-01-03', 'completed'),
            (3, 300.00, '2024-01-04', 'completed')
            ON CONFLICT DO NOTHING
        `);
        
        await client.query(`
            INSERT INTO products (name, price, stock_quantity) VALUES 
            ('Product A', 50.00, 100),
            ('Product B', 75.50, 50),
            ('Product C', 120.00, 25)
            ON CONFLICT DO NOTHING
        `);
        
        console.log('✅ 测试数据创建完成');
        
    } catch (error) {
        console.log('❌ 创建测试数据失败:', error.message);
        throw error;
    }
}

// 运行测试
testComplexSQLAnalyze().catch(console.error);
