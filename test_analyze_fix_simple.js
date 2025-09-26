// 简化的analyzeQueryPlan功能测试
const fs = require('fs');
const path = require('path');

// 模拟analyzeExecutionPlan方法的核心逻辑
function analyzeExecutionPlan(explainData) {
    console.log('=== 测试analyzeExecutionPlan方法 ===');
    console.log('输入数据:', JSON.stringify(explainData, null, 2));
    
    // 修复后的解析逻辑
    let planData = explainData['QUERY PLAN'] || explainData['query_plan'] || explainData.explain || explainData;
    
    console.log('planData类型:', typeof planData);
    console.log('planData内容:', planData);
    
    // Handle the case where planData is a JSON string (PostgreSQL's default behavior)
    if (typeof planData === 'string') {
        try {
            planData = JSON.parse(planData);
            console.log('✅ JSON字符串解析成功');
        } catch (parseError) {
            console.log('❌ JSON解析失败:', parseError.message);
            return {
                error: 'Failed to parse execution plan data',
                details: parseError.message
            };
        }
    }
    
    console.log('解析后的planData类型:', typeof planData);
    console.log('解析后的planData:', JSON.stringify(planData, null, 2));
    
    // 模拟分析逻辑
    if (planData && Array.isArray(planData) && planData.length > 0) {
        const firstPlan = planData[0];
        if (firstPlan.Plan) {
            return {
                summary: `Query executed with ${firstPlan.Plan['Node Type']} operation`,
                efficiency: "good",
                issues: [],
                suggestions: [],
                statistics: {
                    totalCost: 0,
                    executionTime: 0.002,
                    rowsReturned: 1,
                    buffersHit: 0,
                    buffersRead: 0
                }
            };
        }
    }
    
    return {
        error: 'No valid execution plan data found'
    };
}

// 测试用例1: 模拟PostgreSQL返回的JSON字符串格式
console.log('=== 测试用例1: JSON字符串格式 ===');
const testData1 = {
    "rows": [
        {
            "QUERY PLAN": "[{\"Plan\": {\"Node Type\": \"Seq Scan\", \"Plan Rows\": 1000, \"Plan Width\": 4, \"Actual Startup Time\": 0.001, \"Actual Total Time\": 0.005, \"Actual Rows\": 1000, \"Actual Loops\": 1}}]"
        }
    ]
};

const result1 = analyzeExecutionPlan(testData1.rows[0]);
console.log('结果1:', JSON.stringify(result1, null, 2));

// 测试用例2: 模拟不同的字段名格式
console.log('\n=== 测试用例2: 不同字段名格式 ===');
const testData2 = {
    "query_plan": "[{\"Plan\": {\"Node Type\": \"Index Scan\", \"Plan Rows\": 10, \"Plan Width\": 8}}]"
};

const result2 = analyzeExecutionPlan(testData2);
console.log('结果2:', JSON.stringify(result2, null, 2));

// 测试用例3: 无效数据
console.log('\n=== 测试用例3: 无效数据 ===');
const testData3 = {
    "QUERY PLAN": "invalid json string"
};

const result3 = analyzeExecutionPlan(testData3);
console.log('结果3:', JSON.stringify(result3, null, 2));

console.log('\n=== 测试完成 ===');
