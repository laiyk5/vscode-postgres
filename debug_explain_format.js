// 调试PostgreSQL EXPLAIN命令返回格式的测试脚本
const { PgClient } = require('./out/common/connection');

async function debugExplainFormat() {
  try {
    // 使用一个简单的测试连接配置
    const connectionOptions = {
      host: 'localhost',
      user: 'postgres',
      password: 'password',
      database: 'postgres',
      port: 5432
    };

    console.log('Connecting to PostgreSQL...');
    const client = new PgClient(connectionOptions);
    await client.connect();
    
    console.log('Connected successfully');
    
    // 测试简单的SELECT查询
    const testSql = 'SELECT 1 as test';
    
    // 测试不同的EXPLAIN格式
    console.log('\n1. Testing EXPLAIN (FORMAT JSON):');
    try {
      const explainJson = await client.query(`EXPLAIN (FORMAT JSON) ${testSql}`);
      console.log('EXPLAIN (FORMAT JSON) result:', JSON.stringify(explainJson, null, 2));
    } catch (err) {
      console.log('EXPLAIN (FORMAT JSON) error:', err.message);
    }
    
    console.log('\n2. Testing EXPLAIN (ANALYZE, FORMAT JSON):');
    try {
      const explainAnalyzeJson = await client.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${testSql}`);
      console.log('EXPLAIN (ANALYZE, FORMAT JSON) result:', JSON.stringify(explainAnalyzeJson, null, 2));
    } catch (err) {
      console.log('EXPLAIN (ANALYZE, FORMAT JSON) error:', err.message);
    }
    
    console.log('\n3. Testing EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON):');
    try {
      const explainFull = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${testSql}`);
      console.log('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) result:', JSON.stringify(explainFull, null, 2));
    } catch (err) {
      console.log('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) error:', err.message);
    }
    
    console.log('\n4. Testing plain EXPLAIN (no format):');
    try {
      const explainPlain = await client.query(`EXPLAIN ${testSql}`);
      console.log('EXPLAIN result:', JSON.stringify(explainPlain, null, 2));
    } catch (err) {
      console.log('EXPLAIN error:', err.message);
    }
    
    await client.end();
    console.log('\nDebug completed');
    
  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugExplainFormat().catch(console.error);
