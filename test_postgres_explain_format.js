// 测试PostgreSQL EXPLAIN命令的实际返回格式
// 基于pg模块的实际行为

// 模拟PostgreSQL EXPLAIN (FORMAT JSON)命令的实际返回格式
function simulatePostgreSQLExplain() {
  console.log('模拟PostgreSQL EXPLAIN (FORMAT JSON)命令的实际返回格式:\n');
  
  // PostgreSQL EXPLAIN (FORMAT JSON)的实际返回格式
  // 根据pg模块的文档，返回的是一个包含rows数组的对象
  // rows数组中的每个元素是一个包含'QUERY PLAN'字段的对象
  // 'QUERY PLAN'字段的值是一个JSON字符串
  
  const postgresExplainResult = {
    rows: [
      {
        'QUERY PLAN': '[{"Plan": {"Node Type": "Result", "Plan Rows": 1, "Plan Width": 4, "Actual Startup Time": 0.001, "Actual Total Time": 0.002, "Actual Rows": 1, "Actual Loops": 1}}]'
      }
    ],
    fields: [
      {
        name: 'QUERY PLAN',
        tableID: 0,
        columnID: 1,
        dataTypeID: 25, // text类型
        dataTypeSize: -1,
        dataTypeModifier: -1,
        format: 'text'
      }
    ],
    rowCount: 1,
    command: 'EXPLAIN'
  };
  
  console.log('PostgreSQL实际返回格式:');
  console.log(JSON.stringify(postgresExplainResult, null, 2));
  
  // 测试当前的解析逻辑
  console.log('\n测试当前解析逻辑:');
  
  try {
    if (!postgresExplainResult.rows || postgresExplainResult.rows.length === 0 || !postgresExplainResult.rows[0]) {
      throw new Error('No execution plan data returned from EXPLAIN command');
    }
    
    const explainData = postgresExplainResult.rows[0];
    console.log('explainData:', JSON.stringify(explainData, null, 2));
    
    // 当前的解析逻辑
    const planData = explainData['QUERY PLAN'] || explainData.explain || explainData;
    console.log('planData (当前逻辑):', typeof planData, planData);
    
    if (!planData) {
      throw new Error('Could not extract execution plan from query results');
    }
    
    // 问题：planData是一个JSON字符串，不是解析后的对象
    if (typeof planData === 'string') {
      console.log('⚠️  planData是字符串，需要解析JSON');
      try {
        const parsedPlan = JSON.parse(planData);
        console.log('✅ 解析后的planData:', JSON.stringify(parsedPlan, null, 2));
      } catch (parseError) {
        console.log('❌ JSON解析失败:', parseError.message);
      }
    }
    
  } catch (error) {
    console.log('❌ 解析失败:', error.message);
  }
  
  // 测试修复后的解析逻辑
  console.log('\n测试修复后的解析逻辑:');
  
  try {
    if (!postgresExplainResult.rows || postgresExplainResult.rows.length === 0 || !postgresExplainResult.rows[0]) {
      throw new Error('No execution plan data returned from EXPLAIN command');
    }
    
    const explainData = postgresExplainResult.rows[0];
    
    // 修复后的解析逻辑
    let planData = explainData['QUERY PLAN'] || explainData['query_plan'] || explainData.explain || explainData;
    
    // 如果planData是字符串，尝试解析为JSON
    if (typeof planData === 'string') {
      try {
        planData = JSON.parse(planData);
      } catch (parseError) {
        // 如果不是有效的JSON，可能是文本格式，保持原样
        console.log('planData是文本格式，不是JSON');
      }
    }
    
    console.log('planData (修复后):', typeof planData);
    
    if (!planData) {
      throw new Error('Could not extract execution plan from query results');
    }
    
    console.log('✅ 修复后的解析成功');
    console.log('planData内容:', JSON.stringify(planData, null, 2));
    
  } catch (error) {
    console.log('❌ 修复后的解析失败:', error.message);
  }
}

// 运行测试
simulatePostgreSQLExplain();
