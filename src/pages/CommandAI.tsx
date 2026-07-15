// 小林 AI 命令助手：聊天式交互界面（三栏布局）
// 左：分类侧栏（默认显示）  中：当前分类命令列表  右：聊天流 + 输入框
// 本地智能解析器识别关键词并执行真实操作（Tauri 桌面环境）
import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Sparkles, User, Trash2, Loader2,
  AlertTriangle, CheckCircle2, Info, X, Search, PanelLeftClose, PanelLeftOpen,
  Power, RotateCw, Moon, Lock, LogOut, XCircle, RefreshCw, Trash2 as TrashIcon,
  Calculator, FileText, Folder, Activity, Database, Terminal, TerminalSquare,
  Paintbrush, Settings, Cpu, Scissors, Clock, Keyboard, ZoomIn, Type as TypeIcon,
  Globe, Search as SearchIcon, Link as LinkIcon, Gauge, Plug, Route,
  Binary, Hash, Fingerprint, Code, Languages, KeyRound,
  CaseSensitive, Braces, ArrowLeftRight, ListChecks, ArrowDownUp, Replace, Regex,
  Calendar, CalendarDays, Timer, TrendingUp,
  Square, ChevronsUp, Triangle, Dices, BarChart3,
  Ruler, Weight, Thermometer,
  Palette, Pipette, Eye, Blend,
  GitBranch, Hexagon, Package, AlignLeft, Server,
  FolderOpen, List, FolderPlus, FileSearch,
  Copy, ClipboardPaste, Eraser, Clipboard,
  Monitor, BatteryCharging, Wifi, HelpCircle,
} from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { LiquidButton } from "@/components/liquid/LiquidButton";
import { cn } from "@/lib/utils";
import {
  aiCommands, commandCategories,
  matchCommand, executeCommand, chatReply,
  type AICommand, type AIResponse,
} from "@/lib/aiCommands";

// 图标映射
const iconMap: Record<string, typeof Power> = {
  Power, RotateCw, Moon, Lock, LogOut, XCircle, RefreshCw, Trash2: TrashIcon,
  Calculator, FileText, Folder, Activity, Database, Terminal, TerminalSquare,
  Paintbrush, Settings, Cpu, Scissors, Clock, Keyboard, ZoomIn, Type: TypeIcon,
  Globe, Search: SearchIcon, Link: LinkIcon, Gauge, Plug, Route,
  Binary, Hash, Fingerprint, Code, Languages, KeyRound,
  CaseSensitive, Braces, ArrowLeftRight, ListChecks, ArrowDownUp, Replace, Regex,
  Calendar, CalendarDays, Timer, TrendingUp,
  Square, ChevronsUp, Triangle, Dices, BarChart3,
  Ruler, Weight, Thermometer,
  Palette, Pipette, Eye, Blend,
  GitBranch, Hexagon, Package, AlignLeft, Server,
  FolderOpen, List, FolderPlus, FileSearch,
  Copy, ClipboardPaste, Eraser, Clipboard,
  Monitor, BatteryCharging, Wifi, HelpCircle,
  Info,
};

interface ChatMessage {
  id: number;
  role: "user" | "ai";
  text: string;
  status?: AIResponse["status"];
  executed?: boolean;
  timestamp: number;
}

