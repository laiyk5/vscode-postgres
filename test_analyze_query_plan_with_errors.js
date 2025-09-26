// 测试analyzeQueryPlan功能的错误处理和边界情况
const { Client } = require('pg');

// 连接配置
const clientConfig = {
    host: 'localhost',
    user: 'app_user',
    password: 'Qq159753',
    port: 5432,
    database: 'app_db'
};

// 测试用例：各种SQL查询
const testCases = [
    {
        name: '完整复杂SQL',
        sql: `WITH user_order_stats AS (
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
SELECT COUNT(*) as total_users_with_orders FROM user_order_stats;`,
        description: '完整的复杂SQL查询'
    },
    {
        name: '语法错误SQL',
        sql: 'SELECT * FROM non_existent_table WHERE invalid_column = 1',
        description: '包含语法错误的SQL'
    },
    {
        name: '空查询',
        sql: '',
        description: '空字符串查询'
    },
    {
        name: '简单SELECT',
        sql: 'SELECT * FROM users LIMIT 10',
        description: '简单SELECT查询'
    },
    {
        name: '复杂JOIN',
        sql: `SELECT u.username, o.total_amount 
              FROM users u 
              JOIN orders o ON u.id = o.user_id 
              WHERE o.status = 'completed' 
              ORDER BY o.total_amount DESC 
              LIMIT 5`,
        description: '复杂JOIN查询'
    }
];

async function testAnalyzeQueryPlanWithErrors() {
    console.log('=== 测试analyzeQueryPlan功能的错误处理和边界情况 ===');
    
    const client = new Client(clientConfig);
    
    try {
        await client.connect();
        console.log('✅ 成功连接到PostgreSQL数据库\n');
        
        for (const testCase of testCases) {
            console.log(`--- 测试用例: ${testCase.name} ---`);
            console.log(`描述: ${testCase.description}`);
            console.log(`SQL长度: ${testCase.sql.length} 字符`);
            
            if (testCase.sql.length > 200) {
                console.log(`SQL预览: ${testCase.sql.substring(0, 200)}...`);
            } else {
                console.log(`SQL: ${testCase.sql}`);
            }
            
            await testSingleQuery(client, testCase.sql, testCase.name);
            console.log('\n' + '='.repeat(50) + '\n');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    } finally {
        await client.end();
        console.log('✅ 连接已关闭');
    }
}

async function testSingleQuery(client, sql, testName) {
    try {
        // 测试SQL语法
        if (sql.trim() === '') {
            console.log('❌ 空查询 - 跳过测试');
            return;
        }
        
        // 测试EXPLAIN语法检查
        try {
            await client.query(`EXPLAIN ${sql}`);
            console.log('✅ SQL语法检查通过');
        } catch (syntaxError) {
            console.log('❌ SQL语法错误:', syntaxError.message);
            return;
        }
        
        // 测试EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
        console.log('执行EXPLAIN命令...');
        
        const explainResult = await client.query(explainSql);
        
        // 分析结果
        console.log('EXPLAIN结果:');
        console.log('- rowCount:', explainResult.rowCount);
        console.log('- command:', explainResult.command);
        console.log('- rows长度:', explainResult.rows ? explainResult.rows.length : 0);
        
        if (explainResult.rows && explainResult.rows.length > 0) {
            const firstRow = explainResult.rows[0];
            console.log('- 第一行键:', Object.keys(firstRow));
            
            // 处理QUERY PLAN字段
            const planData = firstRow['QUERY PLAN'] || firstRow['query_plan'] || firstRow.explain || firstRow;
            console.log('- 计划数据类型:', typeof planData);
            
            let parsedPlan = planData;
            if (typeof planData === 'string') {
                try {
                    parsedPlan = JSON.parse(planData);
                    console.log('✅ JSON解析成功');
                } catch (parseError) {
                    console.log('❌ JSON解析失败:', parseError.message);
                    return;
                }
            } else {
                console.log('✅ 已解析的对象格式');
            }
            
            // 模拟analyzeQueryPlan分析
            const analysis = simulateAnalyzeQueryPlan(parsedPlan, sql);
            displayAnalysisResults(analysis);
            
        } else {
            console.log('❌ EXPLAIN命令没有返回数据');
        }
        
    } catch (error) {
        console.log(`❌ ${testName} 测试失败:`, error.message);
        
        // 特殊错误处理
        if (error.message.includes('canceling statement due to statement timeout')) {
            console.log('⚠️  查询超时 - 可能需要优化或增加超时时间');
        } else if (error.message.includes('out of memory')) {
            console.log('⚠️  内存不足 - 查询可能过于复杂');
        } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
            console.log('⚠️  表不存在 - 检查数据库表结构');
        }
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
        },
        warnings: []
    };
    
    // 检查计划数据有效性
    if (!plan) {
        analysis.warnings.push('执行计划数据为空');
        analysis.efficiency = 'unknown';
        analysis.summary = '无法分析执行计划';
        return analysis;
    }
    
    // 递归分析节点
    const analyzeNode = (node, depth = 0) => {
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
            const relationName = node['Relation Name'] || '未知表';
            analysis.issues.push(`顺序扫描: ${relationName}`);
            analysis.suggestions.push(`为表 ${relationName} 添加索引`);
        }
        
        if (nodeType === 'Hash Join' && parseFloat(node['Actual Total Time'] || 0) > 100) {
            analysis.issues.push('慢速哈希连接');
            analysis.suggestions.push('考虑使用索引连接');
        }
        
        if (nodeType === 'Sort' && parseFloat(node['Sort Space Used'] || 0) > 100000) {
            analysis.issues.push('大排序操作');
            analysis.suggestions.push('添加索引避免排序');
        }
        
        // 递归分析子节点
        if (node['Plans'] && Array.isArray(node['Plans'])) {
            node['Plans'].forEach(child => analyzeNode(child, depth + 1));
        }
    };
    
    // 开始分析
    let rootPlan = null;
    if (Array.isArray(plan) && plan.length > 0) {
        rootPlan = plan[0];
    } else {
        rootPlan = plan;
    }
    
    if (rootPlan && rootPlan['Plan']) {
        analyzeNode(rootPlan['Plan']);
    } else if (rootPlan) {
        analyzeNode(rootPlan);
    } else {
        analysis.warnings.push('无法找到有效的执行计划根节点');
    }
    
    // 确定效率评级
    if (analysis.statistics.executionTime > 10000 || analysis.issues.length > 5) {
        analysis.efficiency = 'poor';
        analysis.summary = '查询性能需要显著优化';
    } else if (analysis.statistics.executionTime > 1000 || analysis.issues.length > 2) {
        analysis.efficiency = 'fair';
        analysis.summary = '查询性能可以改进';
    } else if (analysis.statistics.executionTime > 0) {
        analysis.efficiency = 'good';
        analysis.summary = '查询性能高效';
    } else {
        analysis.efficiency = 'unknown';
        analysis.summary = '无法确定查询性能';
    }
    
    // 添加查询类型信息
    if (sql) {
        const sqlType = sql.trim().toLowerCase().split(' ')[0];
        analysis.summary += ` (${sqlType.toUpperCase()}查询)`;
    }
    
    return analysis;
}

