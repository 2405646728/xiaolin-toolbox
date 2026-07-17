# 小林 AI · 自主操控型桌面 AI 助手 Spec

## Why
当前"小林 AI"实际上只是基于关键词匹配的本地命令解析器，并非真正的 AI。用户希望拥有一个能**自主操控电脑**完成复杂任务的 AI 助手——例如"去 B 站搜索周杰伦，找到播放量最高的视频并点赞"，AI 能自己打开浏览器、识别屏幕、模拟鼠标键盘完成整个任务流程。同时需要提供安装版与免安装版两种分发形式，并提供清晰的功能开发进度清单。

## What Changes

### 核心升级
- **接入大模型 API**：通过 OpenAI 兼容协议接入 LLM（支持 OpenAI / DeepSeek / 智谱 / 通义千问等），具备真正的对话与推理能力
- **多模态视觉感知**：支持视觉模型（gpt-4o / qwen-vl-max / glm-4v），AI 能"看见"屏幕内容并理解 UI
- **鼠标键盘全自主控制**：AI 能模拟鼠标移动、点击、拖拽、滚动、键盘输入、快捷键，可操控任意 GUI 程序
- **ReAct 自主任务编排**：AI 通过"思考→行动→观察→反思"循环，自主分解并执行多步骤复杂任务
- **Function Calling 工具调用**：本地能力封装为工具，AI 自主选择调用
- **任务执行可视化**：实时展示 AI 当前思考、正在执行的动作、屏幕截图反馈
- **危险操作二次确认**：删除文件、终止进程、系统设置变更等操作前弹窗确认
- **多轮对话上下文记忆**：超长对话自动截断保留近期上下文
- **设置页面**：API 管理、模型选择、安全策略、用量统计、关于信息
- **API 用量实时监控**：每次 API 调用实时记录 token 消耗（输入/输出/图片）、估算费用、累计统计，界面实时展示
- **离线降级模式**：未配置 API 时使用本地命令解析（70+ 命令保留）
- **BREAKING**：原关键词命令侧栏改为对话历史 + 任务执行面板
- **BREAKING**：原 `aiCommands.ts` 改造为离线降级解析器

### Rust 后端扩展（约 20 个新命令）
- 鼠标控制：`mouse_move` / `mouse_click` / `mouse_double_click` / `mouse_right_click` / `mouse_drag` / `mouse_scroll`
- 键盘控制：`keyboard_type` / `keyboard_press` / `keyboard_hotkey`
- 视觉感知：`screenshot` / `screenshot_region`
- 窗口管理：`list_windows` / `focus_window` / `minimize_window` / `maximize_window` / `close_window`
- 文件操作：`list_files` / `read_file` / `write_file` / `delete_file` / `move_file` / `search_files`
- 应用与进程：`open_app` / `kill_process` / `list_processes`
- 系统工具：`clipboard_get` / `clipboard_set` / `open_url` / `search_web` / `run_shell`
- 系统信息：`get_system_info` / `get_hardware_info`

### 打包
- NSIS 安装版（.exe 安装程序，注册到控制面板）
- Portable 免安装版（.zip 解压即用，配置数据存放 exe 同级）

