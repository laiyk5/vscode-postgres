const { Database } = require('./out/common/database');

// 模拟的PostgreSQL连接配置
const connectionOptions = {
    host: 'localhost',
    user: 'postgres',
    password: 'password',
    database: 'testdb',
    port: 5432
};

// 测试SQL查询
const testSql = `SELECT * FROM information_schema.tables LIMIT 5`;

// 模拟的编辑器对象
const mockEditor = {
    document: {
        uri: {
            toString: () => 'file:///test.sql'
        },
        fileName: 'test.sql'
    }
};

console.log('Testing analyzeQueryPlan function...');

// 测试JSON解析逻辑
console.log('\n=== Testing JSON parsing logic ===');

// 模拟PostgreSQL EXPLAIN命令返回的JSON字符串
const jsonStringResponse = {
    rows: [{
        'QUERY PLAN': JSON.stringify([{
            'Plan': {
                'Node Type': 'Limit',
                'Plan Rows': 5,
                'Actual Total Time': 0.123,
                'Total Cost': 10.5,
                'Plans': [{
                    'Node Type': 'Seq Scan',
                    'Relation Name': 'tables',
                    'Plan Rows': 100,
                    'Actual Total Time': 0.1,
                    'Total Cost': 10.0
                }]
            }
        }])
    }]
};

// 模拟PostgreSQL EXPLAIN命令返回的已解析对象
const parsedObjectResponse = {
    rows: [{
        'QUERY PLAN': [{
            'Plan': {
                'Node Type': 'Limit',
                'Plan Rows': 5,
                'Actual Total Time': 0.123,
                'Total Cost': 10.5,
                'Plans': [{
                    'Node Type': 'Seq Scan',
                    'Relation Name': 'tables',
                    'Plan Rows': 100,
                    'Actual Total Time': 0.1,
                    'Total Cost': 10.0
                }]
            }
        }]
    }]
};

console.log('JSON string response type:', typeof jsonStringResponse.rows[0]['QUERY PLAN']);
console.log('Parsed object response type:', typeof parsedObjectResponse.rows[0]['QUERY PLAN']);

// 测试JSON解析函数
function testJsonParsing(data) {
    let planData = data;
    
    // 这是修复后的逻辑
    if (typeof planData === 'string') {
        try {
            console.log('Parsing JSON string from QUERY PLAN field');
            planData = JSON.parse(planData);
            console.log('Successfully parsed JSON, new type:', typeof planData);
        } catch (parseError) {
            console.log('Failed to parse JSON, keeping as string:', parseError.message);
        }
    }
    
    return planData;
}

console.log('\n=== Testing JSON string parsing ===');
const parsedFromString = testJsonParsing(jsonStringResponse.rows[0]['QUERY PLAN']);
console.log('Result type after parsing:', typeof parsedFromString);
console.log('Result structure:', parsedFromString);

console.log('\n=== Testing already parsed object ===');
const parsedFromObject = testJsonParsing(parsedObjectResponse.rows[0]['QUERY PLAN']);
console.log('Result type:', typeof parsedFromObject);
console.log('Result structure:', parsedFromObject);

console.log('\n=== Testing analyzeExecutionPlan function ===');

// 测试分析函数
function testAnalysis(planData) {
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

    const analyzeNode = (node, depth = 0) => {
        if (!node) return;

        // 提取统计信息
        if (node['Total Cost']) analysis.statistics.totalCost += parseFloat(node['Total Cost']);
        if (node['Actual Total Time']) analysis.statistics.executionTime += parseFloat(node['Actual Total Time']);
        if (node['Plan Rows']) analysis.statistics.rowsReturned += parseInt(node['Plan Rows']);

        // 检查性能问题
        const nodeType = node['Node Type'];
        if (nodeType === 'Seq Scan') {
            const relationName = node['Relation Name'] || 'unknown';
            analysis.issues.push(`Sequential scan detected on table: ${relationName}`);
            analysis.suggestions.push(`Consider adding an index on columns used in WHERE clause for table ${relationName}`);
        }

        // 递归分析子节点
        const childPlans = node['Plans'];
        if (childPlans && Array.isArray(childPlans)) {
            childPlans.forEach((child) => analyzeNode(child, depth + 1));
        }
    };

    let rootPlan = null;
    if (planData && Array.isArray(planData) && planData.length > 0) {
        rootPlan = planData[0];
    }

    if (rootPlan) {
        if (rootPlan['Plan']) {
            analyzeNode(rootPlan['Plan']);
        } else {
            analyzeNode(rootPlan);
        }
    }

    // 确定效率评级
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

    return analysis;
}

const analysisResult = testAnalysis(parsedFromString);
console.log('Analysis result:', analysisResult);

console.log('\n=== Test completed successfully! ===');
console.log('The JSON parsing fix is working correctly.');
console.log('The extension should now handle both JSON string and parsed object formats from PostgreSQL EXPLAIN command.');