function displayAnalysisResults(analysis) {
    console.log('\n分析结果:');
    console.log('- 效率评级:', analysis.efficiency.toUpperCase());
    console.log('- 总结:', analysis.summary);
    
    console.log('\n性能统计:');
    console.log('- 总成本:', analysis.statistics.totalCost.toFixed(2));
    console.log('- 执行时间:', analysis.statistics.executionTime.toFixed(2), 'ms');
    console.log('- 预估行数:', analysis.statistics.rowsReturned);
    console.log('- 缓冲区命中:', analysis.statistics.buffersHit);
    console.log('- 缓冲区读取:', analysis.statistics.buffersRead);
    
    if (analysis.warnings.length > 0) {
        console.log('\n警告:');
        analysis.warnings.forEach((warning, index) => {
            console.log(`  ${index + 1}. ${warning}`);
        });
    }
    
    if (analysis.issues.length > 0) {
        console.log('\n发现问题:', analysis.issues.length, '个');
        analysis.issues.forEach((issue, index) => {
            console.log(`  ${index + 1}. ${issue}`);
        });
    }
    
    if (analysis.suggestions.length > 0) {
        console.log('\n优化建议:', analysis.suggestions.length, '条');
        analysis.suggestions.forEach((suggestion, index) => {
            console.log(`  ${index + 1}. ${suggestion}`);
        });
    }
}

// 运行测试
testAnalyzeQueryPlanWithErrors().catch(console.error);