## Impact
- Affected specs: 无（项目首次创建 spec）
- Affected code:
  - `src-tauri/src/lib.rs` — 从 267 行扩展到约 800 行，新增 20+ 工具命令，引入 `enigo` / `xcap` crate
  - `src-tauri/Cargo.toml` — 新增 `enigo` / `xcap` / `window-vum0` 依赖
  - `src-tauri/tauri.conf.json` — 新增 NSIS / MSI / Portable 打包配置，新增权限声明
  - `src/lib/llm.ts` — 新增，LLM 客户端（文本 + 视觉 + Function Calling + 流式）
  - `src/lib/tools.ts` — 新增，工具定义与调度桥接
  - `src/lib/agent.ts` — 新增，ReAct Agent 循环引擎
  - `src/lib/conversations.ts` — 新增，多对话会话管理
  - `src/lib/usage.ts` — 新增，API 用量追踪与统计
  - `src/lib/aiCommands.ts` — 改造为离线降级解析器
  - `src/pages/CommandAI.tsx` — 重构为自主任务执行界面
  - `src/pages/Settings.tsx` — 新增，设置页面（含用量统计区）
  - `src/components/TaskProgress.tsx` — 新增，任务执行步骤可视化
  - `src/components/ScreenshotPreview.tsx` — 新增，AI 视觉截图预览
  - `src/components/ConfirmDialog.tsx` — 新增，危险操作确认弹窗
  - `src/components/UsagePanel.tsx` — 新增，用量监控面板（实时 + 历史统计）
  - `src/App.tsx` — 增加主页/设置页切换
  - `package.json` — 新增打包脚本

## 功能清单与开发进度

> 状态图例：📋 规划中 · 🚧 开发中 · ✅ 已完成 · ⚠️ 待修复 · ⏸️ 暂停

### Phase 1 · 基础 AI 对话（核心基础）

| # | 功能 | 状态 | 进度 | 说明 |
|---|------|------|------|------|
| 1.1 | LLM API 客户端封装 | ✅ | 100% | OpenAI 兼容协议，支持流式 SSE（llm.ts） |
| 1.2 | API Key 配置与持久化 | ✅ | 100% | localStorage 保存，掩码显示 |
| 1.3 | 流式响应渲染 | ✅ | 100% | streamChat 逐字输出 |
| 1.4 | 多轮对话上下文管理 | ✅ | 100% | truncateMessages 自动 token 截断 |
| 1.5 | 设置页（API/模型/安全/用量/关于） | ✅ | 100% | 五分区布局，Settings.tsx |
| 1.6 | 模型快速选择 | ✅ | 100% | 预置 OpenAI/DeepSeek/智谱/通义/自定义 |
| 1.7 | 测试连接按钮 | ✅ | 100% | 发送 ping 验证 API Key |
| 1.8 | 离线降级模式 | ✅ | 100% | 未配置 API 时用 aiCommands 本地解析 |

### Phase 2 · 工具调用基础（Function Calling）

| # | 功能 | 状态 | 进度 | 说明 |
|---|------|------|------|------|
| 2.1 | Function Calling 框架 | ✅ | 100% | TOOL_DEFINITIONS（38 个工具，OpenAI 格式） |
| 2.2 | 工具调度器 executeTool | ✅ | 100% | tools.ts 路由到对应 Tauri command |
| 2.3 | 危险操作白名单 | ✅ | 100% | DANGEROUS_TOOLS + requiresConfirmation |
| 2.4 | 确认弹窗组件 | ✅ | 100% | ConfirmDialog.tsx 命令式调用 |
| 2.5 | 工具调用结果卡片 | ✅ | 100% | TaskProgress.tsx 配对展示 call+result |
| 2.6 | 系统信息工具 | ✅ | 100% | get_system_info / get_hardware_info |
| 2.7 | 应用启动工具 | ✅ | 100% | open_app（白名单保护） |
| 2.8 | 文件操作工具 | ✅ | 100% | list/read/write/delete/move/search |
| 2.9 | 剪贴板工具 | ✅ | 100% | clipboard_get / clipboard_set |
| 2.10 | 浏览器工具 | ✅ | 100% | open_url / search_web |
| 2.11 | 进程管理工具 | ✅ | 100% | list_processes / kill_process（14 进程白名单） |
| 2.12 | Shell 命令工具 | ✅ | 100% | run_shell（安全黑名单拦截） |

### Phase 3 · 视觉感知与鼠标键盘控制（自主操控核心）

