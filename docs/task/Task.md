| 分类 | 二级分类 | 描述 | 二级描述 | 备注 | 状态 | 自由认领 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | VSCode插件调试 |  | [解析插件结构](https://liiked.github.io/VS-Code-Extension-Doc-ZH/#/get-started/extension-anatomy) | *已完成* | <kbd>NA</kbd> |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | 脚手架 |  | [你的第一个插件](https://liiked.github.io/VS-Code-Extension-Doc-ZH/#/get-started/your-first-extension)<br>`现有PJ改造` | *已完成* | <kbd>NA</kbd> |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | 数据库连接 |  |  | *已验证* | <kbd>NA</kbd> |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | SQL检查 |  | [语法高亮](https://liiked.github.io/VS-Code-Extension-Doc-ZH/#/language-extensions/syntax-highlight-guide)<br>[语义高亮](https://liiked.github.io/VS-Code-Extension-Doc-ZH/#/language-extensions/semantic-highlight-guide) | *已验证* | <kbd>NA</kbd> |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | 自动补全 | 表名、字段名、关键字、函数 |  | *已验证* | <kbd>NA</kbd> |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | SQL执行 | 表格输出 |  | *已验证* | <kbd>NA</kbd> |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | SQL执行 | 执行状态 |  | *已验证* | <kbd>NA</kbd> |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | SQL执行 | 结果计数 |  | *已验证* | <kbd>NA</kbd> |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | 资源管理器 | 数据库树状图 |  | *已验证* | <kbd>NA</kbd> |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | 资源管理器 | 通过单击状态栏中的数据库快速更改连接数据库 |  | *已验证* | <kbd>NA</kbd> |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | 结果导出 | json、xml 、csv |  | *已验证* | <kbd>NA</kbd> |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | UI | 表视图 |  | *已验证* | <kbd>NA</kbd> |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | UI | SQL 脚本视图 |  | *已验证* | <kbd>NA</kbd> |
| <kbd>Code</kbd> | <kbd>Basic</kbd> | Formatting | 自动对齐 |  | *着手中* | [Chris-yz888](https://github.com/Chris-yz888) |
| <kbd>Code</kbd> | <kbd>Advanced</kbd> | Formatting | 规则客制化 |  |  |  |
| <kbd>Code</kbd> | <kbd>Advanced</kbd> | 客制化 | 预设常用SQL模板 |  |  |  |
| <kbd>Code</kbd> | <kbd>Advanced</kbd> | 客制化 | 代码规范 |  |  |  |
| <kbd>Code</kbd> | <kbd>Advanced</kbd> | 改表建表C~~R~~UD | 右键操作（如新增表、修改字段、删除索引），无需手动写DDL语句 |  | *着手中* | [qzh13186526261](https://github.com/qzh13186526261) |
| <kbd>Code</kbd> | <kbd>Advanced</kbd> | AI写SQL |  |  | *着手中* | [rurupa876](https://github.com/rurupa876)`浮窗`<br>[laiyk5](https://github.com/laiyk5)  |
| <kbd>Code</kbd> | <kbd>Advanced</kbd> | AI检查SQL | 查询优化辅助：自动分析SQL执行计划（如是否使用索引、全表扫描风险），提供优化建议（如添加索引、调整JOIN顺序） | `结合实际工作场景（W3的需求访谈）` | *着手中* | [qq843757309](https://github.com/qq843757309)`（非AI检查）` |
| <kbd>Code</kbd> | <kbd>Advanced</kbd> | 知识库 | 训练AI |  |  |  |
| <kbd>Code</kbd> | <kbd>Advanced</kbd> | 快捷键支持 |  |  |  |  |
| <kbd>Code</kbd> | <kbd>Advanced</kbd> | 多数据库 |  | `改一改数据库连接/模型API` |  |  |
| <b style="color:green;">更多</b> |  |  | <b style="color:green;">※可自由添加更多功能<br>※可对已实现的功能做升级（只要不和其他人重复）</b><br><sup>*比如在SQL检查中加入[SQLFluff](https://github.com/sqlfluff)*</sup> |  |  |  |
| <kbd>Review</kbd> | <kbd>Basic</kbd> | Review文档 |  | [插件开发准则](https://liiked.github.io/VS-Code-Extension-Doc-ZH/#/references/extension-guidelines)<br>`D老师？` |  |  |
| <kbd>Test</kbd> | <kbd>Basic</kbd> | 测试文档 |  | `高级测试（自动化/测试用例）` |  |  |
| <kbd>Doc</kbd> | <kbd>Basic</kbd> | 论文报告 |  | `创新点    `<br>`如何量化，图表化（性能/测试覆盖率/准确性etc.）` |  |  |
| <kbd>Doc</kbd> |  |  | <b>批判性思维与新颖度</b>：前沿论文收集，来点模型和术语（提升高级感），我们对缺点的改进 |  |  |  |
| <kbd>Doc</kbd> |  |  | <b>需求工程</b>：来自sql一线开发者&<b>课程作业要求</b>两方的需求 |  |  |  |
| <kbd>Doc</kbd> |  |  | <b>技术选型</b>：为什么选择sql插件和postgre，不同工具优缺点比较表格 |  |  |  |
| <kbd>Doc</kbd> |  |  | <b>需求验证与协商</b>：<br>1) 3个Sprint：工时与优先级，录入github，burndown chart<br>2) 识别/跟踪/解决技术债，新需求/新问题的出现与及时响应 |  |  |  |
| <kbd>Doc</kbd> |  |  | <b>设计原则与框架</b>：插件式开发架构/微内核架构，系统架构图（如何符合设计原则与软件质量） |  |  |  |
| <kbd>Doc</kbd> |  |  | <b>MCR流程</b>：互相review，分支合并 |  |  |  |
| <kbd>Doc</kbd> |  |  | <b>测试</b>：分支测试，测试通过后，合并并集成测试（自动化测试用例/AI生成测试用例/性能测试） |  |  |  |
| <kbd>Doc</kbd> |  |  | <b>评估</b>：项目质量，未来展望 |  |  |  |
| <kbd>Doc</kbd> |  |  | <b>期间遇到的困难与解决</b>：任何环节（增强戏剧性与真实性） |  |  |  |
| <kbd>其他</kbd> |  | Scrum中的<br>　sprint<br>　　&　　<br>burndown <br>　chart | 每人每周3-4h，12周共36-48h<br>3-4h/人 4周/Sprint 6人 共 3\*4\*6h-4\*4\*6h=72h-96h<br><br><b>Sprint 1</b><br>`确定主题`<br>`确定功能性需求`<br>`确定非功能性需求`<br>`确定代码/测试/审查的标准`<br>`确定识别、跟踪或解决技术债务的⽅法`<br>`技术选型`<br>`可行性验证`<br>`设置github项目`<br>`需求文档(product backlog)&3个Sprint(sprint backlog)文档`<br><br><b>Sprint 2</b><br>`每人自己开发的功能拆出细节，至少凑12h-16h（如果有余力可以多开发点，工时可更多）`<br>`建议每个人的功能都能扯到一点软件工程知识`<br><br><b>Sprint 3</b><br>`单元测试`<br>`代码审查与调试`<br>`分支合并与集成测试`<br>`功能补充与优化`<br>`报告撰写`<br>`视频制作` | `W1的T课` |  |  |
| <kbd>其他</kbd> |  | 设计非功能性需求 |  | `可参考W4的T课` |  |  |