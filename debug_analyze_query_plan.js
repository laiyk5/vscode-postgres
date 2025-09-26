const { Database } = require('./out/common/database');
const vscode = require('vscode');

// 模拟编辑器对象
const mockEditor = {
    document: {
        uri: {
            toString: () => 'file:///test.sql'
        },
        fileName: 'test.sql'
    }
};

// 模拟连接配置
const connectionOptions = {
    label: 'test',
    host: 'localhost',
    user: 'postgres',
    password: 'password',
    port: 5432,
    database: 'testdb'
};

// 测试SQL - 用户提供的复杂查询
const testSql = `WITH user_order_stats AS (
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

async function testAnalyzeQueryPlan() {
    console.log('开始测试 analyzeQueryPlan 功能...');
    console.log('测试SQL:', testSql);
    
    try {
        await Database.analyzeQueryPlan(testSql, mockEditor, connectionOptions);
        console.log('✅ analyzeQueryPlan 测试成功！');
    } catch (error) {
        console.error('❌ analyzeQueryPlan 测试失败:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

// 运行测试
testAnalyzeQueryPlan().catch(console.error);