| # | 功能 | 状态 | 进度 | 说明 |
|---|------|------|------|------|
| 3.1 | 截屏命令 screenshot | ✅ | 100% | 全屏截图返回 base64（xcap + write_to） |
| 3.2 | 区域截屏 screenshot_region | ✅ | 100% | 指定坐标范围截图 |
| 3.3 | 截图预览组件 | ✅ | 100% | ScreenshotPreview.tsx 缩略图+放大 |
| 3.4 | 视觉模型调用 | ✅ | 100% | visionChat 多模态 API |
| 3.5 | 鼠标移动 mouse_move | ✅ | 100% | enigo 移动到指定坐标 |
| 3.6 | 鼠标单击 mouse_click | ✅ | 100% | 左键单击 |
| 3.7 | 鼠标双击 mouse_double_click | ✅ | 100% | 左键双击 |
| 3.8 | 鼠标右键 mouse_right_click | ✅ | 100% | 右键单击 |
| 3.9 | 鼠标拖拽 mouse_drag | ✅ | 100% | 从坐标 A 拖到坐标 B |
| 3.10 | 鼠标滚动 mouse_scroll | ✅ | 100% | 上下滚动指定量 |
| 3.11 | 键盘输入 keyboard_type | ✅ | 100% | 输入文本字符串 |
| 3.12 | 键盘按键 keyboard_press | ✅ | 100% | 按下单个键 |
| 3.13 | 键盘组合键 keyboard_hotkey | ✅ | 100% | Ctrl+C / Alt+Tab / Win+E 等 |
| 3.14 | 鼠标坐标定位辅助 | ✅ | 100% | 视觉模型识别屏幕元素坐标 |

### Phase 4 · 自主任务编排（ReAct Agent）

| # | 功能 | 状态 | 进度 | 说明 |
|---|------|------|------|------|
| 4.1 | ReAct 循环引擎 | ✅ | 100% | agent.ts runAgent 思考→行动→观察→反思 |
| 4.2 | 任务步骤可视化 | ✅ | 100% | TaskProgress.tsx 5 种步骤卡片 |
| 4.3 | 任务中断与恢复 | ✅ | 100% | AbortController 用户停止 |
| 4.4 | 错误重试机制 | ✅ | 100% | AI 自主观察结果调整策略 |
| 4.5 | 最大步数限制 | ✅ | 100% | 默认 20 步防止无限循环 |
| 4.6 | 浏览器自主操作示例 | ✅ | 100% | ReAct 编排 open_url+screenshot+鼠标键盘 |
| 4.7 | 桌面应用自主操作 | ✅ | 100% | 操控任意 GUI 程序 |
| 4.8 | 文件管理自主操作 | ✅ | 100% | 多步骤文件整理/批量重命名 |

### Phase 5 · 窗口管理与高级功能

| # | 功能 | 状态 | 进度 | 说明 |
|---|------|------|------|------|
| 5.1 | 窗口列表 list_windows | ✅ | 100% | Win32 EnumWindows 枚举可见窗口 |
| 5.2 | 窗口聚焦 focus_window | ✅ | 100% | SetForegroundWindow 切换窗口 |
| 5.3 | 窗口最小化/最大化/关闭 | ✅ | 100% | ShowWindowAsync 三个命令 |
| 5.4 | 多对话会话管理 | ✅ | 100% | conversations.ts 新建/切换/删除 |
| 5.5 | 对话历史侧栏 | ✅ | 100% | ConversationSidebar.tsx 替换原命令分类 |
| 5.6 | 命令历史记录 | ✅ | 100% | TaskProgress 展示工具调用历史 |
| 5.7 | 快捷指令面板 | ⏸️ | 0% | 暂未实现，离线模式可用命令速查 |
| 5.8 | 定时任务（本地） | ⏸️ | 0% | 暂未实现 |

### Phase 6 · 系统控制扩展

