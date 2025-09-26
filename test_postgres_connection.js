// 直接测试PostgreSQL连接和EXPLAIN命令返回格式
const { Client } = require('pg');

// 使用capture_postgres_response.js中的真实连接配置
const clientConfig = {
    host: 'localhost',
    user: 'app_user',
    password: 'Qq159753',
    port: 5432,
    database: 'app_db'
};

// 用户提供的复杂查询
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

async function testPostgreSQLConnection() {
    console.log('=== 测试PostgreSQL连接和EXPLAIN命令 ===');
    console.log('连接配置:', clientConfig);
    
    const client = new Client(clientConfig);
    
    try {
        await client.connect();
        console.log('✅ 成功连接到PostgreSQL数据库');
        
        // 测试简单查询
        const simpleResult = await client.query('SELECT 1 as test_value');
        console.log('✅ 简单查询测试通过');
        
        // 测试EXPLAIN命令
        console.log('\n=== 测试EXPLAIN命令 ===');
        const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${testSql}`;
        console.log('EXPLAIN SQL:', explainSql.substring(0, 200) + '...');
        
        const explainResult = await client.query(explainSql);
        
        console.log('\n=== EXPLAIN命令返回结果分析 ===');
        console.log('rowCount:', explainResult.rowCount);
        console.log('command:', explainResult.command);
        console.log('rows数组长度:', explainResult.rows ? explainResult.rows.length : 0);
        
        if (explainResult.rows && explainResult.rows.length > 0) {
            const firstRow = explainResult.rows[0];
            console.log('第一行数据的键:', Object.keys(firstRow));
            
            Object.keys(firstRow).forEach(key => {
                const value = firstRow[key];
                console.log(`\n字段 "${key}":`);
                console.log('  类型:', typeof value);
                console.log('  值长度:', typeof value === 'string' ? value.length : 'N/A');
                
                // 如果是字符串，尝试解析JSON
                if (typeof value === 'string') {
                    try {
                        const parsed = JSON.parse(value);
                        console.log('  ✅ JSON解析成功!');
                        console.log('    解析后类型:', typeof parsed);
                        console.log('    解析后结构:', Array.isArray(parsed) ? '数组' : '对象');
                    } catch (e) {
                        console.log('  ❌ JSON解析失败:', e.message);
                    }
                }
            });
            
            console.log('\n=== 修复验证结果 ===');
            const planData = firstRow['QUERY PLAN'] || firstRow['query_plan'] || firstRow.explain || firstRow;
            
            if (typeof planData === 'string') {
                console.log('✅ 检测到JSON字符串格式 - 需要解析');
                try {
                    const parsedData = JSON.parse(planData);
                    console.log('✅ JSON解析成功 - 修复逻辑正常工作');
                    console.log('解析后数据结构:', Array.isArray(parsedData) ? '数组' : '对象');
                } catch (e) {
                    console.log('❌ JSON解析失败 - 需要检查修复代码');
                }
            } else {
                console.log('✅ 检测到已解析的对象格式 - 无需额外解析');
            }
        } else {
            console.log('❌ EXPLAIN命令没有返回任何数据行');
            console.log('可能的原因:');
            console.log('1. 查询语法错误');
            console.log('2. 数据库中不存在users/orders表');
            console.log('3. PostgreSQL版本不支持某些功能');
        }
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        console.error('错误堆栈:', error.stack);
        
        console.log('\n=== 故障排除建议 ===');
        console.log('1. 检查PostgreSQL服务是否正在运行');
        console.log('2. 确认数据库中存在必要的表（users, orders等）');
        console.log('3. 检查连接配置是否正确');
        console.log('4. 尝试简化SQL查询进行测试');
    } finally {
        await client.end();
        console.log('\n✅ 连接已关闭');
    }
}

// 运行测试
testPostgreSQLConnection().catch(console.error);
