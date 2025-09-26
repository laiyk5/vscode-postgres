// 检查analyzeQueryPlan功能配置的简单脚本
const fs = require('fs');
const path = require('path');

function checkAnalyzeQueryPlanConfig() {
    console.log('=== 检查analyzeQueryPlan功能配置 ===');
    
    try {
        // 读取package.json
        const packageJsonPath = path.join(__dirname, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        console.log('1. 检查package.json配置...');
        
        // 检查命令配置
        if (packageJson.contributes && packageJson.contributes.commands) {
            const analyzeCommand = packageJson.contributes.commands.find(cmd => 
                cmd.command === 'vscode-postgres.analyzeQueryPlan'
            );
            
            if (analyzeCommand) {
                console.log('✓ analyzeQueryPlan命令已配置');
                console.log('  标题:', analyzeCommand.title);
                console.log('  类别:', analyzeCommand.category);
            } else {
                console.log('✗ analyzeQueryPlan命令未找到');
            }
        }
        
        // 检查快捷键配置
        if (packageJson.contributes && packageJson.contributes.keybindings) {
            const keybinding = packageJson.contributes.keybindings.find(kb => 
                kb.command === 'vscode-postgres.analyzeQueryPlan'
            );
            
            if (keybinding) {
                console.log('✓ 快捷键已配置:', keybinding.key);
                console.log('  何时:', keybinding.when || 'always');
            } else {
                console.log('✗ 快捷键未配置');
            }
        }
        
        // 检查菜单配置
        if (packageJson.contributes && packageJson.contributes.menus) {
            const commandPalette = packageJson.contributes.menus['command-palette'];
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
        
        // 检查analyzeQueryPlan命令文件是否存在
        const analyzeCommandPath = path.join(__dirname, 'src', 'commands', 'analyzeQueryPlan.ts');
        if (fs.existsSync(analyzeCommandPath)) {
            console.log('✓ analyzeQueryPlan命令文件存在:', analyzeCommandPath);
            
            // 检查文件内容
            const fileContent = fs.readFileSync(analyzeCommandPath, 'utf8');
            if (fileContent.includes('analyzeQueryPlan')) {
                console.log('✓ analyzeQueryPlan函数已定义');
            }
        } else {
            console.log('✗ analyzeQueryPlan命令文件不存在');
        }
        
        console.log('\n=== 配置检查完成 ===');
        console.log('\n使用说明:');
        console.log('1. 在VSCode中打开complex_query_test.sql文件');
        console.log('2. 使用快捷键 Ctrl+Shift+F5 执行查询计划分析');
        console.log('3. 或通过命令面板搜索 "PostgreSQL: Analyze Query Plan"');
        console.log('4. 查看生成的查询执行计划分析结果');
        
    } catch (error) {
        console.error('检查配置时出错:', error.message);
    }
}

checkAnalyzeQueryPlanConfig();
