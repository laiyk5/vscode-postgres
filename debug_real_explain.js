// 调试PostgreSQL EXPLAIN命令的真实返回格式
const { PgClient } = require('./out/common/connection');

async function debugRealExplain() {
  console.log('调试PostgreSQL EXPLAIN命令的真实返回格式...\n');
  
  try {
    // 创建一个简单的测试连接配置
    const connectionOptions = {
      host: 'localhost',
      user: 'postgres',
      password: 'password',
      database: 'postgres',
      port: 5432
    };
    
    console.log('连接配置:', connectionOptions);
    
    // 创建一个简单的测试SQL
    const testSql = 'SELECT 1';
    const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${testSql}`;
    
    console.log('测试SQL:', testSql);
    console.log('EXPLAIN SQL:', explainSql);
    
    // 尝试连接并执行EXPLAIN命令
    const client = new PgClient(connectionOptions);
    await client.connect();
    
    console.log('连接成功，执行EXPLAIN命令...');
    
    const result = await client.query(explainSql);
    
    console.log('EXPLAIN命令执行结果:');
    console.log('结果类型:', typeof result);
    console.log('完整结果:', JSON.stringify(result, null, 2));
    
    if (result && result.rows) {
      console.log('\nrows数组长度:', result.rows.length);
      
      if (result.rows.length > 0) {
        console.log('第一个row:', JSON.stringify(result.rows[0], null, 2));
        
        const firstRow = result.rows[0];
        console.log('第一个row的键:', Object.keys(firstRow));
        
        // 检查不同的可能字段名
        if (firstRow['QUERY PLAN']) {
          console.log('找到 QUERY PLAN 字段:', typeof firstRow['QUERY PLAN']);
        }
        if (firstRow['query_plan']) {
          console.log('找到 query_plan 字段:', typeof firstRow['query_plan']);
        }
        if (firstRow.explain) {
          console.log('找到 explain 字段:', typeof firstRow.explain);
        }
      }
    }
    
    await client.end();
    
  } catch (error) {
    console.error('调试过程中出错:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行调试
debugRealExplain().catch(console.error);
