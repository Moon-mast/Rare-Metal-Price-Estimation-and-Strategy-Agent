# ROUTE · 2026-10-24 23:45

- **任务类型**：新建（改动类）——根据用户提供的系统提示词文档，构建可运行的 Agent 应用。
- **命中经验**：无历史记忆（首次任务）。
- **输入材料**：
  1. `稀有金属价格预估与策略 Agent · 系统提示词.md`（v1.0，完整版）→ 作为 Agent 运行时的系统提示词，逐字嵌入。
  2. `interior decoration.md` → UI 规范：玻璃拟态界面五步法（背景/Depth Tokens/玻璃面/光学细节/交互降级）+ 三个微交互（点赞爆粒子、提交按钮三连变、果冻开关）→ 映射为聊天界面。
  3. `mszhou harness.md` → 本任务执行过程的工作流约束（模式/状态机/产物契约/护栏）。
- **一句话策略**：交付单文件 `index.html`（无构建、双击即用）：完整嵌入 Critical Minerals Desk Agent 系统提示词 + OpenAI 兼容 API 调用（流式）+ 演示模式（无 Key 可体验输出结构）+ 玻璃拟态三层 UI 与三个微交互；README 说明用法。
- **关键取舍**：选"网页应用"而非 CLI/配置文件——工作目录名为 Rare Metal Query、用户附带 UI 动效规范，指向可视化查询界面；单文件形态是 decoration.md 的明确要求。
- **范围**：仅新建 index.html、README.md、_route/_plan/_exec_log/_verify/_memory 五个过程产物；不改动用户三份原文档。
