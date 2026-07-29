// 小林 AI · 主对话界面
// 整合 LLM + ReAct Agent + 工具桥接 + 多对话管理 + 用量监控
// 在线模式：调用 runAgent 执行 ReAct 循环（thinking → tool_call → result → final）
// 离线模式：用 aiCommands.matchCommand 本地解析（降级方案，70+ 命令）

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Send, User, Settings as SettingsIcon,
  AlertTriangle, CheckCircle2, Loader2,
  PanelLeftClose, PanelLeftOpen, Square, WifiOff, Eraser,
  Zap, Clock, ImagePlus, X,
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
  loadLLMConfig, visionChat,
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 消息列表的 ref 镜像，供回调中读取最新值（避免闭包陷阱）
  const messagesRef = useRef<UIMessage[]>([]);
  messagesRef.current = messages;
  // 文件选择 input（隐藏，由按钮触发）
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const isOnline = llmConfig !== null;

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

      // 构造上下文消息：system + 最近 10 条历史（含用户和 AI 回复，保持多轮上下文）
      // UIMessage.role 为 "user" | "ai"，映射到 LLM 的 "user" | "assistant"
      const historyMessages: LLMChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
      ];
      const recent = messagesRef.current
        .filter((m) => m.id !== aiMsgId && m.text && (m.role === "user" || m.role === "ai"))
        .slice(-10);
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
    </div>
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