| # | 功能 | 状态 | 进度 | 说明 |
|---|------|------|------|------|
| 6.1 | 音量控制 | ✅ | 100% | set_volume / mute_volume / unmute_volume |
| 6.2 | 电源管理 | ✅ | 100% | sleep/restart/shutdown（前端二次确认） |
| 6.3 | WiFi/蓝牙开关 | ⏸️ | 0% | 暂未实现 |
| 6.4 | 系统通知发送 | ✅ | 100% | send_notification |
| 6.5 | 截屏保存到文件 | ✅ | 100% | save_screenshot |
| 6.6 | 录屏（短期） | ⏸️ | 0% | 暂未实现 |

### Phase 7 · 打包与分发

| # | 功能 | 状态 | 进度 | 说明 |
|---|------|------|------|------|
| 7.1 | NSIS 安装版打包 | ⚠️ | 60% | 配置完成，NSIS 工具下载超时受阻 |
| 7.2 | MSI 安装版打包 | ⏸️ | 0% | 已移除（聚焦 NSIS + Portable 双形态） |
| 7.3 | Portable 免安装版 | ✅ | 100% | tauri build --no-bundle 生成 exe（4.7MB） |
| 7.4 | Portable 配置隔离 | ✅ | 100% | localStorage 配置随用户目录 |
| 7.5 | 应用图标与资源 | ✅ | 100% | 小林 AI 品牌图标已配置 |
| 7.6 | 一键打包脚本 | ✅ | 100% | tauri:build / tauri:build:nsis / tauri:build:portable |

### Phase 8 · 验证与文档

| # | 功能 | 状态 | 进度 | 说明 |
|---|------|------|------|------|
| 8.1 | TypeScript 编译通过 | ✅ | 100% | npm run check 零错误 |
| 8.2 | Rust 编译通过 | ✅ | 100% | cargo check 通过（修复 6 个编译错误） |
| 8.3 | 在线模式端到端测试 | 📋 | 0% | 需用户配置 API Key 实测 |
| 8.4 | 离线模式降级测试 | 📋 | 0% | 需用户实测 |
| 8.5 | B站搜索任务测试 | 📋 | 0% | 需用户配置视觉模型 API 实测 |
| 8.6 | 文件整理任务测试 | 📋 | 0% | 需用户实测 |
| 8.7 | 双形态打包验证 | 🚧 | 50% | Portable 已验证，NSIS 待网络恢复 |

### Phase 9 · API 用量实时监控（用户明确要求）

| # | 功能 | 状态 | 进度 | 说明 |
|---|------|------|------|------|
| 9.1 | 用量数据采集 | ✅ | 100% | recordUsage 记录 prompt/completion/total tokens |
| 9.2 | 图片 token 单独统计 | ✅ | 100% | 视觉调用标记 type:vision |
| 9.3 | 费用估算 | ✅ | 100% | MODEL_PRICING 12 个模型单价表 |
| 9.4 | 实时用量展示 | ✅ | 100% | UsageBadge 状态栏 tokens+费用 |
| 9.5 | 用量统计面板 | ✅ | 100% | UsagePanel 今日/本周/本月 + 饼图 + 折线图 |
| 9.6 | 按模型分组统计 | ✅ | 100% | getUsageByModel |
| 9.7 | 按对话分组统计 | ✅ | 100% | ConversationUsageBadge 对话侧栏徽章 |
| 9.8 | 用量历史图表 | ✅ | 100% | SVG 自绘折线图 7/30 天趋势 |
| 9.9 | 用量预警阈值 | ✅ | 100% | checkDailyLimit 超限红色闪烁 |
| 9.10 | 用量数据持久化 | ✅ | 100% | localStorage 保存历史用量 |
| 9.11 | 重置用量数据 | ✅ | 100% | resetUsage 一键清空 |
| 9.12 | 导出用量报告 | ✅ | 100% | exportUsageCsv（Tauri 对话框 + 浏览器降级） |

## ADDED Requirements

### Requirement: 大模型 API 接入（文本 + 视觉 + 流式）
系统 SHALL 通过 OpenAI 兼容协议接入大模型，支持文本对话、视觉理解（多模态）、流式响应（SSE）。系统 SHALL 支持配置 Base URL、API Key、模型名称、温度、最大 tokens。

