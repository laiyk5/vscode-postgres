// 测试analyzeQueryPlan功能的脚本
// 这个脚本模拟analyzeQueryPlan命令的执行

const vscode = require('vscode');
const path = require('path');

// 模拟analyzeQueryPlan命令的执行
async function testAnalyzeQueryPlan() {
    console.log('=== 测试analyzeQueryPlan功能 ===');
    
    // 检查快捷键配置
    console.log('1. 检查快捷键配置...');
    const keybindings = vscode.workspace.getConfiguration('keybindings');
    const analyzeQueryPlanBinding = keybindings.find(binding => 
        binding.command === 'vscode-postgres.analyzeQueryPlan'
    );
    
    if (analyzeQueryPlanBinding) {
        console.log('✓ analyzeQueryPlan快捷键已配置:', analyzeQueryPlanBinding.key);
    } else {
        console.log('✗ analyzeQueryPlan快捷键未找到');
    }
    
    // 检查命令是否注册
    console.log('2. 检查命令注册...');
    const commands = await vscode.commands.getCommands();
    const hasAnalyzeQueryPlan = commands.includes('vscode-postgres.analyzeQueryPlan');
    
    if (hasAnalyzeQueryPlan) {
        console.log('✓ analyzeQueryPlan命令已注册');
    } else {
        console.log('✗ analyzeQueryPlan命令未注册');
    }
    
    // 检查package.json中的配置
    console.log('3. 检查package.json配置...');
    const packageJson = require('./package.json');
    const contributes = packageJson.contributes;
    
    if (contributes && contributes.commands) {
        const analyzeCommand = contributes.commands.find(cmd => 
            cmd.command === 'vscode-postgres.analyzeQueryPlan'
        );
        
        if (analyzeCommand) {
            console.log('✓ package.json中analyzeQueryPlan命令已配置');
            console.log('  标题:', analyzeCommand.title);
        } else {
            console.log('✗ package.json中analyzeQueryPlan命令未找到');
        }
    }
    
    // 检查快捷键绑定
    if (contributes && contributes.keybindings) {
        const keybinding = contributes.keybindings.find(kb => 
            kb.command === 'vscode-postgres.analyzeQueryPlan'
        );
        
        if (keybinding) {
            console.log('✓ package.json中快捷键已配置:', keybinding.key);
        } else {
            console.log('✗ package.json中快捷键未配置');
        }
    }
    
    // 检查菜单项
    if (contributes && contributes.menus) {
        const commandPalette = contributes.menus['command-palette'];
        if (commandPalette) {
            const menuItem = commandPalette.find(item => 
                item.command === 'vscode-postgres.analyzeQueryPlan'
            );
            
            if (menuItem) {
                console.log('✓ 命令面板菜单项已配置');
            } else {
                console.log('✗ 命令面板菜单项未配置');
            }
        }
    }
    
    console.log('\n=== 测试完成 ===');
    console.log('现在你可以:');
    console.log('1. 打开complex_query_test.sql文件');
    console.log('2. 使用快捷键 Ctrl+Shift+F5 或通过命令面板执行"PostgreSQL: Analyze Query Plan"');
    console.log('3. 查看查询执行计划分析结果');
}

// 运行测试
testAnalyzeQueryPlan().catch(console.error);
