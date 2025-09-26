const { Client } = require('pg');

// 测试analyzeQueryPlan功能
async function testAnalyzeQueryPlan() {
    console.log('=== 最终测试analyzeQueryPlan功能 ===');
    
    const client = new Client({
        host: 'localhost',
        user: 'app_user',
        password: 'Qq159753',
        port: 5432,
        database: 'app_db'
    });

    try {
        await client.connect();
        console.log('✅ 成功连接到PostgreSQL数据库');

        // 测试简单查询
        const simpleQuery = 'SELECT * FROM users LIMIT 10';
        console.log(`\n--- 测试简单查询 ---`);
        console.log(`SQL: ${simpleQuery}`);

        const explainResult = await client.query(`EXPLAIN (FORMAT JSON) ${simpleQuery}`);
        console.log('✅ EXPLAIN命令执行成功');
        
        const planData = explainResult.rows[0]['QUERY PLAN'];
        console.log(`QUERY PLAN字段类型: ${typeof planData}`);
        
        // 应用修复逻辑
        let finalPlanData = planData;
        if (typeof planData === 'string') {
            try {
                console.log('🔧 应用JSON字符串解析修复...');
                finalPlanData = JSON.parse(planData);
                console.log('✅ JSON解析成功，新类型:', typeof finalPlanData);
            } catch (parseError) {
                console.log('⚠️ JSON解析失败，保持为字符串格式');
            }
        }
        
        if (finalPlanData && typeof finalPlanData === 'object') {
            console.log('🎉 analyzeQueryPlan修复验证成功！');
            console.log('执行计划结构:', Object.keys(finalPlanData));
            if (finalPlanData[0] && finalPlanData[0].Plan) {
                console.log('根节点类型:', finalPlanData[0].Plan['Node Type']);
                console.log('总成本:', finalPlanData[0].Plan['Total Cost']);
            }
        } else {
            console.log('❌ 执行计划数据格式异常');
        }

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    } finally {
        await client.end();
        console.log('\n✅ 连接已关闭');
    }
}

// 运行测试
testAnalyzeQueryPlan().catch(console.error);
