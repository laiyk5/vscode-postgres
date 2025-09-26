// 捕获实际的PostgreSQL EXPLAIN命令返回格式
const { Client } = require('pg');

async function capturePostgreSQLResponse() {
    console.log('=== 捕获PostgreSQL EXPLAIN命令返回格式 ===\n');
    
    // 请根据您的PostgreSQL连接信息修改以下配置
    const clientConfig = {
        host: 'localhost',      // 修改为您的PostgreSQL主机
        port: 5432,            // 修改为您的PostgreSQL端口
        user: 'app_user',     // 修改为您的用户名
        password: 'Qq159753',  // 修改为您的密码
        database: 'app_db'   // 修改为您的数据库名
    };
    
    const client = new Client(clientConfig);
    
    try {
        await client.connect();
        console.log('✅ 成功连接到PostgreSQL数据库');
        
        // 测试简单的SELECT查询
        const testQuery = 'SELECT 1 as test_value';
        const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${testQuery}`;
        
        console.log(`执行EXPLAIN命令: ${explainQuery}\n`);
        
        const result = await client.query(explainQuery);
        
        console.log('=== PostgreSQL返回的完整结果对象 ===');
        console.log('结果对象键:', Object.keys(result));
        console.log('');
        
        if (result.rows) {
            console.log('=== rows数组详情 ===');
            console.log('rows数组长度:', result.rows.length);
            console.log('');
            
            result.rows.forEach((row, index) => {
                console.log(`--- 第${index + 1}行数据 ---`);
                console.log('行对象键:', Object.keys(row));
                console.log('');
                
                Object.keys(row).forEach(key => {
                    const value = row[key];
                    console.log(`字段 "${key}":`);
                    console.log('  类型:', typeof value);
                    console.log('  值:', value);
                    console.log('  长度:', typeof value === 'string' ? value.length : 'N/A');
                    console.log('');
                    
                    // 如果是字符串，尝试解析JSON
                    if (typeof value === 'string') {
                        try {
                            const parsed = JSON.parse(value);
                            console.log('  ✅ JSON解析成功:');
                            console.log('    解析后类型:', typeof parsed);
                            console.log('    解析后结构:', Array.isArray(parsed) ? '数组' : '对象');
                            console.log('    解析后内容:', JSON.stringify(parsed, null, 2));
                        } catch (e) {
                            console.log('  ❌ JSON解析失败:', e.message);
                        }
                        console.log('');
                    }
                });
            });
        }
        
        if (result.fields) {
            console.log('=== fields数组详情 ===');
            console.log('fields数组长度:', result.fields.length);
            result.fields.forEach((field, index) => {
                console.log(`字段 ${index + 1}:`, field);
            });
            console.log('');
        }
        
        console.log('其他属性:');
        console.log('rowCount:', result.rowCount);
        console.log('command:', result.command);
        console.log('');
        
        // 生成可以直接在代码中使用的测试数据
        console.log('=== 可直接使用的测试数据 ===');
        console.log('const testData = ' + JSON.stringify(result, null, 2) + ';');
        
    } catch (error) {
        console.error('❌ 连接或查询失败:', error.message);
        console.log('\n请检查以下事项:');
        console.log('1. PostgreSQL服务是否正在运行');
        console.log('2. 连接配置是否正确（主机、端口、用户名、密码、数据库名）');
        console.log('3. 防火墙设置是否允许连接');
    } finally {
        await client.end();
        console.log('\n✅ 连接已关闭');
    }
}

// 运行捕获函数
capturePostgreSQLResponse().catch(console.error);
