// 小林 AI · 主对话界面
// 整合 LLM + ReAct Agent + 工具桥接 + 多对话管理 + 用量监控
// 在线模式：调用 runAgent 执行 ReAct 循环（thinking → tool_call → result → final）
// 离线模式：用 aiCommands.matchCommand 本地解析（降级方案，70+ 命令）

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, User, Settings as SettingsIcon,
  AlertTriangle, CheckCircle2, Loader2,
  PanelLeftClose, PanelLeftOpen, Square, WifiOff, Eraser,
  Zap, Clock, ImagePlus, X, Shield, Sparkles,
  FileText, Eye, Database, RefreshCw, Power,
  ToggleLeft, SlidersHorizontal, Bug, Layers,
} from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { LiquidButton } from "@/components/liquid/LiquidButton";
import { GlassButton } from "@/components/glass/GlassButton";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { TaskProgress } from "@/components/TaskProgress";
import { UsageBadge } from "@/components/UsageBadge";
import QuickActions from "@/components/QuickActions";
import SchedulerPanel from "@/components/SchedulerPanel";
import { cn } from "@/lib/utils";
import { startScheduler } from "@/lib/scheduler";
import { runAgent, SYSTEM_PROMPT, type AgentStep } from "@/lib/agent";
import {
  loadLLMConfig, saveLLMConfig, visionChat,
  type LLMConfig, type ChatMessage as LLMChatMessage,
  AuthError, NetworkError, RateLimitError, QuotaError,
} from "@/lib/llm";
import {
  createConversation, getConversation, getCurrentConversationId,
  setCurrentConversationId, deleteConversation, clearMessages,
  appendMessage, updateConversation, generateConversationTitle,
  listConversations,
  type ConversationMessage,
} from "@/lib/conversations";
import {
  matchCommand, executeCommand, chatReply,
  type AIResponse,
} from "@/lib/aiCommands";
import { loadUserAvatar, fileToDataUrl } from "@/lib/userAvatar";
import { loadSecurity, saveSecurity, type SecurityConfig } from "@/lib/security";
import {
  loadHiddenConfig, saveHiddenConfig, resetAllData, estimateStorageUsage, formatBytes,
  type HiddenConfig,
} from "@/lib/hiddenConfig";
import {
  installLogger, setRecording, getLogs, clearLogs, subscribeLogs,
  levelColorClass, formatTime, type LogEntry,
} from "@/lib/logger";
import { saveTasks, loadTasks } from "@/lib/scheduler";

// ---------- 类型与常量 ----------

export interface CommandAIProps {
  onOpenSettings?: () => void;
}

// UI 消息模型：支持用户文本 / AI 文本 / AI 任务步骤
interface ImageAttachment {
  url: string;        // data URL（data:image/png;base64,xxx）
  name?: string;      // 原始文件名
}

interface UIMessage {
  id: string;
  role: "user" | "ai";
  text?: string;                 // 用户消息 / AI 最终文本（离线模式结果）
  steps?: AgentStep[];           // AI ReAct 步骤（仅在线模式 AI 消息）
  isRunning?: boolean;           // 任务执行中
  status?: AIResponse["status"]; // 离线模式命令状态
  executed?: boolean;            // 离线模式是否真实执行
  timestamp: number;
  attachments?: ImageAttachment[]; // 用户发送的图片附件
  warning?: string;              // 警告提示（如视觉模型失败）
}

const QUICK_COMMANDS = ["截屏看看", "打开记事本", "搜索周杰伦", "当前时间", "获取系统状态"];
const MAX_STEPS = 20;
const WELCOME_TEXT = "你好！我是小林 AI，能自主操控你的电脑完成复杂任务。\n\n告诉我你想做什么，例如：\n· 「去 B 站搜索周杰伦并点赞」\n· 「打开记事本写一份会议纪要」\n· 「整理下载文件夹」\n\n未配置 API 时自动切换为离线命令模式（70+ 本地命令）。";

// 隐藏菜单触发序列：↑↑↓↓←→←→
const KONAMI_SEQUENCE = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
];
const KONAMI_RESET_MS = 2000; // 序列输入间隔超过此时间则重置

function genId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeWelcome(): UIMessage {
  return { id: genId(), role: "ai", text: WELCOME_TEXT, status: "info", timestamp: Date.now() };
}

// ConversationMessage → UIMessage 转换（用于加载历史对话）
function convMsgToUIMsg(m: ConversationMessage): UIMessage {
  // content 可能是 string 或 ContentPart[]（多模态），提取文本部分
  let text: string | undefined;
  if (typeof m.content === "string") {
    text = m.content || undefined;
  } else if (Array.isArray(m.content)) {
    text = m.content
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("\n") || undefined;
  }
  return {
    id: m.id,
    role: m.role === "user" ? "user" : "ai",
    text,
    attachments: (m as any).attachments,
    status: m.role === "assistant" ? "info" : undefined,
    timestamp: m.timestamp,
  };
}

// 错误友好提示
function friendlyError(err: any): string {
  if (err instanceof AuthError) return `🔐 ${err.message}`;
  if (err instanceof NetworkError) return `🌐 ${err.message}`;
  if (err instanceof RateLimitError) return `⏱️ ${err.message}`;
  if (err instanceof QuotaError) return `💰 ${err.message}`;
  if (err?.name === "AbortError") return "（任务已停止）";
  return `❌ ${err?.message || "未知错误"}`;
}

// ---------- 主组件 ----------

