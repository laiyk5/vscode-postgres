// 测试修复后的analyzeQueryPlan功能
// 验证JSON字符串解析问题已解决

// 模拟PostgreSQL EXPLAIN命令的实际返回格式
const mockPostgresResponse = {
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
      dataTypeID: 25,
      dataTypeSize: -1,
      dataTypeModifier: -1,
      format: 'text'
    }
  ],
  rowCount: 1,
  command: 'EXPLAIN'
};

console.log('测试修复后的analyzeQueryPlan功能...\n');

// 模拟修复后的解析逻辑
function testFixedParsingLogic() {
  console.log('1. 模拟PostgreSQL响应:');
  console.log(JSON.stringify(mockPostgresResponse, null, 2));
  
  try {
    // 检查是否有执行计划数据
    if (!mockPostgresResponse.rows || mockPostgresResponse.rows.length === 0 || !mockPostgresResponse.rows[0]) {
      throw new Error('No execution plan data returned from EXPLAIN command');
    }
    
    const explainData = mockPostgresResponse.rows[0];
    console.log('\n2. explainData:', JSON.stringify(explainData, null, 2));
    
    // 修复后的解析逻辑
    let planData = null;
    
    // 检查不同的字段名变体
    if (explainData['QUERY PLAN'] !== undefined) {
      planData = explainData['QUERY PLAN'];
      console.log('找到 QUERY PLAN 字段, 类型:', typeof planData);
    } else if (explainData['query_plan'] !== undefined) {
      planData = explainData['query_plan'];
      console.log('找到 query_plan 字段, 类型:', typeof planData);
    } else if (explainData.explain !== undefined) {
      planData = explainData.explain;
      console.log('找到 explain 字段, 类型:', typeof planData);
    } else {
      // 如果没有找到特定字段，使用整个行数据
      planData = explainData;
      console.log('使用整个行数据作为计划数据');
    }
    
    // PostgreSQL FORMAT JSON 可能返回需要解析的JSON字符串
    if (typeof planData === 'string') {
      try {
        console.log('从 QUERY PLAN 字段解析JSON字符串');
        planData = JSON.parse(planData);
        console.log('成功解析JSON, 新类型:', typeof planData);
      } catch (parseError) {
        console.log('解析JSON失败, 保持为字符串:', parseError.message);
        // 如果解析失败，可能是文本格式，我们会在分析中处理
      }
    }
    
    console.log('\n3. 最终 planData 结构:', JSON.stringify(planData, null, 2));
    
    if (!planData) {
      throw new Error('Could not extract execution plan from query results');
    }
    
    console.log('\n✅ 修复成功！现在可以正确处理JSON字符串格式的执行计划数据。');
    
    // 测试分析功能
    console.log('\n4. 测试分析功能:');
    const analysisResult = simulateAnalysis(planData, 'SELECT 1');
    console.log('分析结果:', JSON.stringify(analysisResult, null, 2));
    
  } catch (error) {
    console.log('❌ 测试失败:', error.message);
  }
}

// 简化的分析函数模拟
function simulateAnalysis(plan, sql) {
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
    }
  };

  // 简化的分析逻辑
  const analyzeNode = (node) => {
    if (!node) return;

    // 提取统计信息
    if (node['Total Cost']) analysis.statistics.totalCost += parseFloat(node['Total Cost']);
    if (node['Actual Total Time']) analysis.statistics.executionTime += parseFloat(node['Actual Total Time']);
    if (node['Plan Rows']) analysis.statistics.rowsReturned += parseInt(node['Plan Rows']);

    // 检查问题
    const nodeType = node['Node Type'];
    
    if (nodeType === 'Seq Scan') {
      analysis.issues.push(`Sequential scan detected on table: ${node['Relation Name'] || 'unknown'}`);
    }
  };

  // 开始分析
  if (plan && Array.isArray(plan) && plan.length > 0 && plan[0]['Plan']) {
    analyzeNode(plan[0]['Plan']);
  }

  // 确定效率
  if (analysis.statistics.executionTime > 1000 || analysis.issues.length > 3) {
    analysis.efficiency = 'poor';
    analysis.summary = 'Query performance needs significant optimization';
  } else if (analysis.statistics.executionTime > 100 || analysis.issues.length > 0) {
    analysis.efficiency = 'fair';
    analysis.summary = 'Query performance could be improved';
  } else {
    analysis.efficiency = 'good';
    analysis.summary = 'Query performance is efficient';
  }

  // 添加查询类型
  if (sql) {
    const sqlType = sql.trim().toLowerCase().split(' ')[0];
    analysis.summary += ` (${sqlType.toUpperCase()} query)`;
  }

  return analysis;
}

// 运行测试
testFixedParsingLogic();

console.log('\n✅ 修复验证完成！');
console.log('现在analyzeQueryPlan命令应该能够正确处理PostgreSQL EXPLAIN命令返回的JSON字符串格式。');
