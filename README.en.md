# XiaoLin AI

> A conversational AI desktop assistant built on Tauri 2.0, integrating 70+ practical features with an iOS 26 liquid glass design language.

[中文](./README.md) | **English**

## Features

- **Conversational AI Assistant**: Based on the ReAct (Think → Act → Observe → Reflect) loop, capable of autonomously decomposing and executing multi-step complex tasks
- **Tool Calling**: Launch apps, open web pages, simulate mouse/keyboard, screenshot visual recognition, read/write files, manage processes, control windows, read system state
- **Multi-Model Support**: Ollama (local), OpenAI, DeepSeek, Zhipu AI, Qwen, and custom API endpoints
- **Visual Recognition**: Screenshots analyzed by vision models to understand screen content, enabling GUI automation
- **Multi-Conversation Management**: Sidebar for managing multiple independent conversations with auto-generated titles
- **Usage Monitoring**: Token usage statistics, cost estimation, daily cost limit alerts
- **Security Policy**: Secondary confirmation for dangerous operations, per-tool toggles, command blocklist interception
- **Scheduled Tasks**: Local scheduler for automatic execution of preset commands
- **Custom Avatars**: Support uploading user and AI avatars
- **Image Attachments**: Chat input supports paste/drag images for multimodal messaging

## Tech Stack

| Category | Technology |
|---|---|
| Desktop Framework | Tauri 2.0 |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + iOS 26 Liquid Glass Design |
| Animation | Framer Motion |
| Backend | Rust |
| Linting | ESLint (type-aware rules) + typescript-eslint |

## Quick Start

### Prerequisites

- Node.js 20+
- Rust (including cargo)
- Tauri 2.0 CLI

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run tauri dev
```

### Build & Package

```bash
npm run tauri build
```

Build artifacts are located in `src-tauri/target/release/bundle/nsis/`.

## Project Structure

```
.
├── src/                    # Frontend source
│   ├── components/         # React components (glass UI, conversation, task progress, etc.)
│   ├── lib/                # Core logic (agent, llm, tools, security, etc.)
│   ├── pages/              # Pages (CommandAI main, Settings)
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/              # Rust backend
│   ├── src/lib.rs          # Tauri command definitions
│   ├── capabilities/       # Permission configuration
│   ├── icons/              # App icons
│   └── tauri.conf.json     # Tauri config
├── eslint.config.js        # ESLint config (type-aware)
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Configuration

After first launch, go to the "Settings" page to configure:

1. **API Config**: Choose a preset model (Ollama / OpenAI / DeepSeek / Zhipu / Qwen) or customize
2. **Model Selection**: Set text model and vision model
3. **Security Policy**: Dangerous operation confirmation toggles, command blocklist, daily cost limit
4. **Usage Statistics**: Token usage and cost details

### Ollama Local Configuration

Start the Ollama service and set the cross-origin environment variable:

```bash
set OLLAMA_ORIGINS=*
ollama serve
```

Recommended models: `qwen2.5:7b-instruct-q4_K_M` (text) + `llava:7b` (vision)

## Hidden Menu

The app includes a hidden control panel with:

- **Quick Toggles**: User activity detection, dangerous operation confirmation, debug mode, force offline mode
- **Dynamic Parameters**: Agent max steps, idle threshold, context message count, GUI wait timeout, screenshot retry count, daily cost limit
- **Diagnostics**: Log viewer, System Prompt viewer, storage usage estimator, text/vision model swap
- **Batch Operations**: Run all scheduled tasks, clear all conversations, clear all scheduled tasks, reset all settings
- **Quick Actions**: Restart app, open full settings

## Auto Update

The app has a built-in Tauri Updater. Go to "Settings → About → Check for Updates" to automatically download and install the latest version.

## License

Copyright © 2026 XiaoLin Studio
