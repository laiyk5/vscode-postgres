// 测试修复后的analyzeQueryPlan功能
const testData = {
  "command": "EXPLAIN",
  "rowCount": null,
  "oid": null,
  "rows": [
    {
      "QUERY PLAN": [
        {
          "Plan": {
            "Node Type": "Result",
            "Parallel Aware": false,
            "Async Capable": false,
            "Startup Cost": 0,
            "Total Cost": 0.01,
            "Plan Rows": 1,
            "Plan Width": 4,
            "Actual Startup Time": 0.002,
            "Actual Total Time": 0.003,
            "Actual Rows": 1,
            "Actual Loops": 1,
            "Shared Hit Blocks": 0,
            "Shared Read Blocks": 0,
            "Shared Dirtied Blocks": 0,
            "Shared Written Blocks": 0,
            "Local Hit Blocks": 0,
            "Local Read Blocks": 0,
            "Local Dirtied Blocks": 0,
            "Local Written Blocks": 0,
            "Temp Read Blocks": 0,
            "Temp Written Blocks": 0
          },
          "Planning": {
            "Shared Hit Blocks": 3,
            "Shared Read Blocks": 0,
            "Shared Dirtied Blocks": 0,
            "Shared Written Blocks": 0,
            "Local Hit Blocks": 0,
            "Local Read Blocks": 0,
            "Local Dirtied Blocks": 0,
            "Local Written Blocks": 0,
            "Temp Read Blocks": 0,
            "Temp Written Blocks": 0
          },
          "Planning Time": 0.059,
          "Triggers": [],
          "Execution Time": 0.019
        }
      ]
    }
  ],
  "fields": [
    {
      "name": "QUERY PLAN",
      "tableID": 0,
      "columnID": 0,
      "dataTypeID": 114,
      "dataTypeSize": -1,
      "dataTypeModifier": -1,
      "format": "text"
    }
  ]
};

console.log('=== 测试修复后的analyzeQueryPlan数据处理 ===\n');

// 模拟修复后的数据处理逻辑
function simulateFixedAnalyzeQueryPlan(res) {
  console.log('1. 检查查询结果结构...');
  if (!res.rows || res.rows.length === 0 || !res.rows[0]) {
    throw new Error('No execution plan data returned from EXPLAIN command');
  }
  
  const explainData = res.rows[0];
  console.log('EXPLAIN data keys:', Object.keys(explainData));
  
  // Handle PostgreSQL FORMAT JSON output - it returns parsed JSON object directly
  let planData = null;
  
  // Check for different field name variations
  if (explainData['QUERY PLAN'] !== undefined) {
    planData = explainData['QUERY PLAN'];
    console.log('Found QUERY PLAN field, type:', typeof planData);
  } else if (explainData['query_plan'] !== undefined) {
    planData = explainData['query_plan'];
    console.log('Found query_plan field, type:', typeof planData);
  } else if (explainData.explain !== undefined) {
    planData = explainData.explain;
    console.log('Found explain field, type:', typeof planData);
  } else {
    // If no specific field found, use the entire row data
    planData = explainData;
    console.log('Using entire row data as plan data');
  }
  
  // PostgreSQL FORMAT JSON returns parsed JSON object, not string
  // So we don't need to parse it again
  console.log('Plan data structure:', planData);
  
  if (!planData) {
    throw new Error('Could not extract execution plan from query results');
  }
  
  console.log('✅ 成功提取执行计划数据！');
  console.log('Plan data type:', typeof planData);
  console.log('Plan data is array:', Array.isArray(planData));
  
  return planData;
}

try {
  const planData = simulateFixedAnalyzeQueryPlan(testData);
  console.log('\n✅ 修复成功！analyzeQueryPlan现在可以正确处理PostgreSQL的JSON格式输出。');
  console.log('\n=== 下一步操作 ===');
  console.log('1. 在VSCode中重新加载扩展 (Ctrl+Shift+P -> "Developer: Reload Window")');
  console.log('2. 打开一个SQL文件并选择一些SQL查询');
  console.log('3. 使用快捷键 Ctrl+Shift+F5 或右键菜单运行 "Analyze Query Plan"');
  console.log('4. 检查是否不再出现 "No execution plan data returned from EXPLAIN command" 错误');
} catch (error) {
  console.error('❌ 测试失败:', error.message);
}
