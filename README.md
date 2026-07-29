# 小林 AI

> 基于 Tauri 2.0 构建的对话型 AI 桌面助手，集成 70+ 实用功能，采用 iOS 26 液态玻璃设计语言。

**中文** | [English](./README.en.md)

## 特性

- **对话式 AI 助手**：基于 ReAct（思考→行动→观察→反思）循环，可自主分解并执行多步骤复杂任务
- **工具调用能力**：启动应用、打开网页、模拟鼠标键盘、截屏视觉识别、读写文件、管理进程、控制窗口、读取系统状态
- **多模型支持**：Ollama 本地、OpenAI、DeepSeek、智谱 AI、通义千问，以及自定义 API 端点
- **视觉识别**：截图通过视觉模型分析屏幕内容，支持 GUI 自动化操作
- **多对话管理**：左侧边栏管理多个独立对话，自动生成标题
- **用量监控**：Token 用量统计、费用估算、每日费用上限提醒
- **安全策略**：危险操作二次确认、按工具粒度开关、命令黑名单拦截
- **定时任务**：本地调度器，到期自动执行预设命令
- **自定义头像**：支持上传用户头像和 AI 头像
- **图片附件**：聊天输入支持粘贴/拖拽图片，多模态消息发送

## 技术栈

| 类别 | 技术 |
|---|---|
| 桌面框架 | Tauri 2.0 |
| 前端 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS + iOS 26 液态玻璃设计 |
| 动画 | Framer Motion |
| 后端 | Rust |
| 代码检查 | ESLint（类型感知规则）+ typescript-eslint |

## 快速开始

### 环境要求

- Node.js 20+
- Rust（需包含 cargo）
- Tauri 2.0 CLI

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 构建打包

```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/nsis/`。

## 项目结构

```
.
├── src/                    # 前端源码
│   ├── components/         # React 组件（玻璃 UI、对话、任务进度等）
│   ├── lib/                # 核心逻辑（agent、llm、tools、security 等）
│   ├── pages/              # 页面（CommandAI 主界面、Settings 设置）
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/              # Rust 后端
│   ├── src/lib.rs          # Tauri 命令定义
│   ├── capabilities/       # 权限配置
│   ├── icons/              # 应用图标
│   └── tauri.conf.json     # Tauri 配置
├── eslint.config.js        # ESLint 配置（类型感知）
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 配置

首次启动后，进入「设置」页面配置：

1. **API 配置**：选择预置模型（Ollama / OpenAI / DeepSeek / 智谱 / 通义）或自定义
2. **模型选择**：填写文本模型和视觉模型
3. **安全策略**：危险操作确认开关、命令黑名单、每日费用上限
4. **用量统计**：Token 用量和费用明细

### Ollama 本地配置

启动 Ollama 服务并设置跨域环境变量：

```bash
set OLLAMA_ORIGINS=*
ollama serve
```

推荐模型：`qwen2.5:7b-instruct-q4_K_M`（文本）+ `llava:7b`（视觉）

## 隐藏菜单

应用内置一个隐藏控制面板，包含：

- **快速开关**：用户活跃检测、危险操作确认、调试模式、强制离线模式
- **动态参数**：Agent 最大步数、空闲阈值、上下文条数、GUI 等待超时、截图重试次数、每日费用上限
- **调试诊断**：日志查看器、System Prompt 查看、存储占用估算、文本/视觉模型互换
- **批量操作**：立即执行所有定时任务、清空所有对话、清空所有定时任务、一键重置全部设置
- **快捷操作**：重启应用、进入完整设置

## 自动更新

应用内置 Tauri Updater，可通过「设置 → 关于 → 检查更新」自动下载安装最新版本。

## 许可证

Copyright © 2026 XiaoLin Studio