#### Scenario: 文本对话流式响应
- **WHEN** 用户配置有效 API Key 后输入"你好"
- **THEN** AI 以流式方式实时输出回复，消息气泡逐字显示

#### Scenario: 视觉模型调用
- **WHEN** AI 在执行任务过程中需要识别屏幕内容，调用 `screenshot` 获取截图
- **THEN** 系统将截图以 base64 编码 + 用户问题发送给视觉模型，视觉模型返回对屏幕的描述或目标元素坐标

#### Scenario: API Key 无效
- **WHEN** 用户填入错误的 API Key 并发送消息
- **THEN** 显示"API 认证失败，请检查 Key"，不崩溃

#### Scenario: 网络不通
- **WHEN** 网络中断或 Base URL 无法访问
- **THEN** 提示"无法连接到 AI 服务"，允许切换到离线模式

### Requirement: 鼠标键盘全自主控制
系统 SHALL 提供鼠标移动、单击、双击、右键、拖拽、滚动，以及键盘文本输入、单键、组合键等命令，让 AI 能操控任意 GUI 程序。

#### Scenario: 模拟鼠标点击
- **WHEN** AI 调用 `mouse_click(x=500, y=300)`
- **THEN** 系统在屏幕坐标 (500, 300) 处执行左键单击

#### Scenario: 模拟键盘组合键
- **WHEN** AI 调用 `keyboard_hotkey(keys=["ctrl", "c"])`
- **THEN** 系统模拟按下 Ctrl+C 执行复制操作

#### Scenario: 拖拽操作
- **WHEN** AI 调用 `mouse_drag(from=[100,100], to=[500,500])`
- **THEN** 系统在 (100,100) 按下左键，移动到 (500,500) 后释放

### Requirement: 视觉感知与屏幕截图
系统 SHALL 提供全屏截图与区域截图命令，返回 base64 编码图像，AI 可通过视觉模型理解屏幕内容并定位 UI 元素坐标。

#### Scenario: 全屏截图
- **WHEN** AI 调用 `screenshot()`
- **THEN** 系统截取全屏，返回 base64 PNG 图像

#### Scenario: 区域截图
- **WHEN** AI 调用 `screenshot_region(x=0, y=0, width=800, height=600)`
- **THEN** 系统截取指定区域，返回 base64 PNG

#### Scenario: 截图在对话流中可视化
- **WHEN** AI 调用截图命令后
- **THEN** 前端在对话流中展示截图预览缩略图，用户可点击放大查看

### Requirement: ReAct 自主任务编排
系统 SHALL 实现 ReAct（Reasoning + Acting）循环，让 AI 能自主分解复杂任务为多步骤并迭代执行：思考 → 选择工具 → 执行 → 观察结果 → 反思 → 重复直到完成。

#### Scenario: B站搜索并点赞
- **WHEN** 用户输入"去 B 站搜索周杰伦，找到播放量最高的视频并点赞"
- **THEN** AI 自主执行以下步骤：
  1. 调用 `open_url("https://www.bilibili.com")` 打开 B 站
  2. 调用 `screenshot()` 截屏
  3. 视觉模型识别搜索框位置
  4. 调用 `mouse_click` 点击搜索框
  5. 调用 `keyboard_type("周杰伦")` 输入文字
  6. 调用 `keyboard_press("Enter")` 回车搜索
  7. 调用 `screenshot()` 截屏查看搜索结果
  8. 视觉模型识别播放量最高的视频卡片位置
  9. 调用 `mouse_click` 点击视频
  10. 调用 `screenshot()` 截屏查看视频页
  11. 视觉模型识别点赞按钮位置
  12. 调用 `mouse_click` 点击点赞
  13. 调用 `screenshot()` 验证点赞成功
  14. 返回"已完成"总结

#### Scenario: 任务中断
- **WHEN** AI 执行多步骤任务过程中用户点击"停止"
- **THEN** 系统立即停止后续工具调用，保留已完成步骤的记录