export default function CommandAI({ onOpenSettings }: CommandAIProps) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentConversationId, setCurrentConvId] = useState<string | null>(null);
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // 浮动面板开关：快捷指令 / 定时任务
  const [quickOpen, setQuickOpen] = useState(false);
  const [schedOpen, setSchedOpen] = useState(false);
  // 待发送的图片附件
  const [pendingAttachments, setPendingAttachments] = useState<ImageAttachment[]>([]);
  // 用户自定义头像
  const [userAvatar, setUserAvatar] = useState<string | null>(() => loadUserAvatar());
  // 隐藏菜单（通过 ↑↑↓↓←→←→ 触发）
  const [hiddenMenuOpen, setHiddenMenuOpen] = useState(false);
  // 安全策略快速开关（隐藏菜单内可调整）
  const [security, setSecurity] = useState<SecurityConfig>(loadSecurity);
  // 隐藏配置：动态参数 + 调试开关（隐藏菜单内可调整）
  const [hiddenConfig, setHiddenConfig] = useState<HiddenConfig>(loadHiddenConfig);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 消息列表的 ref 镜像，供回调中读取最新值（避免闭包陷阱）
  const messagesRef = useRef<UIMessage[]>([]);
  messagesRef.current = messages;
  // 文件选择 input（隐藏，由按钮触发）
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 隐藏菜单键盘序列检测：记录当前已匹配的位置
  const konamiPosRef = useRef(0);
  const konamiLastTimeRef = useRef(0);

  // 添加图片文件到待发送附件（限制最多 5 张，单张 10MB）
  const addImageFiles = useCallback(async (files: FileList | File[]) => {
    const MAX_IMAGES = 5;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (imageFiles.length === 0) return;
    // 过滤超大图片
    const valid = imageFiles.filter((f) => f.size <= MAX_SIZE);
    if (valid.length < imageFiles.length) {
      console.warn(`${imageFiles.length - valid.length} 张图片超过 10MB 已忽略`);
    }
    try {
      const dataUrls = await Promise.all(
        valid.map((f) => fileToDataUrl(f).then((url) => ({ url, name: f.name })))
      );
      setPendingAttachments((prev) => {
        const merged = [...prev, ...dataUrls];
        // 超过上限时只保留最后 MAX_IMAGES 张
        return merged.length > MAX_IMAGES ? merged.slice(-MAX_IMAGES) : merged;
      });
    } catch (e) {
      console.error("图片加载失败:", e);
    }
  }, []);

  // 粘贴事件处理：提取剪贴板中的图片
  // 注意：同时有文本和图片时只处理图片（文本需用户主动粘贴到输入框）
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addImageFiles(imageFiles);
      }
    },
    [addImageFiles]
  );

  // 拖拽事件处理
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        addImageFiles(files);
      }
    },
    [addImageFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const isOnline = llmConfig !== null && !hiddenConfig.forceOffline;

  // 初始化：加载 LLM 配置 + 加载或创建当前对话
  useEffect(() => {
    setLlmConfig(loadLLMConfig());

    let convId = getCurrentConversationId();
    let conv = convId ? getConversation(convId) : null;
    if (!conv) {
      conv = createConversation("新对话");
      convId = conv.id;
      setCurrentConversationId(convId);
    }
    setCurrentConvId(convId);

    const uiMsgs = conv.messages.map(convMsgToUIMsg);
    setMessages(uiMsgs.length > 0 ? uiMsgs : [makeWelcome()]);
  }, []);

  // 安装日志拦截器 + 同步调试模式开关
  // 仅安装一次，recording 状态由 hiddenConfig.debugMode 控制
  useEffect(() => {
    installLogger();
    setRecording(loadHiddenConfig().debugMode);
  }, []);

  // 监听用户头像变更事件（设置页上传/清除头像时触发）
  useEffect(() => {
    const handler = () => setUserAvatar(loadUserAvatar());
    window.addEventListener("user-avatar-changed", handler);
    return () => window.removeEventListener("user-avatar-changed", handler);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  // 重新读取 LLM 配置（每次发送前调用，以应用设置页改动）
  const reloadConfig = useCallback(() => {
    const cfg = loadLLMConfig();
    setLlmConfig(cfg);
    return cfg;
  }, []);

  // 更新指定消息（按 id）
  const updateMessage = useCallback((id: string, patch: Partial<UIMessage>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
  }, []);

  // 追加步骤到指定 AI 消息
  const appendStep = useCallback((id: string, step: AgentStep) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, steps: [...(m.steps ?? []), step] } : m
      )
    );
  }, []);

  // 发送消息
  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      const attachments = text ? [] : pendingAttachments;
      // 文本或附件至少有一个才发送
      if ((!content && attachments.length === 0) || loading) return;

      setInput("");
      setPendingAttachments([]);
      setLoading(true);

      const now = Date.now();
      const userMsg: UIMessage = {
        id: genId(),
        role: "user",
        text: content || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        timestamp: now,
      };
      const aiMsgId = genId();
      const aiMsg: UIMessage = {
        id: aiMsgId,
        role: "ai",
        steps: [],
        isRunning: true,
        timestamp: now + 1,
      };
      setMessages((prev) => [...prev, userMsg, aiMsg]);

      // 持久化用户消息到对话
      const convId = currentConversationId;
      if (convId) {
        appendMessage(convId, {
          id: userMsg.id,
          role: "user",
          content,
          timestamp: now,
          attachments: attachments.length > 0 ? attachments : undefined,
        } as any);
        // 首条消息自动生成对话标题
        const conv = getConversation(convId);
        if (conv && conv.messages.length <= 1) {
          const title = generateConversationTitle(content || "图片消息");
          updateConversation(convId, { title });
        }
      }

      const cfg = reloadConfig();
      if (cfg) {
        await runAgentFlow(cfg, aiMsgId, content, convId, attachments);
      } else {
        await offlineFlow(aiMsgId, content || "（图片消息）", convId);
      }

      setLoading(false);
      setRefreshTrigger((v) => v + 1);
    },
    [input, loading, currentConversationId, reloadConfig, pendingAttachments]
  );

  // handleSend 的 ref 镜像：供 scheduler 回调读取最新实现，避免闭包陷阱
  // （scheduler 仅在挂载时启动一次，但回调里需调用最新的 handleSend）
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;

  // 启动本地定时任务调度器：到期任务把 command 作为用户输入发送给 AI
  useEffect(() => {
    const stopScheduler = startScheduler((task) => {
      handleSendRef.current(task.command);
    });
    return stopScheduler;
  }, []);

  // 隐藏菜单：监听 ↑↑↓↓←→←→ 键盘序列
  // 即使输入框聚焦也检测（方向键光标移动不影响序列匹配）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 隐藏菜单已打开时不再触发（按 Esc 关闭）
      if (hiddenMenuOpen) return;

      const key = e.key;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return;

      const now = Date.now();
      // 间隔超时则重置序列
      if (now - konamiLastTimeRef.current > KONAMI_RESET_MS) {
        konamiPosRef.current = 0;
      }
      konamiLastTimeRef.current = now;

      const expected = KONAMI_SEQUENCE[konamiPosRef.current];
      if (key === expected) {
        konamiPosRef.current += 1;
        if (konamiPosRef.current === KONAMI_SEQUENCE.length) {
          konamiPosRef.current = 0;
          setHiddenMenuOpen(true);
          // 重新读取最新安全配置
          setSecurity(loadSecurity());
        }
      } else {
        // 不匹配：若当前键恰好是序列首键则从 1 开始，否则归零
        konamiPosRef.current = key === KONAMI_SEQUENCE[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hiddenMenuOpen]);

  // 安全配置变更时持久化
  const updateSecurity = useCallback((patch: Partial<SecurityConfig>) => {
    setSecurity((prev) => {
      const next = { ...prev, ...patch };
      saveSecurity(next);
      return next;
    });
  }, []);

  // 隐藏配置变更时持久化 + 同步调试模式开关
  const updateHiddenConfig = useCallback((patch: Partial<HiddenConfig>) => {
    setHiddenConfig((prev) => {
      const next = { ...prev, ...patch };
      saveHiddenConfig(next);
      // 调试模式变更时同步 logger recording 状态
      if (patch.debugMode !== undefined) {
        setRecording(patch.debugMode);
      }
      return next;
    });
  }, []);

  // 批量操作：清空所有对话（保留当前会话壳，重置为欢迎页）
  const handleClearAllConversations = useCallback(() => {
    const convs = listConversations();
    for (const c of convs) {
      deleteConversation(c.id);
    }
    // 创建新会话作为当前会话
    const newConv = createConversation("新对话");
    setCurrentConversationId(newConv.id);
    setCurrentConvId(newConv.id);
    setMessages([makeWelcome()]);
    setRefreshTrigger((n) => n + 1);
  }, []);

  // 批量操作：清空所有定时任务
  const handleClearAllTasks = useCallback(() => {
    saveTasks([]);
    setRefreshTrigger((n) => n + 1);
  }, []);

  // 批量操作：立即执行所有启用的定时任务
  const handleRunAllTasks = useCallback(() => {
    const tasks = loadTasks().filter((t) => t.enabled);
    for (const task of tasks) {
      handleSendRef.current(task.command);
    }
  }, []);

  // 批量操作：一键重置全部设置（清空所有 localStorage）
  const handleResetAll = useCallback(() => {
    resetAllData();
    // 重置后重新加载所有状态
    setSecurity(loadSecurity());
    setHiddenConfig(loadHiddenConfig());
    setLlmConfig(loadLLMConfig());
    setRecording(false);
    // 创建新会话
    const newConv = createConversation("新对话");
    setCurrentConversationId(newConv.id);
    setCurrentConvId(newConv.id);
    setMessages([makeWelcome()]);
    setUserAvatar(loadUserAvatar());
    setRefreshTrigger((n) => n + 1);
  }, []);

  // 快捷操作：文本/视觉模型互换
  const handleSwapModels = useCallback(() => {
    const cfg = loadLLMConfig();
    if (!cfg) return;
    const next = { ...cfg, model: cfg.visionModel, visionModel: cfg.model };
    saveLLMConfig(next);
    setLlmConfig(next);
  }, []);

  // 快捷操作：重启应用（Tauri 环境）
  const handleRelaunch = useCallback(async () => {
    try {
      const mod = await import("@tauri-apps/plugin-process");
      await mod.relaunch();
    } catch {
      console.warn("重启失败：非 Tauri 环境或插件不可用");
    }
  }, []);

  // 在线模式：ReAct Agent 流程
  const runAgentFlow = useCallback(
    async (
      cfg: LLMConfig,
      aiMsgId: string,
      userText: string,
      convId: string | null,
      attachments: ImageAttachment[] = []
    ) => {
      const controller = new AbortController();
      abortRef.current = controller;

      // 构造上下文消息：system + 最近 N 条历史（N 由隐藏菜单 contextMessageCount 控制，默认 10）
      // UIMessage.role 为 "user" | "ai"，映射到 LLM 的 "user" | "assistant"
      const ctxCount = loadHiddenConfig().contextMessageCount;
      const historyMessages: LLMChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
      ];
      const recent = messagesRef.current
        .filter((m) => m.id !== aiMsgId && m.text && (m.role === "user" || m.role === "ai"))
        .slice(-ctxCount);
      for (const m of recent) {
        // 跳过正在运行或错误的消息，避免脏数据污染上下文
        if (m.isRunning) continue;
        historyMessages.push({
          role: m.role === "ai" ? "assistant" : "user",
          content: m.text || "",
        });
      }

      // 当前用户消息：若有图片附件，先用视觉模型把图片转为文字描述
      // （文本模型如 qwen2.5 不支持多模态，直接发会报 400 错误）
      let finalUserText = userText;
      if (attachments.length > 0) {
        try {
          const visionResult = await visionChat({
            config: cfg,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "请详细描述这张图片的内容，包括可见的文字、UI 元素、场景、对象、颜色、布局等所有细节，以便后续基于描述进行分析。",
                  },
                  ...attachments.map((att) => ({
                    type: "image_url" as const,
                    image_url: { url: att.url },
                  })),
                ],
              },
            ],
            signal: controller.signal,
            conversationId: convId ?? undefined,
          });
          const imageDesc = visionResult.content || "（图片描述失败）";
          // 把图片描述拼接到用户文本后，作为纯文本发给文本模型
          finalUserText = [
            userText || "请分析这张图片。",
            "",
            "【图片内容描述】",
            imageDesc,
          ].join("\n");
        } catch (err) {
          // 视觉模型失败时，降级为纯文本提示，并在消息中标注图片未被识别
          console.warn("视觉模型解析失败，降级为纯文本:", err);
          finalUserText = [
            userText || "请分析这张图片。",
            "",
            "【系统提示】视觉模型解析图片失败，AI 无法识别图片内容，请基于用户文本回答。",
          ].join("\n");
          // 在 UI 上提示用户
          updateMessage(aiMsgId, {
            warning: "视觉模型解析图片失败，AI 将仅基于文本回答",
          });
        }
      }
      historyMessages.push({ role: "user", content: finalUserText });

      try {
        await runAgent({
          config: cfg,
          messages: historyMessages,
          conversationId: convId ?? undefined,
          maxSteps: MAX_STEPS,
          signal: controller.signal,
          callbacks: {
            // 统一通过 onStep 推送步骤到 UI
            onStep: (step) => {
              appendStep(aiMsgId, step);
              // final 步骤：标记完成 + 持久化 AI 回复
              if (step.type === "final") {
                const finalText = step.content || "";
                updateMessage(aiMsgId, {
                  text: finalText,
                  isRunning: false,
                });
                if (convId && finalText) {
                  appendMessage(convId, {
                    id: aiMsgId,
                    role: "assistant",
                    content: finalText,
                    timestamp: Date.now(),
                  });
                }
              } else if (step.type === "error") {
                // 错误步骤：标记失败
                updateMessage(aiMsgId, {
                  text: step.content,
                  isRunning: false,
                });
              }
            },
            onScreenshot: () => setRefreshTrigger((v) => v + 1),
          },
        });
      } catch (err: any) {
        // 中断错误由 onStep 的 error 步骤处理，此处兜底
        const msg = messagesRef.current.find((m) => m.id === aiMsgId);
        if (msg && msg.isRunning) {
          updateMessage(aiMsgId, {
            text: friendlyError(err),
            isRunning: false,
          });
        }
      } finally {
        abortRef.current = null;
        updateMessage(aiMsgId, { isRunning: false });
      }
    },
    [appendStep, updateMessage]
  );

  // 离线模式：本地命令解析
  const offlineFlow = useCallback(
    async (aiMsgId: string, userText: string, convId: string | null) => {
      // 模拟思考延迟
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

      const cmd = matchCommand(userText);
      let resp: AIResponse;
      if (cmd) {
        resp = await executeCommand(cmd, userText);
      } else {
        resp = chatReply(userText);
      }

      updateMessage(aiMsgId, {
        text: resp.text,
        status: resp.status,
        executed: resp.executed,
        isRunning: false,
      });

      // 持久化 AI 回复
      if (convId) {
        appendMessage(convId, {
          id: aiMsgId,
          role: "assistant",
          content: resp.text,
          timestamp: Date.now(),
        });
      }
    },
    [updateMessage]
  );

  // 停止生成
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    // 立即更新 UI（agent 的 error 步骤会随后到达）
    setMessages((prev) =>
      prev.map((m) =>
        m.isRunning
          ? { ...m, isRunning: false, text: m.text || "（已停止）" }
          : m
      )
    );
  }, []);

  // 清空当前对话
  const handleClear = useCallback(() => {
    if (!currentConversationId) return;
    if (!window.confirm("确认清空当前对话的所有消息？")) return;
    clearMessages(currentConversationId);
    setMessages([makeWelcome()]);
    setRefreshTrigger((v) => v + 1);
  }, [currentConversationId]);

  // 新建对话
  const handleNewConversation = useCallback(() => {
    const conv = createConversation("新对话");
    setCurrentConversationId(conv.id);
    setCurrentConvId(conv.id);
    setMessages([makeWelcome()]);
    setRefreshTrigger((v) => v + 1);
  }, []);

  // 切换对话
  const handleSelectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    setCurrentConvId(id);
    const conv = getConversation(id);
    if (conv) {
      const uiMsgs = conv.messages.map(convMsgToUIMsg);
      setMessages(uiMsgs.length > 0 ? uiMsgs : [makeWelcome()]);
    }
    setRefreshTrigger((v) => v + 1);
  }, []);

  // 删除对话
  const handleDeleteConversation = useCallback(
    (id: string) => {
      if (!window.confirm("确认删除此对话？")) return;
      deleteConversation(id);
      if (id === currentConversationId) {
        const remaining = listConversations();
        if (remaining.length > 0) {
          handleSelectConversation(remaining[0].id);
        } else {
          handleNewConversation();
        }
      }
      setRefreshTrigger((v) => v + 1);
    },
    [currentConversationId, handleSelectConversation, handleNewConversation]
  );

  return (
    <div className="relative flex h-full flex-col gap-3 overflow-hidden sm:gap-4">
      {/* ============ 顶部状态栏 ============ */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex shrink-0 items-center justify-between gap-3"
      >
        {/* 左：折叠/展开侧栏按钮 */}
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen((v) => !v)}
          className="shrink-0 px-2.5"
          title={sidebarOpen ? "折叠侧栏" : "展开侧栏"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </GlassButton>

        {/* 中：应用名 + 模型名 + 在线状态 */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl glass-tile-edge glass-shine">
            <img
              src="/ai-avatar.png"
              alt="小林 AI"
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-sm font-semibold text-white">小林 AI</h1>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="truncate text-argent-400">
                {isOnline ? llmConfig?.model || "未配置模型" : "离线模式"}
              </span>
              <OnlineIndicator online={isOnline} />
            </div>
          </div>
        </div>

        {/* 右：用量徽章 + 停止 + 清空 + 设置 */}
        <div className="flex shrink-0 items-center gap-1.5">
          <UsageBadge
            conversationId={currentConversationId ?? undefined}
            refreshTrigger={refreshTrigger}
            className="hidden sm:inline-flex"
          />
          {loading && (
            <GlassButton
              variant="danger"
              size="sm"
              onClick={handleStop}
              className="shrink-0 px-2.5"
              title="停止生成"
            >
              <Square className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">停止</span>
            </GlassButton>
          )}
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="shrink-0 px-2.5"
            title="清空对话"
          >
            <Eraser className="h-4 w-4" />
          </GlassButton>
          {/* 快捷指令面板触发按钮 */}
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => setQuickOpen(true)}
            className="shrink-0 px-2.5"
            title="快捷指令"
          >
            <Zap className="h-4 w-4" />
          </GlassButton>
          {/* 定时任务面板触发按钮 */}
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => setSchedOpen(true)}
            className="shrink-0 px-2.5"
            title="定时任务"
          >
            <Clock className="h-4 w-4" />
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => onOpenSettings?.()}
            className="shrink-0 px-2.5"
            title="设置"
          >
            <SettingsIcon className="h-4 w-4" />
          </GlassButton>
        </div>
      </motion.header>

      {/* ============ 主区域：侧栏 + 对话区 ============ */}
      <main className="relative flex min-h-0 flex-1 gap-3 sm:gap-4">
        <ConversationSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          refreshTrigger={refreshTrigger}
        />

        <GlassCard className="glass-shine flex min-w-0 flex-1 flex-col p-0">
          {/* 离线模式提示条 */}
          {!isOnline && (
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-2 text-xs text-argent-300">
              <WifiOff className="h-3.5 w-3.5 text-argent-400" />
              <span>离线模式 · 本地命令解析（未配置 API）</span>
            </div>
          )}

          {/* 消息流 */}
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} userAvatar={userAvatar} />
              ))}
            </div>
          </div>

          {/* 输入区 */}
          <div className="shrink-0 border-t border-white/10 p-3 sm:p-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-2">
              {/* 待发送图片附件预览 */}
              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 rounded-2xl glass-tile p-2">
                  {pendingAttachments.map((att, i) => (
                    <div key={i} className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg glass-tile-edge">
                      <img
                        src={att.url}
                        alt={att.name || "附件"}
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={() =>
                          setPendingAttachments((prev) =>
                            prev.filter((_, idx) => idx !== i)
                          )
                        }
                        className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-lg rounded-tr-lg bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        title="移除"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                {/* 图片上传按钮 */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl glass-tile glass-tile-edge text-argent-300 transition-colors hover:text-white disabled:opacity-50"
                  title="上传图片"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addImageFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  onPaste={handlePaste}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  rows={1}
                  placeholder={
                    isOnline
                      ? "告诉 AI 你想做什么...（可粘贴/拖拽图片）"
                      : "输入命令，如「关机」「计算 1+2」「当前时间」..."
                  }
                  className="max-h-32 min-h-[44px] w-full resize-none rounded-2xl glass-tile glass-tile-edge px-4 py-3 text-sm text-white placeholder:text-argent-500 focus:outline-none focus:ring-1 focus:ring-titanium-500/40"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                {/* 左：快捷指令 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-argent-500">快捷：</span>
                  {QUICK_COMMANDS.map((kw) => (
                    <button
                      key={kw}
                      onClick={() => handleSend(kw)}
                      disabled={loading}
                      className="rounded-full glass-tile glass-tile-edge px-2.5 py-0.5 text-[10px] text-argent-300 transition-colors hover:text-white disabled:opacity-50"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
                {/* 右：发送按钮 */}
                <LiquidButton
                  variant="primary"
                  shimmer
                  size="md"
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && pendingAttachments.length === 0) || loading}
                  className="shrink-0"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {loading ? "执行中" : "发送"}
                  </span>
                </LiquidButton>
              </div>
            </div>
          </div>
        </GlassCard>
      </main>

      {/* ============ 浮动面板：快捷指令 / 定时任务 ============ */}
      <QuickActions
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onAction={(cmd) => {
          setQuickOpen(false);
          // 复用现有 handleSend 逻辑，把指令作为用户输入发送
          handleSend(cmd);
        }}
      />
      <SchedulerPanel
        open={schedOpen}
        onClose={() => setSchedOpen(false)}
        onTrigger={(cmd) => {
          // 任务触发时把指令作为用户输入发送（同 handleSend）
          handleSend(cmd);
        }}
      />

      {/* ============ 隐藏菜单（↑↑↓↓←→←→ 触发）============ */}
      <HiddenMenu
        open={hiddenMenuOpen}
        onClose={() => setHiddenMenuOpen(false)}
        security={security}
        onUpdateSecurity={updateSecurity}
        hiddenConfig={hiddenConfig}
        onUpdateHiddenConfig={updateHiddenConfig}
        onClearAllConversations={handleClearAllConversations}
        onClearAllTasks={handleClearAllTasks}
        onRunAllTasks={handleRunAllTasks}
        onResetAll={handleResetAll}
        onSwapModels={handleSwapModels}
        onRelaunch={handleRelaunch}
        onOpenSettings={() => {
          setHiddenMenuOpen(false);
          onOpenSettings?.();
        }}
      />
    </div>
  );
}

