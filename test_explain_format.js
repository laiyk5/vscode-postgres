// 测试PostgreSQL EXPLAIN命令返回格式的简化脚本
// 模拟analyzeQueryPlan方法的行为

// 模拟PostgreSQL EXPLAIN命令的返回数据格式
function simulateExplainResults() {
  console.log('模拟PostgreSQL EXPLAIN命令的不同返回格式:\n');
  
  // 格式1: 标准的EXPLAIN (FORMAT JSON)返回格式
  console.log('1. 标准EXPLAIN (FORMAT JSON)格式:');
  const standardFormat = {
    rows: [
      {
        'QUERY PLAN': [
          {
            'Plan': {
              'Node Type': 'Result',
              'Plan Rows': 1,
              'Plan Width': 4,
              'Actual Startup Time': 0.001,
              'Actual Total Time': 0.002,
              'Actual Rows': 1,
              'Actual Loops': 1
            }
          }
        ]
      }
    ]
  };
  console.log(JSON.stringify(standardFormat, null, 2));
  
  // 格式2: 可能的不同字段名格式
  console.log('\n2. 可能的字段名变体:');
  const variantFormat = {
    rows: [
      {
        'query_plan': [
          {
            'plan': {
              'node_type': 'Result',
              'plan_rows': 1,
              'plan_width': 4,
              'actual_startup_time': 0.001,
              'actual_total_time': 0.002,
              'actual_rows': 1,
              'actual_loops': 1
            }
          }
        ]
      }
    ]
  };
  console.log(JSON.stringify(variantFormat, null, 2));
  
  // 格式3: 直接JSON格式（没有QUERY PLAN包装）
  console.log('\n3. 直接JSON格式:');
  const directFormat = {
    rows: [
      [
        {
          'Plan': {
            'Node Type': 'Result',
            'Plan Rows': 1,
            'Plan Width': 4
          }
        }
      ]
    ]
  };
  console.log(JSON.stringify(directFormat, null, 2));
  
  // 格式4: 文本格式（非JSON）
  console.log('\n4. 文本格式（非JSON）:');
  const textFormat = {
    rows: [
      {
        'QUERY PLAN': 'Result  (cost=0.00..0.01 rows=1 width=4)'
      }
    ]
  };
  console.log(JSON.stringify(textFormat, null, 2));
  
  // 测试analyzeQueryPlan方法中的解析逻辑
  console.log('\n5. 测试解析逻辑:');
  
  const testCases = [standardFormat, variantFormat, directFormat, textFormat];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n测试用例 ${index + 1}:`);
    
    try {
      // 模拟analyzeQueryPlan方法中的解析逻辑
      if (!testCase.rows || testCase.rows.length === 0 || !testCase.rows[0]) {
        throw new Error('No execution plan data returned from EXPLAIN command');
      }
      
      const explainData = testCase.rows[0];
      console.log('explainData:', JSON.stringify(explainData, null, 2));
      
      // 尝试不同的字段名
      const planData = explainData['QUERY PLAN'] || explainData['query_plan'] || explainData.explain || explainData;
      console.log('planData:', JSON.stringify(planData, null, 2));
      
      if (!planData) {
        throw new Error('Could not extract execution plan from query results');
      }
      
      console.log('✅ 解析成功');
      
    } catch (error) {
      console.log('❌ 解析失败:', error.message);
    }
  });
}

// 运行测试
simulateExplainResults();
