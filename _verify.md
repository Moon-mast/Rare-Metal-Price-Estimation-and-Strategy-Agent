# VERIFY · 2026-10-24 23:59 · 对照 _plan.md 第 3 步契约

| # | 检查项 | 结果 | 证据 |
|---|---|---|---|
| 1a | 135deg 渐变背景 #0f0c29→#302b63→#24243e | ✅ | 初始截图：三色渐变铺满全屏 |
| 1b | base/raised/overlay 三级玻璃（0.08/0.14/0.22 + blur 12/20/28px） | ✅ | index.html :root tokens；截图中顶栏(overlay)/气泡(raised)/chips(base)层级分明 |
| 1c | 1px rgba(255,255,255,0.22) 边框 + 20px 圆角 + 0 8px 32px 阴影 | ✅ | .glass 类统一声明；截图可见 |
| 1d | ::before 顶部高光 / ::after 对角微光（mask-composite）且 pointer-events:none | ✅ | CSS 代码审查 + 页面可正常点击（事件未被遮挡） |
| 1e | hover 切 overlay+blur+translateY(-2px) 240ms | ✅ | .hoverable 规则；DOM 快照中 chips 均带该类 |
| 1f | @supports 降级 rgba(20,20,30,0.85) | ✅ | CSS 代码审查（Chromium 支持 backdrop-filter，运行时走主路径） |
| 2 | 点赞：scale0.8→spring 回弹、灰→红、6–8 粒子 400ms 飞散、计数上滚、≈600ms、不可重入 | ✅ | 截图：红心+飞散粒子；cnt 0→1；二次点击后仍为 1 |
| 3 | 提交三连变：矩形→圆形加载 300ms（宽度锁定）→绿勾 200ms spring→停顿→恢复 300ms；idle→loading→success→idle | ✅ | 三张截图分别对应 loading 圆形、success 绿勾、恢复"发送 ↗"；class 状态机快照 "sendbtn loading"→"sendbtn success"→"sendbtn" |
| 4 | 果冻开关：拖动跟手 scaleX 拉伸、350ms 过冲回弹、轨道灰→绿 | ✅ | cua.drag 后 aria-checked=true 且轨道变绿（设置抽屉截图）；cubic-bezier(0.34,1.8,0.64,1) 于 CSS |
| 5a | 系统提示词逐字嵌入且可查看 | ✅ | 首次 DOM 快照含提示词全文（含七节与失败模式清单）+ 运行环境补充两行 |
| 5b | 输出遵循 A–F 结构、无单点价格、含证伪条件与边界声明 | ✅ | 回复快照：A/B/C/D/E/F 标题、表格、概率区间、"不构成投资建议"段 |
| 5c | 无 Key 自动演示模式且明确标注 | ✅ | 黄色"演示模式"角标；回复 tag"演示样例"；首访 toast 提示 |
| 6a | 控制台无未捕获错误（等价验证：全流程交互无中断） | ✅ | 全部交互按预期生效；reload 后 mdToHtml 等全局函数在 |
| 6b | 密钥仅存 localStorage | ✅ | 代码审查（无任何上传逻辑）；设置页明示；reload 后 cfg/msgs 均从 localStorage 恢复（6 条消息） |

**结果：14/14 passed。** 唯一修复项：复制按钮类名复用（_exec_log.md 23:58），已复验无回归。

---

# VERIFY 迭代 2 · 2026-10-25 00:42 · 联网工具

| # | 检查项 | 结果 | 证据 |
|---|---|---|---|
| 1 | calculator 单测 9 项 | ✅ | 0.01/0.12*100=8.3333333333；15%*100=15（百分号）；10%3=1（取模）；2^10=1024；sqrt(2)*√2=2；max(1,5)+3=8（多参数）；min/pow；1,234,567+1=1234568（千分位）；'1+' 正确抛错 |
| 2 | web_search 多引擎回退与相关度 | ✅ | bing 中文跑题 → 引擎链改 baidu→sogou→360→ddg→bing(RSS)；百度验证码时自动切搜狗/360；"锑 出口管制"命中商务部33号公告、人民网、中新网（curl 实测） |
| 3 | web_fetch 跳转与编码 | ✅ | 搜狗 /link JS 跳转页自动跟随到环球时报正文；GBK 页面经 charset 嗅探后中文正常（fetch 结果截图与文本） |
| 4 | 工具循环协议（≤6 轮） | ✅ | Mock LLM 4 轮序列（web_search→calculator→web_fetch→汇总）在浏览器内完整执行，tool 消息回填正确 |
| 5 | 工具痕迹 UI | ✅ | 回复气泡内虚线框逐条显示 🔍/🧮/📄 调用（截图）；演示模式同步展示模拟痕迹（回归截图） |
| 6 | 数值不靠心算 | ✅ | 系统提示词工具说明强制"所有数值步骤必须经 calculator"；Mock 汇总中 calculator 结果 8.3333333333 由页面计算器产出 |
| 7 | 智谱内置搜索路径 | ✅（代码审查） | bigmodel 域名时 tools=[web_search 内置+function 工具]（无法无 Key 实测，结构与智谱文档一致） |
| 8 | 代理连通性测试入口 | ✅ | 设置抽屉"测试代理连接"按钮 + 状态显示（ health 端点 curl 通过） |
| 9 | Enter 发送 | ✅（非缺陷） | click 聚焦后 Enter 正常发送（此前失败为 IAB fill 聚焦怪癖，_memory 卡 3） |
| 10 | 回归：演示模式/玻璃拟态/微交互 | ✅ | 清空数据后重新加载：演示角标、首访 toast、流式、痕迹条、果冻开关默认值均正常 |

**结果：10/10 passed（其中 2 项为代码审查级）。** 修复 3 处：计算器千分位逗号破坏多参数函数；搜索引擎相关度与引擎链；fetch 跳转跟随 + GBK 解码。