// ============================================================
// 隐藏菜单组件
// ============================================================

interface HiddenMenuProps {
  open: boolean;
  onClose: () => void;
  security: SecurityConfig;
  onUpdateSecurity: (patch: Partial<SecurityConfig>) => void;
  hiddenConfig: HiddenConfig;
  onUpdateHiddenConfig: (patch: Partial<HiddenConfig>) => void;
  onClearAllConversations: () => void;
  onClearAllTasks: () => void;
  onRunAllTasks: () => void;
  onResetAll: () => void;
  onSwapModels: () => void;
  onRelaunch: () => void;
  onOpenSettings: () => void;
}

function HiddenMenu({
  open, onClose, security, onUpdateSecurity,
  hiddenConfig, onUpdateHiddenConfig,
  onClearAllConversations, onClearAllTasks, onRunAllTasks,
  onResetAll, onSwapModels, onRelaunch,
  onOpenSettings,
}: HiddenMenuProps) {
  // 顶部 Tab 分类：toggles=开关 / params=参数 / debug=调试 / batch=批量 / quick=快捷
  type TabKey = "toggles" | "params" | "debug" | "batch" | "quick";
  // 子面板视图：main=主菜单（Tab 切换），logs/prompt/storage=子详情页
  type ViewKey = "main" | "logs" | "prompt" | "storage";
  const [view, setView] = useState<ViewKey>("main");
  const [tab, setTab] = useState<TabKey>("toggles");
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const TABS: Array<{ key: TabKey; label: string; icon: typeof ToggleLeft }> = [
    { key: "toggles", label: "开关", icon: ToggleLeft },
    { key: "params", label: "参数", icon: SlidersHorizontal },
    { key: "debug", label: "调试", icon: Bug },
    { key: "batch", label: "批量", icon: Layers },
    { key: "quick", label: "快捷", icon: Zap },
  ];

  // Esc 关闭：子视图先返回 main，main 再关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (view !== "main") setView("main");
        else onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, view]);

  // 订阅日志更新（仅 logs 视图时订阅）
  useEffect(() => {
    if (!open || view !== "logs") return;
    setLogs(getLogs());
    const unsub = subscribeLogs((entries) => setLogs(entries));
    return unsub;
  }, [open, view]);

  // 打开时重置到主视图 + 第一个 Tab
  useEffect(() => {
    if (open) {
      setView("main");
      setTab("toggles");
      setConfirmAction(null);
    }
  }, [open]);

  // 执行需二次确认的操作
  const runConfirmed = (action: string, fn: () => void) => {
    if (confirmAction === action) {
      fn();
      setConfirmAction(null);
    } else {
      setConfirmAction(action);
      window.setTimeout(() => setConfirmAction((cur) => (cur === action ? null : cur)), 3000);
    }
  };

  // 子视图标题
  const subTitle =
    view === "logs" ? "运行日志" :
    view === "prompt" ? "系统提示词" :
    view === "storage" ? "存储占用" : "隐藏控制面板";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* 背景毛玻璃遮罩 */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />

          {/* 菜单面板：左侧 Tab 导航 + 右侧内容区 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong glass-edge glass-shine relative z-10 flex w-full max-w-2xl max-h-[88vh] overflow-hidden rounded-3xl p-5 shadow-2xl"
          >
            {/* 顶部标题栏（绝对定位浮在面板上方） */}
            <div className="absolute left-5 top-5 z-20 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-titanium-500/30 to-titanium-700/20 glass-tile-edge">
                <Sparkles className="h-3.5 w-3.5 text-titanium-200" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">{subTitle}</span>
                <span className="text-[10px] text-argent-400">↑ ↑ ↓ ↓ ← → ← →</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-5 top-5 z-20 rounded-lg p-1.5 text-argent-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            {/* ============ 主视图：左侧 Tab + 右侧内容 ============ */}
            {view === "main" && (
              <div className="flex w-full gap-4 pt-14">
                {/* 左侧垂直 Tab 导航栏 */}
                <div className="flex w-24 shrink-0 flex-col gap-1 rounded-2xl border border-white/10 bg-base-900/40 p-1.5">
                  {TABS.map((t) => {
                    const Icon = t.icon;
                    const active = tab === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => { setTab(t.key); setConfirmAction(null); }}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-[11px] font-medium transition-all",
                          active
                            ? "bg-gradient-to-br from-titanium-500/30 to-titanium-700/20 text-titanium-100 glass-tile-edge"
                            : "text-argent-300 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* 右侧内容区 */}
                <div className="flex-1 overflow-y-auto pr-1 min-h-[280px]">
                  {/* ---- 开关 Tab ---- */}
                  {tab === "toggles" && (
                    <div className="flex flex-col gap-2">
                      <ToggleRow
                        label="用户活跃检测"
                        desc={security.userActivityDetection ? "用户操作时排队等待" : "AI 始终自主执行"}
                        checked={security.userActivityDetection}
                        onChange={(v) => onUpdateSecurity({ userActivityDetection: v })}
                      />
                      <ToggleRow
                        label="危险操作确认"
                        desc={security.confirmDangerous ? "执行前需确认" : "全部直接执行"}
                        checked={security.confirmDangerous}
                        onChange={(v) => onUpdateSecurity({ confirmDangerous: v })}
                      />
                      <ToggleRow
                        label="调试模式"
                        desc={hiddenConfig.debugMode ? "记录 console 日志" : "不记录日志"}
                        checked={hiddenConfig.debugMode}
                        onChange={(v) => onUpdateHiddenConfig({ debugMode: v })}
                      />
                      <ToggleRow
                        label="强制离线模式"
                        desc={hiddenConfig.forceOffline ? "走本地 70+ 命令" : "使用 API 在线模式"}
                        checked={hiddenConfig.forceOffline}
                        onChange={(v) => onUpdateHiddenConfig({ forceOffline: v })}
                      />
                    </div>
                  )}

                  {/* ---- 参数 Tab ---- */}
                  {tab === "params" && (
                    <div className="flex flex-col gap-2">
                      <NumberRow
                        label="Agent 最大步数"
                        desc="复杂任务需要更多步"
                        value={hiddenConfig.maxSteps}
                        min={1}
                        max={100}
                        onChange={(v) => onUpdateHiddenConfig({ maxSteps: v })}
                      />
                      <NumberRow
                        label="用户空闲阈值（秒）"
                        desc="超过此时间无输入视为空闲"
                        value={hiddenConfig.idleThresholdSeconds}
                        min={10}
                        max={3600}
                        onChange={(v) => onUpdateHiddenConfig({ idleThresholdSeconds: v })}
                      />
                      <NumberRow
                        label="历史上下文条数"
                        desc="影响多轮对话记忆"
                        value={hiddenConfig.contextMessageCount}
                        min={0}
                        max={50}
                        onChange={(v) => onUpdateHiddenConfig({ contextMessageCount: v })}
                      />
                      <NumberRow
                        label="GUI 等待超时（分钟）"
                        desc="超时后强制执行"
                        value={Math.round(hiddenConfig.guiWaitTimeoutMs / 60000)}
                        min={1}
                        max={60}
                        onChange={(v) => onUpdateHiddenConfig({ guiWaitTimeoutMs: v * 60000 })}
                      />
                      <NumberRow
                        label="截图失败重试次数"
                        desc="超限后不再自动截图"
                        value={hiddenConfig.autoScreenshotMaxFailures}
                        min={0}
                        max={10}
                        onChange={(v) => onUpdateHiddenConfig({ autoScreenshotMaxFailures: v })}
                      />
                      <NumberRow
                        label="每日费用上限（元）"
                        desc="超过后拦截任务（0=不限）"
                        value={security.dailyCostLimit}
                        min={0}
                        max={1000}
                        onChange={(v) => onUpdateSecurity({ dailyCostLimit: v })}
                      />
                    </div>
                  )}

                  {/* ---- 调试 Tab ---- */}
                  {tab === "debug" && (
                    <div className="grid grid-cols-2 gap-2">
                      <ActionButton onClick={() => setView("logs")} icon={<FileText className="h-4 w-4" />}>
                        日志查看器
                      </ActionButton>
                      <ActionButton onClick={() => setView("prompt")} icon={<Eye className="h-4 w-4" />}>
                        System Prompt
                      </ActionButton>
                      <ActionButton onClick={() => setView("storage")} icon={<Database className="h-4 w-4" />}>
                        存储占用
                      </ActionButton>
                      <ActionButton onClick={onSwapModels} icon={<RefreshCw className="h-4 w-4" />}>
                        模型互换
                      </ActionButton>
                    </div>
                  )}

                  {/* ---- 批量 Tab ---- */}
                  {tab === "batch" && (
                    <div className="flex flex-col gap-2">
                      <DangerButton
                        onClick={() => runConfirmed("runAll", onRunAllTasks)}
                        confirming={confirmAction === "runAll"}
                        confirmText="再次点击确认执行"
                        icon={<Zap className="h-4 w-4" />}
                      >
                        立即执行所有定时任务
                      </DangerButton>
                      <DangerButton
                        onClick={() => runConfirmed("clearConv", onClearAllConversations)}
                        confirming={confirmAction === "clearConv"}
                        confirmText="再次点击确认清空"
                        icon={<Eraser className="h-4 w-4" />}
                      >
                        清空所有对话
                      </DangerButton>
                      <DangerButton
                        onClick={() => runConfirmed("clearTasks", onClearAllTasks)}
                        confirming={confirmAction === "clearTasks"}
                        confirmText="再次点击确认清空"
                        icon={<Clock className="h-4 w-4" />}
                      >
                        清空所有定时任务
                      </DangerButton>
                      <DangerButton
                        onClick={() => runConfirmed("resetAll", onResetAll)}
                        confirming={confirmAction === "resetAll"}
                        confirmText="⚠️ 再次点击确认重置！"
                        icon={<AlertTriangle className="h-4 w-4" />}
                        variant="critical"
                      >
                        一键重置全部设置
                      </DangerButton>
                    </div>
                  )}

                  {/* ---- 快捷 Tab ---- */}
                  {tab === "quick" && (
                    <div className="grid grid-cols-2 gap-2">
                      <ActionButton onClick={onRelaunch} icon={<Power className="h-4 w-4" />}>
                        重启应用
                      </ActionButton>
                      <ActionButton onClick={onOpenSettings} icon={<Shield className="h-4 w-4" />}>
                        完整设置
                      </ActionButton>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 底部提示（主视图时） */}
            {view === "main" && (
              <p className="absolute bottom-3 left-0 right-0 text-center text-[10px] text-argent-400">
                按 Esc 或点击空白处关闭
              </p>
            )}

            {/* ============ 日志查看器子视图 ============ */}
            {view === "logs" && (
              <div className="flex w-full flex-col gap-3 pt-14">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-argent-300">
                    共 {logs.length} 条 {hiddenConfig.debugMode ? "" : "（调试模式未开启，无新日志）"}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearLogs()}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-argent-200 hover:bg-white/10"
                  >
                    清空
                  </button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-white/10 bg-base-900/40 p-2 font-mono text-[11px] leading-relaxed">
                  {logs.length === 0 ? (
                    <div className="py-8 text-center text-argent-400">暂无日志</div>
                  ) : (
                    logs.slice().reverse().map((log, i) => (
                      <div key={i} className="border-b border-white/5 px-1 py-1">
                        <span className="text-argent-400">{formatTime(log.timestamp)}</span>
                        <span className={cn("ml-2 font-semibold", levelColorClass(log.level))}>
                          [{log.level.toUpperCase()}]
                        </span>
                        <span className="ml-2 text-argent-100 break-all">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setView("main")}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
                >
                  返回
                </button>
              </div>
            )}

            {/* ============ System Prompt 子视图 ============ */}
            {view === "prompt" && (
              <div className="flex w-full flex-col gap-3 pt-14">
                <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-white/10 bg-base-900/40 p-3 text-[11px] leading-relaxed text-argent-100 whitespace-pre-wrap">
                  {SYSTEM_PROMPT}
                </div>
                <button
                  type="button"
                  onClick={() => setView("main")}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
                >
                  返回
                </button>
              </div>
            )}

            {/* ============ 存储占用子视图 ============ */}
            {view === "storage" && (
              <div className="w-full pt-14">
                <StorageView onBack={() => setView("main")} />
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 存储占用子视图
function StorageView({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState(() => estimateStorageUsage());

  // 每次打开刷新一次
  useEffect(() => {
    setData(estimateStorageUsage());
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-argent-300">
          总占用：<span className="font-semibold text-white">{formatBytes(data.totalBytes)}</span>
        </span>
        <button
          type="button"
          onClick={() => setData(estimateStorageUsage())}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-argent-200 hover:bg-white/10"
        >
          刷新
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {data.items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <div className="flex flex-col">
              <span className="text-xs text-white">{item.label}</span>
              <span className="text-[10px] text-argent-400">{item.key}</span>
            </div>
            <span className={cn(
              "text-xs font-mono",
              item.bytes > 100 * 1024 ? "text-amber-300" : "text-argent-200"
            )}>
              {formatBytes(item.bytes)}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
      >
        返回
      </button>
    </div>
  );
}

// 开关行
function ToggleRow({
  label, desc, checked, onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="glass glass-edge rounded-2xl p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-white">{label}</span>
          <span className="text-[11px] text-argent-300">{desc}</span>
        </div>
        <MiniToggle checked={checked} onChange={onChange} />
      </div>
    </div>
  );
}

// 数字调节行
function NumberRow({
  label, desc, value, min, max, onChange,
}: {
  label: string;
  desc: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="glass glass-edge rounded-2xl p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-white">{label}</span>
          <span className="text-[11px] text-argent-300">{desc}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 1))}
            className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            −
          </button>
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, Math.round(v))));
            }}
            className="w-16 rounded-lg border border-white/10 bg-base-900/40 px-2 py-1 text-center text-sm text-white focus:border-titanium-500/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => onChange(Math.min(max, value + 1))}
            className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

// 普通操作按钮
function ActionButton({
  onClick, icon, children,
}: {
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white transition-colors hover:bg-white/10"
    >
      {icon}
      {children}
    </button>
  );
}

// 危险操作按钮（带二次确认）
function DangerButton({
  onClick, confirming, confirmText, icon, children, variant = "normal",
}: {
  onClick: () => void;
  confirming: boolean;
  confirmText: string;
  icon: ReactNode;
  children: ReactNode;
  variant?: "normal" | "critical";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors",
        confirming
          ? variant === "critical"
            ? "border-crimson-500/50 bg-crimson-500/20 text-crimson-200 animate-pulse"
            : "border-amber-500/50 bg-amber-500/20 text-amber-200"
          : variant === "critical"
            ? "border-crimson-500/30 bg-crimson-500/10 text-crimson-300 hover:bg-crimson-500/20"
            : "border-white/10 bg-white/5 text-white hover:bg-white/10"
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        {children}
      </div>
      {confirming && <span className="text-[11px] font-medium">{confirmText}</span>}
    </button>
  );
}

// 迷你玻璃开关（隐藏菜单专用，比 Settings 页更紧凑）
function MiniToggle({
  checked, onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 rounded-full border transition-colors",
        checked
          ? "bg-gradient-to-br from-titanium-500 to-titanium-700 border-titanium-500/50"
          : "bg-base-900/60 border-white/15"
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute rounded-full bg-white shadow"
        style={{ height: 15, width: 15, top: 1.5, left: checked ? 18 : 1.5 }}
      />
    </button>
  );
}

// ============================================================
// 子组件
// ============================================================

// 在线/离线状态指示器
function OnlineIndicator({ online }: { online: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          online ? "bg-emerald-400" : "bg-argent-500"
        )}
      />
      <span
        className={cn(
          "text-[10px]",
          online ? "text-emerald-400" : "text-argent-500"
        )}
      >
        {online ? "在线" : "离线"}
      </span>
    </span>
  );
}

// 消息气泡：根据消息类型渲染（用户文本 / AI 文本 / AI 任务步骤）
function MessageBubble({ message, userAvatar }: { message: UIMessage; userAvatar?: string | null }) {
  const isUser = message.role === "user";
  const hasSteps = !!(message.steps && message.steps.length > 0);
  const hasAttachments = !!(message.attachments && message.attachments.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}
    >
      <Avatar role={message.role} userAvatar={userAvatar} />
      <div className="flex min-w-0 max-w-[85%] flex-col gap-2">
        {/* AI 在线模式：步骤可视化（thinking/tool_call/final/error） */}
        {hasSteps && (
          <TaskProgress
            steps={message.steps!}
            isRunning={!!message.isRunning}
          />
        )}

        {/* 用户图片附件 */}
        {hasAttachments && (
          <div className={cn("flex flex-wrap gap-2", isUser && "justify-end")}>
            {message.attachments!.map((att, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl glass-tile-edge max-h-40 max-w-[200px]"
              >
                <img
                  src={att.url}
                  alt={att.name || "图片"}
                  className="max-h-40 max-w-[200px] object-contain"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        )}

        {/* 文本气泡：用户消息 / 离线模式 AI 回复 */}
        {message.text && !hasSteps && (
          <div
            className={cn(
              "relative whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed",
              isUser
                ? "rounded-tr-sm bg-gradient-to-br from-titanium-500/30 to-titanium-700/20 text-white glass-tile-edge"
                : cn(
                    "rounded-tl-sm glass-tile glass-tile-edge",
                    message.status === "error" && "text-crimson-300",
                    message.status === "success" && "text-argent-100",
                    message.status === "warning" && "text-argent-200",
                    (!message.status || message.status === "info") && "text-argent-100"
                  )
            )}
          >
            {/* 离线模式状态图标 */}
            {!isUser && message.status && message.status !== "info" && (
              <div className="mb-1.5 flex items-center gap-1.5">
                <StatusIcon status={message.status} />
                {message.executed && (
                  <span className="rounded-full glass-tile-strong px-1.5 py-0.5 text-[9px] text-titanium-400">
                    已执行
                  </span>
                )}
              </div>
            )}
            {message.text}
            <span className="mt-1.5 block text-right text-[9px] text-argent-500">
              {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// 头像
function Avatar({ role, userAvatar }: { role: "user" | "ai"; userAvatar?: string | null }) {
  if (role === "user") {
    // 用户头像：自定义 > 默认 User 图标
    if (userAvatar) {
      return (
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl glass-tile-edge glass-shine">
          <img
            src={userAvatar}
            alt="用户"
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>
      );
    }
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl glass-tile glass-tile-edge text-argent-300">
        <User className="h-4 w-4" />
      </div>
    );
  }
  // AI 头像：使用上传的「小林ai聊天头像.png」
  return (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl glass-tile-edge glass-shine">
      <img
        src="/ai-avatar.png"
        alt="小林 AI"
        className="h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}

// 状态图标（离线模式用）
function StatusIcon({ status }: { status: AIResponse["status"] }) {
  const cls = "h-3.5 w-3.5";
  if (status === "success")
    return <CheckCircle2 className={cn(cls, "text-titanium-400")} />;
  if (status === "error")
    return <AlertTriangle className={cn(cls, "text-crimson-400")} />;
  if (status === "warning")
    return <AlertTriangle className={cn(cls, "text-argent-300")} />;
  return null;
}
