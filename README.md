# Critical Minerals Desk · 稀有金属价格预估与策略 Agent

根据《稀有金属价格预估与策略 Agent · 系统提示词 v1.0》构建的可运行 Agent 应用：单文件网页 + 零依赖本地工具代理，无构建步骤。界面按玻璃拟态规范构建（背景层 → 玻璃层 → 内容层三级深度），包含点赞爆粒子、提交按钮三连变、果冻开关三个微交互。

## 下载安装

| 平台 | 获取方式 |
|---|---|
| **Windows** | [Releases](https://github.com/Moon-mast/Rare-Metal-Price-Estimation-and-Strategy-Agent/releases) 下载 `Rare-Metal-Agent-Windows-1.0.0.exe`（免安装便携版，双击即用，自带工具代理）或同名 `.zip` |
| **Android** | 用 Chrome 打开 [在线版](https://moon-mast.github.io/Rare-Metal-Price-Estimation-and-Strategy-Agent/) → 菜单 → **添加到主屏幕/安装应用**，即得全屏独立 App（PWA）。注意：在线版不含本地工具代理，联网搜索/文件/代码执行需按下方说明在本机运行代理，或直接用 Windows 版 |
| **源码运行** | 克隆本仓库 → `npm install` → `node agent-proxy.js`（另开终端）→ 浏览器打开 `http://127.0.0.1:8210` |

## 桌面端（Electron）

除浏览器访问外，应用打包了 Electron 桌面壳（依赖已装在 `node_modules`，无需再安装）：

- **启动**：双击 `启动桌面端.bat`，或双击桌面快捷方式「稀有金属策略Agent」（图标为 `图标.png` 转制的 `electron.ico`）。
- **自动拉起工具代理**：启动时自动运行 `agent-proxy.js`（8210），退出窗口时一并结束；若代理已在外部运行则直接复用；代理启动失败会弹提示并退化为直接加载页面（联网工具不可用，其余正常）。
- **独立窗口**：无地址栏、无菜单栏，单实例（重复启动会唤起已有窗口），任务栏/窗口图标用 `图标.png`。
- **注意**：桌面端（8210 来源）与浏览器版（8080/file://）的 localStorage 相互独立，API Key 与对话记录各自保存。
- 想改窗口标题、默认尺寸：编辑 `main.js` 中 `BrowserWindow` 配置。

## 快速开始

1. **联网工具（推荐先启动）**：在本目录运行 `node agent-proxy.js`（提供多引擎搜索、网页抓取、静态服务，端口 8210）。
2. **打开应用**：双击 `index.html`，或直接访问代理附带的静态服务 `http://127.0.0.1:8210`（推荐，无跨域问题）。
3. **演示模式**：未配置 API Key 时自动处于演示模式（顶部有黄色"演示模式"角标）。发送任意问题会先播放模拟的工具调用痕迹，再输出内置样例回复，用于预览 Agent 的 A–F 输出结构。样例为离线静态内容，**不是实时分析**。
4. **接入真实模型**：右上角 ⚙ 设置 → 选择接口提供方 → 填入 API Key → 保存，然后在输入框保持「联网工具」开启。

**内置 15 个接口提供方**（设置中切换，自动填充 Base URL 与默认模型，并显示各家的填写提示；均为 OpenAI 兼容 `/chat/completions` 协议，Key 只存本机）：

| 提供方 | Base URL | 默认模型 | 备注 |
|---|---|---|---|
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4.6` | 免费档可改 `glm-4-flash`；**内置服务端联网搜索，开箱即用** |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | 深度思考自动切 `deepseek-reasoner` |
| 阿里通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` | 百炼 OpenAI 兼容模式 |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `deepseek-ai/DeepSeek-V3` | 注册有免费额度 |
| 字节豆包 | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-pro-32k` | 方舟可能需填接入点 ID（ep-xxx） |
| Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` | |
| 腾讯混元 | `https://api.hunyuan.cloud.tencent.com/v1` | `hunyuan-turbos-latest` | 需开通混元兼容接口 |
| 百度千帆 | `https://qianfan.baidubce.com/v2` | `ernie-4.0-8k` | v2 兼容接口 |
| 讯飞星火 | `https://spark-api-open.xf-yun.com/v1` | `generalv3.5` | Key 填 APIPassword |
| 零一万物 | `https://api.lingyiwanwu.com/v1` | `yi-large` | |
| 阶跃星辰 | `https://api.stepfun.com/v1` | `step-2-16k` | |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | 需可直连网络 |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` | 聚合，模型名带前缀 |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | 免费额度，可能需代理 |
| 自定义 | 任意 | 任意 | 含本地 Ollama：`http://127.0.0.1:11434/v1` |

除智谱外，其余提供方的联网搜索需本地代理 `agent-proxy.js`。模型名可随时在设置中手改（各厂商上新模型后直接填名字即可）。

**深度思考**开关：智谱系附加 `thinking: {type:"enabled"}`，DeepSeek 自动切换 reasoner 模型，其他提供方忽略。

## 联网工具与编程能力是怎么工作的

打开输入框左侧「联网工具」开关后，应用以标准 function-calling 循环驱动模型（轮数上限可在设置中调，默认 25、最高 50），每一步工具调用都会以 🔍/🧮/📄 痕迹条实时显示在回复气泡内，页面顶部的**灵动岛**胶囊同步显示"当前动作 · 第 N/M 轮 · 计时"，点击可展开最近 4 步轨迹。

| 工具 | 实现 | 说明 |
|---|---|---|
| `web_search` | 智谱：服务端内置；其他提供方：`agent-proxy.js` 多引擎回退（baidu → sogou → 360 → ddg → bing RSS） | 中文相关度优先百度/搜狗/360；百度偶发验证码时自动切换下一个引擎。模型被建议中英文关键词各搜一次交叉验证 |
| `web_fetch` | `agent-proxy.js` 抓取 | 自动跟随搜索引擎跳转链接（JS 跳转/meta refresh，最多 3 跳），自动嗅探 UTF-8/GBK 编码，剥离脚本样式后返回正文 |
| `calculator` | 浏览器内置递归下降解析器（无 eval，离线可用） | `+ - * / % ^`、括号、函数、pi/e；独立 `%` 按百分号处理；数字间千分位逗号自动剔除 |
| `run_code` | `agent-proxy.js` 以本机 Node.js 运行（无代理时退化为浏览器 Worker 沙箱） | 模型编写**完整程序**执行：多步计算、批量处理、模拟推演、数据解析；回传 stdout/stderr，超时可调（默认 30s，最大 120s） |
| `write_file` / `read_file` / `list_files` | `agent-proxy.js` 文件系统接口 | **严格限制在工作区目录内**（默认 `workspace/`，可在设置修改），路径越界直接拒绝；写文件自动创建子目录 |
| `run_command`（仅完全访问模式） | `agent-proxy.js` shell 执行 | 任意命令行，默认关闭 |

**三种权限模式**（⚙ 设置）：

- **变更前确认**（默认）：写文件、运行代码前弹窗展示路径/内容/代码预览，可选"仅本次允许 / 本对话总是允许 / 拒绝"；
- **自主模式**：工作区内的文件与代码操作自动执行，不开放 shell；
- **完全访问**：全部自动执行，并额外开放 `run_command`（shell 命令）——风险自负。

读取/列目录类只读工具在任何模式下都不需要确认。

## 其他界面能力

- **代码块复制**：回复中每个代码块右上角有"复制代码"按钮；消息底部仍有整段 Markdown 复制。
- **灵动岛**：顶部居中胶囊，待命/工作（琥珀色脉冲）/完成（绿色）三种状态，点击展开最近工具轨迹。

## 使用建议（重要）

- 工具模式的回复为非流式（工具循环协议限制），期间可点「停止」中断。
- 搜索引擎为公开页面的轻量解析，可能因对方改版或风控而临时降级——多引擎回退 + 智谱内置搜索是双保险；对关键结论务必让模型用 `web_fetch` 打开原文核实。
- 输出永远是**三情景 + 概率 + 证伪条件**，不会有单点价格目标；每次涉及买卖方向都会附带边界声明。
- 导出按钮可把整段对话存为 Markdown。

## 隐私与安全

- API Key 与对话记录仅保存在**本机浏览器 localStorage**，不向任何第三方上传；"清空本地数据"可一键删除。
- `agent-proxy.js` 仅监听 127.0.0.1，它替你转发搜索/抓取请求（浏览器直连任意网站会被 CORS 拦截），不收集任何数据。

## 界面规范落点（对照 decoration.md）

- **玻璃拟态五步**：135deg 三色渐变背景；base/raised/overlay 三级 surface（透明度 0.08/0.14/0.22 + blur 12/20/28px）；统一 1px `rgba(255,255,255,.22)` 边框、20px 圆角、`0 8px 32px rgba(0,0,0,.18)` 阴影；`::before` 顶部内高光、`::after` + `mask-composite` 对角边缘微光（均 `pointer-events:none`）；悬浮切 overlay + `translateY(-2px)` 240ms；`@supports not (backdrop-filter)` 降级 `rgba(20,20,30,.85)`。
- **点赞爆粒子**：点击 → scale 0.8 → spring 回弹 + 灰变红，6–8 个圆点粒子 400ms ease-out 飞散淡出，计数上滚 +1，总时长约 600ms，不可重入。
- **提交按钮三连变**：矩形 →（300ms ease-in-out，宽度锁定）→ 圆形加载 → 完成 →（200ms spring）→ 绿色对勾 → 停顿后恢复（300ms ease-out）；状态流 idle → loading → success → idle。
- **果冻开关**：拖动跟手、滑块 scaleX 拉伸，释放后 350ms `cubic-bezier(0.34,1.8,0.64,1)` 带过冲回弹，轨道灰 → 绿 350ms。用于"联网工具""深度思考""流式输出""演示模式"。

## 文件清单

- `index.html` — 全部应用（HTML + CSS + JS 单文件）
- `agent-proxy.js` — 零依赖本地工具代理（多引擎搜索 / 网页抓取 / 静态服务，`node agent-proxy.js` 启动）
- `稀有金属价格预估与策略 Agent · 系统提示词.md` — 原始系统提示词（已逐字嵌入应用，可在应用内"系统提示词"面板查看）
- `_route.md` / `_plan.md` / `_exec_log.md` / `_verify.md` / `_memory.md` — 按 harness 产物契约留的过程记录