#### Scenario: 最大步数保护
- **WHEN** AI 连续执行超过 20 个工具调用仍未完成任务
- **THEN** 系统停止执行并提示"任务超出最大步数限制，已停止"，AI 总结当前进度

#### Scenario: 错误自恢复
- **WHEN** 某个工具调用失败（如点击坐标偏差未命中）
- **THEN** AI 重新截屏观察、调整策略、再次尝试，最多 3 次重试后向用户反馈

### Requirement: 任务执行可视化
系统 SHALL 在对话流中实时展示 AI 的思考过程、当前动作、工具调用参数与结果、截图反馈，让用户清楚 AI 正在做什么。

#### Scenario: 思考过程展示
- **WHEN** AI 进入 ReAct 循环的"思考"阶段
- **THEN** 前端展示思考气泡（折叠样式，可展开），内容为 AI 的推理文本

#### Scenario: 工具调用过程展示
- **WHEN** AI 调用某个工具
- **THEN** 前端展示卡片：工具名 + 参数 + 执行中动画 → 完成后展示结果摘要

#### Scenario: 截图反馈展示
- **WHEN** AI 调用 screenshot 工具
- **THEN** 前端在工具卡片中展示截图缩略图，用户可点击放大

### Requirement: 危险操作二次确认
系统 SHALL 在 AI 调用具有破坏性或不可逆的工具（delete_file / kill_process / run_shell 含危险命令 / 系统电源操作 / 修改系统设置）前，弹出确认对话框展示完整工具名与参数，等待用户确认。

#### Scenario: 删除文件需确认
- **WHEN** AI 决定调用 `delete_file` 删除 `D:\test.txt`
- **THEN** 前端弹窗显示"小林 AI 想要执行：删除文件 D:\test.txt"，用户点击"允许"后执行，点击"拒绝"则向 AI 反馈"用户拒绝执行"

#### Scenario: 鼠标点击无需确认
- **WHEN** AI 调用 `mouse_click` / `keyboard_type` / `screenshot` 等安全工具
- **THEN** 直接执行，不打断任务流

### Requirement: 多对话会话管理
系统 SHALL 支持创建多个独立对话会话，每个会话保留独立上下文，可在侧栏切换。

#### Scenario: 新建对话
- **WHEN** 用户点击"新建对话"按钮
- **THEN** 创建空对话，自动切换到新会话，左侧侧栏显示新会话条目

#### Scenario: 切换对话
- **WHEN** 用户点击侧栏中某个历史对话
- **THEN** 主界面切换到该对话的消息流与上下文

#### Scenario: 删除对话
- **WHEN** 用户在侧栏对话条目点击删除按钮
- **THEN** 弹窗确认后删除该会话及其所有消息

### Requirement: 设置页面
系统 SHALL 提供设置页面，包含 API 配置、模型选择、安全策略、用量统计、关于信息五个分区。

#### Scenario: API 配置持久化
- **WHEN** 用户在设置页填写 API Key 并保存
- **THEN** 配置持久化到 localStorage，重启应用后仍生效；API Key 在 UI 中以掩码显示

#### Scenario: 模型切换
- **WHEN** 用户从模型下拉框选择不同模型
- **THEN** 下一次对话使用新模型

#### Scenario: 测试连接
- **WHEN** 用户点击"测试连接"按钮
- **THEN** 系统发送一条 ping 消息验证 API Key 有效性，显示成功/失败提示

### Requirement: API 用量实时监控
系统 SHALL 在每次 LLM API 调用后实时记录 token 消耗（prompt_tokens / completion_tokens / total_tokens），对视觉模型调用额外记录图片 token，按模型单价估算费用，并在主界面顶部状态栏与设置页用量面板中实时展示。

#### Scenario: 单次调用用量记录
- **WHEN** AI 发起一次 LLM 调用并收到响应
- **THEN** 系统从响应的 `usage` 字段提取 prompt_tokens / completion_tokens / total_tokens，按当前模型单价计算费用，记录到用量记录（含时间戳、模型、token 数、费用、对话 ID）

