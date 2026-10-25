# PLAN · 2026-10-24 23:46

> 执行模式说明：本会话为无人值守，用户原始请求视为对本计划的授权；偏离将记入 _exec_log.md。

| # | 步骤 | 输入 | 输出 | 涉及对象 |
|---|---|---|---|---|
| 1 | 编写单文件应用 | 系统提示词全文、UI 五步规范、三微交互规范 | index.html（HTML+CSS+JS 一体：系统提示词嵌入、OpenAI 兼容流式调用、演示模式、迷你 Markdown 渲染含表格、设置抽屉、系统提示词查看器） | index.html |
| 2 | 编写使用说明 | 应用功能清单 | README.md（打开方式、API 配置、演示模式、隐私说明、边界声明） | README.md |
| 3 | 浏览器实测 | index.html | 渲染/交互证据（截图）：初始页、演示流式回复、A–F 结构与表格渲染、提交三连变、果冻开关、点赞爆粒子、设置与提示词抽屉、控制台无报错 | index.html（只读验证；如发现缺陷则回改并重验） |
| 4 | 产物契约落盘 | 1–3 的执行记录 | _exec_log.md、_verify.md（逐项 ✅/❌ 带证据）、_memory.md（记忆卡） | 三个过程文件 |
| 5 | 汇报 | 全部产物 | 按 harness 第 7 节格式输出完成汇报 | 无文件改动 |

**VERIFY 契约（第 3 步通过标准）**：
1. 135deg 渐变背景 #0f0c29→#302b63→#24243e；base/raised/overlay 三级玻璃（透明度+模糊+边框 1px rgba(255,255,255,0.22)、radius 20、阴影 0 8px 32px rgba(0,0,0,0.18)）；::before 顶部高光、::after 对角微光（mask-composite）、pointer-events:none；hover 切 overlay+blur+translateY(-2px) 240ms；@supports 降级 rgba(20,20,30,0.85)。
2. 点赞：缩小0.8→弹性回弹、灰→红、6–8 粒子 400ms ease-out 飞散淡出、计数上滚、总时长≈600ms、不可重入。
3. 提交按钮：矩形→圆形加载 300ms ease-in-out（宽度锁定）→绿勾 200ms spring→停顿→恢复 300ms ease-out；状态流 idle→loading→success→idle。
4. 果冻开关：拖动跟手 scaleX 拉伸、终点回弹带过冲 350ms cubic-bezier(0.34,1.8,0.64,1)、轨道灰→绿 350ms。
5. Agent 行为：系统提示词逐字嵌入并可查看；输出遵循 A–F 结构（演示样例即按此结构）；无 Key 时自动演示模式并明确标注；不输出单点价格（由提示词约束）。
6. 控制台无未捕获错误；密钥仅存 localStorage。