export default function CommandAI() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "ai",
      text: "你好！我是小林 AI 助手。\n\n我集成了 70+ 实用功能，覆盖系统控制、快捷启动、网络工具、编码转换、文本处理、时间日期、数学计算、单位换算、颜色工具、开发工具、文件操作、剪贴板等。\n\n左侧点分类查看命令，或直接在下方输入命令。输入「帮助」查看完整列表。",
      status: "info",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("system");
  const [showPanel, setShowPanel] = useState(true); // 左侧面板默认显示
  const [search, setSearch] = useState("");
  const msgIdRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = {
      id: msgIdRef.current++,
      role: "user",
      text: content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));

    const cmd = matchCommand(content);
    let aiResp: AIResponse;
    if (cmd) {
      aiResp = await executeCommand(cmd, content);
    } else {
      aiResp = chatReply(content);
    }

    const aiMsg: ChatMessage = {
      id: msgIdRef.current++,
      role: "ai",
      text: aiResp.text,
      status: aiResp.status,
      executed: aiResp.executed,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, aiMsg]);
    setLoading(false);
  };

  const handleQuickCommand = (cmd: AICommand) => {
    if (cmd.danger) {
      if (!window.confirm(`⚠️ 即将执行危险操作：${cmd.title}\n\n${cmd.description}\n\n确认继续？`)) {
        return;
      }
    }
    handleSend(cmd.keywords[0]);
  };

  const handleClear = () => {
    setMessages([
      {
        id: msgIdRef.current++,
        role: "ai",
        text: "对话已清空。有什么可以帮你的？",
        status: "info",
        timestamp: Date.now(),
      },
    ]);
  };

  // 当前分类命令（支持搜索过滤）
  const currentCommands = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return aiCommands.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.keywords.some((k) => k.toLowerCase().includes(q)) ||
          c.description.toLowerCase().includes(q)
      );
    }
    return aiCommands.filter((c) => c.category === activeCategory);
  }, [activeCategory, search]);

  const activeCatInfo = commandCategories.find((c) => c.id === activeCategory);

  return (
    <div className="relative flex h-full flex-col gap-3 overflow-hidden sm:gap-4">
      {/* 顶部：返回 + 标题 + 工具栏 */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex shrink-0 items-center justify-between gap-3"
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <LiquidButton size="sm" variant="ghost" onClick={() => navigate("/")} className="shrink-0 px-2.5">
            <ArrowLeft className="h-4 w-4" />
          </LiquidButton>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl glass-tile-strong glass-tile-edge glass-shine text-titanium-500">
            <Sparkles className="relative z-10 h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-base font-semibold text-white">小林 AI 助手</h1>
            <span className="truncate text-[11px] text-argent-400">
              {aiCommands.length} 个命令 · 本地智能解析
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* 桌面端：切换面板挤压 */}
          <LiquidButton
            size="sm"
            variant="ghost"
            onClick={() => setShowPanel((v) => !v)}
            className="hidden px-2.5 md:inline-flex"
            title={showPanel ? "隐藏面板" : "显示面板"}
          >
            {showPanel ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </LiquidButton>
          {/* 移动端：打开面板浮层 */}
          <LiquidButton
            size="sm"
            variant="ghost"
            onClick={() => setShowPanel(true)}
            className="px-2.5 md:hidden"
            title="打开命令面板"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </LiquidButton>
          <LiquidButton size="sm" variant="ghost" onClick={handleClear} className="px-2.5" title="清空对话">
            <Trash2 className="h-4 w-4" />
          </LiquidButton>
        </div>
      </motion.header>

      {/* 主区域：三栏布局 */}
      <main className="relative flex min-h-0 flex-1 gap-3 sm:gap-4">
        {/* 左侧：分类侧栏 + 命令列表
            桌面端（md+）：根据 showPanel 挤压显示
            移动端（<md）：showPanel 为 true 时全屏浮层覆盖 */}
        <AnimatePresence mode="wait">
          {showPanel && (
            <motion.aside
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "shrink-0",
                // 桌面端：挤压显示
                "hidden md:block",
                // 移动端：浮层覆盖
                "max-md:!block max-md:absolute max-md:inset-0 max-md:z-30 max-md:w-full"
              )}
            >
              <GlassCard className="glass-shine flex h-full w-72 flex-col p-3 xl:w-80 max-md:w-full max-md:rounded-none">
                {/* 顶部：移动端关闭按钮 + 搜索框 */}
                <div className="flex shrink-0 items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-argent-500" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="搜索命令…"
                      className="w-full rounded-lg glass-tile glass-tile-edge py-2 pl-8 pr-7 text-xs text-white placeholder:text-argent-500 focus:outline-none focus:ring-1 focus:ring-titanium-500/40"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-argent-500 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {/* 移动端关闭按钮 */}
                  <button
                    onClick={() => setShowPanel(false)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg glass-tile text-argent-300 hover:text-white md:hidden"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* 分类标签列表（搜索时隐藏） */}
                {!search && (
                  <div className="mt-3 shrink-0 border-b border-white/10 pb-3">
                    <div className="mb-2 text-[10px] uppercase tracking-wider text-argent-500">
                      功能分类
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {commandCategories.map((cat) => {
                        const Icon = iconMap[cat.icon] ?? Info;
                        const active = activeCategory === cat.id;
                        const count = aiCommands.filter((c) => c.category === cat.id).length;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors",
                              active
                                ? "glass-tile-strong glass-tile-edge text-white"
                                : "glass-tile text-argent-300 hover:text-white"
                            )}
                          >
                            <Icon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{cat.name}</span>
                            <span className={cn("ml-auto text-[9px]", active ? "text-titanium-400" : "text-argent-600")}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 当前分类的命令列表 */}
                <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-argent-500">
                      {search ? `搜索结果（${currentCommands.length}）` : `${activeCatInfo?.name ?? ""} 命令`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {currentCommands.map((cmd) => {
                      const Icon = iconMap[cmd.icon] ?? Info;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            handleQuickCommand(cmd);
                            // 移动端执行后关闭面板
                            if (window.matchMedia("(max-width: 767px)").matches) {
                              setShowPanel(false);
                            }
                          }}
                          onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
                            e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
                          }}
                          className={cn(
                            "group relative flex flex-col items-start gap-1 overflow-hidden rounded-xl p-2 text-left transition-colors",
                            cmd.danger
                              ? "glass-tile text-crimson-400 hover:text-crimson-300"
                              : "glass-tile glass-tile-hover text-argent-100 hover:text-white"
                          )}
                          title={cmd.description}
                        >
                          <div className="flex items-center gap-1">
                            <Icon className={cn("h-3.5 w-3.5", cmd.danger && "text-crimson-400")} />
                            {cmd.danger && <span className="text-[9px] text-crimson-500">⚠</span>}
                          </div>
                          <span className="text-[11px] font-medium leading-tight">{cmd.title}</span>
                          <span className="line-clamp-1 text-[9px] text-argent-500">{cmd.description}</span>
                        </button>
                      );
                    })}
                    {currentCommands.length === 0 && (
                      <div className="col-span-2 py-6 text-center text-[11px] text-argent-500">
                        未找到匹配命令
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* 右侧：聊天区 */}
        <GlassCard className="glass-shine flex min-w-0 flex-1 flex-col p-0">
          {/* 消息流 */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3"
                >
                  <Avatar role="ai" />
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm glass-tile glass-tile-edge px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-titanium-500" />
                    <span className="text-xs text-argent-400">思考中…</span>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* 输入区 */}
          <div className="shrink-0 border-t border-white/10 p-3 sm:p-4">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <div className="relative flex min-w-0 flex-1 items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="输入命令或问题，如「关机」「ping baidu.com」「计算 1+2*3」…"
                  className="max-h-32 min-h-[44px] w-full resize-none rounded-2xl glass-tile glass-tile-edge px-4 py-3 text-sm text-white placeholder:text-argent-500 focus:outline-none focus:ring-1 focus:ring-titanium-500/40"
                />
              </div>
              <LiquidButton
                variant="primary"
                shimmer
                size="md"
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">发送</span>
              </LiquidButton>
            </div>
            <div className="mx-auto mt-2 flex max-w-3xl flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-argent-500">快捷：</span>
              {["帮助", "当前时间", "生成 UUID", "随机颜色", "计算 1+2*3", "ping baidu.com"].map((kw) => (
                <button
                  key={kw}
                  onClick={() => handleSend(kw)}
                  className="rounded-full glass-tile glass-tile-edge px-2.5 py-0.5 text-[10px] text-argent-300 transition-colors hover:text-white"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        </GlassCard>
      </main>
    </div>
  );
}

// ---------- 消息气泡 ----------

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}
    >
      <Avatar role={message.role} />
      <div
        className={cn(
          "relative max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-gradient-to-br from-titanium-500/30 to-titanium-700/20 text-white glass-tile-edge"
            : cn(
                "rounded-tl-sm glass-tile glass-tile-edge",
                message.status === "success" && "text-argent-100",
                message.status === "error" && "text-crimson-300",
                message.status === "warning" && "text-argent-200",
                message.status === "info" && "text-argent-100"
              )
        )}
      >
        {/* 状态图标 */}
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
          {new Date(message.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}

// ---------- 头像 ----------

function Avatar({ role }: { role: "user" | "ai" }) {
  if (role === "user") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl glass-tile glass-tile-edge text-argent-300">
        <User className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl glass-tile-strong glass-tile-edge glass-shine text-titanium-500">
      <Sparkles className="relative z-10 h-4 w-4" />
    </div>
  );
}

// ---------- 状态图标 ----------

function StatusIcon({ status }: { status: AIResponse["status"] }) {
  const cls = "h-3.5 w-3.5";
  if (status === "success") return <CheckCircle2 className={cn(cls, "text-titanium-400")} />;
  if (status === "error") return <AlertTriangle className={cn(cls, "text-crimson-400")} />;
  if (status === "warning") return <AlertTriangle className={cn(cls, "text-argent-300")} />;
  return null;
}