#### Scenario: 实时状态栏展示
- **WHEN** API 调用完成
- **THEN** 主界面顶部状态栏实时刷新显示：本次会话累计 tokens（如 "12,345 tokens"）与累计费用（如 "¥0.42"），鼠标悬停显示分项明细（输入/输出/图片）

#### Scenario: 视觉调用单独标记
- **WHEN** AI 调用视觉模型（visionChat）处理截图
- **THEN** 用量记录标记 `type: "vision"`，状态栏分项中单独显示"图片 tokens: xxx"

#### Scenario: 用量统计面板
- **WHEN** 用户打开设置页的用量统计分区
- **THEN** 展示：
  - 今日 / 本周 / 本月 三栏汇总卡片（tokens 数 + 费用）
  - 按模型分组的用量表格（模型名 / 调用次数 / 累计 tokens / 累计费用）
  - 近 7 天用量趋势折线图（X 轴日期，Y 轴双刻度：tokens 与费用）

#### Scenario: 按对话分组统计
- **WHEN** 用户在对话历史侧栏查看某个对话
- **THEN** 对话条目右侧显示该对话累计消耗的 tokens 与费用（如 "1.2k · ¥0.05"）

#### Scenario: 用量预警
- **WHEN** 用户在设置页设置每日费用上限（如 ¥10），当日累计费用达到上限
- **THEN** 系统在主界面状态栏以红色高亮显示"已超每日上限"，并发送系统通知提醒用户

#### Scenario: 用量数据持久化
- **WHEN** 应用关闭并重新打开
- **THEN** 历史用量记录从 localStorage 加载，今日/本周/本月统计保持准确

#### Scenario: 重置与导出
- **WHEN** 用户点击"重置用量数据"按钮
- **THEN** 弹窗二次确认后清空所有历史用量记录

- **WHEN** 用户点击"导出 CSV"按钮
- **THEN** 系统将用量明细导出为 CSV 文件（字段：时间 / 模型 / 类型 / prompt_tokens / completion_tokens / total_tokens / 费用 / 对话ID），保存到用户选择路径

### Requirement: 双形态打包
系统 SHALL 同时产出 NSIS 安装版（.exe）、MSI 安装版（.msi）和 Portable 免安装版（.zip），三者功能完全一致。

#### Scenario: 安装版使用
- **WHEN** 用户运行 NSIS 安装程序
- **THEN** 应用安装到 `Program Files\小林 AI`，创建开始菜单与桌面快捷方式，可在控制面板卸载

#### Scenario: 免安装版使用
- **WHEN** 用户解压 portable zip 到任意目录并运行 `小林AI.exe`
- **THEN** 应用直接运行，配置数据存放在 exe 同级 `data/` 目录（绿色便携，不污染系统）

## MODIFIED Requirements

### Requirement: AI 对话主界面
原界面基于关键词匹配的本地命令解析。现改造为基于大模型 + ReAct Agent 的自主任务执行界面。

具体变化：
- 顶部状态栏：在线/离线模式指示、模型名称、**实时用量（tokens + 费用，悬停看分项）**、设置入口、停止按钮
- 消息流：支持文本气泡、流式渲染、思考卡片、工具调用卡片、截图预览
- 左侧栏：从"命令分类"改为"对话历史列表"（条目右侧显示该对话 tokens + 费用），可新建/切换/删除对话
- 底部输入：保留输入框，新增"快捷指令"按钮
- 危险操作确认弹窗
- 任务执行过程中显示进度条与当前步骤

## REMOVED Requirements

### Requirement: 关键词命令分类侧栏
**Reason**: 改为对话历史列表。原 70+ 命令的本地解析逻辑保留作为离线降级。
**Migration**: 原 `commandCategories` 数据保留，仅在离线模式下作为命令速查面板显示。
