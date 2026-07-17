// 小林 AI · 任务执行可视化组件
// 实时展示 ReAct Agent 每一步：思考气泡 / 工具调用 / 工具结果 / 截图 / 最终回复 / 错误
// iOS 26 液态玻璃风格 + Framer Motion 进场动画
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  Terminal,
} from "lucide-react";
import type { AgentStep } from "@/lib/agent";
import { TOOL_LABELS } from "@/lib/tools";
import { ScreenshotPreview } from "./ScreenshotPreview";
import { cn } from "@/lib/utils";

export interface TaskProgressProps {
  steps: AgentStep[]; // 所有步骤
  maxSteps: number; // 最大步数（用于进度条）
  isRunning: boolean; // 是否正在执行
  className?: string;
}

// ============================================================
// 渲染单元：把原始步骤预处理为"渲染项"
// 将 tool_call 与紧随其后的 tool_result 按 toolCall.id 配对合并
// ============================================================

type RenderItem =
  | { kind: "thinking"; step: AgentStep }
  | {
      kind: "tool";
      callStep: AgentStep;
      resultStep?: AgentStep;
      status: "running" | "done" | "failed";
    }
  | { kind: "final"; step: AgentStep }
  | { kind: "error"; step: AgentStep };

function buildRenderItems(steps: AgentStep[]): RenderItem[] {
  const items: RenderItem[] = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.type === "thinking") {
      items.push({ kind: "thinking", step: s });
    } else if (s.type === "tool_call") {
      // 向后查找匹配的 tool_result（遇到下一个 tool_call 即停止）
      let resultStep: AgentStep | undefined;
      for (let j = i + 1; j < steps.length; j++) {
        if (steps[j].type === "tool_call") break;
        if (
          steps[j].type === "tool_result" &&
          steps[j].toolCall?.id === s.toolCall?.id
        ) {
          resultStep = steps[j];
          break;
        }
      }
      const status: "running" | "done" | "failed" = resultStep
        ? resultStep.toolResult?.success
          ? "done"
          : "failed"
        : "running";
      items.push({ kind: "tool", callStep: s, resultStep, status });
    } else if (s.type === "tool_result") {
      // 已被对应 tool_call 配对消费，跳过
      continue;
    } else if (s.type === "final") {
      items.push({ kind: "final", step: s });
    } else if (s.type === "error") {
      items.push({ kind: "error", step: s });
    }
  }
  return items;
}

// ============================================================
// 工具函数
// ============================================================

function safeStringify(v: any): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function formatArgValue(v: any): string {
  if (typeof v === "object" && v !== null) {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

// ============================================================
// 思考气泡：折叠样式，超过 3 行显示展开按钮
// ============================================================

function ThinkingCard({ step, isRunning }: { step: AgentStep; isRunning: boolean }) {
  const [open, setOpen] = useState(false);
  const text = step.content ?? "";
  const long = text.split("\n").length > 3 || text.length > 120;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="glass-tile glass-tile-edge relative rounded-xl shadow-lg p-3"
    >
      <button
        type="button"
        onClick={() => long && setOpen((o) => !o)}
        className={cn("flex w-full items-center gap-2 text-left", !long && "cursor-default")}
      >
        <Brain size={15} className="shrink-0 text-titanium-400" />
        <span className="text-xs font-medium text-argent-100">
          {isRunning ? "思考中..." : "AI 的思考"}
        </span>
        {long &&
          (open ? (
            <ChevronDown size={13} className="ml-auto text-argent-400" />
          ) : (
            <ChevronRight size={13} className="ml-auto text-argent-400" />
          ))}
      </button>
      <div
        className={cn(
          "mt-2 font-mono text-[11px] leading-relaxed text-argent-200 whitespace-pre-wrap break-words",
          !open && long && "line-clamp-3"
        )}
      >
        {text}
      </div>
    </motion.div>
  );
}

// ============================================================
// 工具调用卡片：工具名 + 参数 + 执行状态 + 结果（含截图）
// ============================================================

function ToolCard({ item }: { item: Extract<RenderItem, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const { callStep, resultStep, status } = item;
  const toolName = callStep.toolCall?.name ?? "unknown";
  const toolLabel = TOOL_LABELS[toolName] ?? toolName;
  const args = callStep.toolCall?.args ?? {};
  const argEntries = Object.entries(args);
  const isScreenshot = toolName === "screenshot" || toolName === "screenshot_region";
  const screenshot = resultStep?.screenshot;
  const result = resultStep?.toolResult;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="glass-tile glass-tile-edge relative rounded-xl shadow-lg p-3"
    >
      {/* 运行中：轻微 pulse 高光环 */}
      {status === "running" && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-titanium-400/40"
          animate={{ opacity: [0.25, 0.8, 0.25] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* 顶部：步骤号 + 工具中文名 + 工具名 + 状态 */}
      <div className="flex items-center gap-2">
        <Wrench size={15} className="shrink-0 text-titanium-400" />
        <span className="text-xs font-medium text-white">
          #{callStep.index} {toolLabel}
        </span>
        <span className="font-mono text-[10px] text-argent-400">{toolName}</span>
        <div className="ml-auto flex items-center gap-1">
          {status === "running" && (
            <>
              <Loader2 size={12} className="animate-spin text-titanium-400" />
              <span className="text-[10px] text-titanium-300">正在执行...</span>
            </>
          )}
          {status === "done" && <CheckCircle2 size={14} className="text-emerald-400" />}
          {status === "failed" && <AlertTriangle size={14} className="text-crimson-500" />}
        </div>
      </div>

      {/* 参数表格（等宽字体） */}
      {argEntries.length > 0 && (
        <div className="mt-2 rounded-lg border border-white/8 bg-base-900/40 px-2.5 divide-y divide-white/5">
          {argEntries.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 py-1">
              <span className="font-mono text-[11px] text-argent-300">{k}</span>
              <span className="font-mono text-[11px] text-argent-100 text-right break-all">
                {formatArgValue(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 截图缩略图（嵌入工具卡片内） */}
      {isScreenshot && screenshot && (
        <div className="mt-2">
          <ScreenshotPreview
            base64={screenshot}
            timestamp={resultStep?.timestamp}
            label="AI 看到的画面"
          />
        </div>
      )}

      {/* 结果折叠区 */}
      {result && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-2 flex items-center gap-1.5 text-[11px] text-argent-400 hover:text-argent-200 transition-colors"
        >
          <Terminal size={11} />
          <span>{result.success ? "执行结果" : "错误信息"}</span>
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
      )}
      <AnimatePresence initial={false}>
        {result && open && (
          <motion.pre
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "mt-1.5 font-mono text-[11px] leading-relaxed rounded-lg p-2.5",
              "overflow-x-auto overflow-y-auto max-h-40 whitespace-pre-wrap break-words",
              result.success
                ? "bg-base-900/80 border border-white/10 text-argent-100"
                : "bg-crimson-800/20 border border-crimson-600/30 text-crimson-400"
            )}
          >
            {result.success
              ? result.data === undefined
                ? "（无返回数据）"
                : safeStringify(result.data)
              : result.error ?? "未知错误"}
          </motion.pre>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================
// 最终回复卡片：突出显示 + 边框高亮
// ============================================================

function FinalCard({ step }: { step: AgentStep }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="glass-strong glass-edge rounded-xl shadow-glow p-4 border border-titanium-500/30"
    >
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-titanium-400" />
        <span className="text-sm font-semibold text-white">任务完成</span>
      </div>
      <div className="mt-2 text-sm leading-relaxed text-argent-100 whitespace-pre-wrap break-words">
        {step.content ?? ""}
      </div>
    </motion.div>
  );
}

// ============================================================
// 错误卡片：红色边框
// ============================================================

function ErrorCard({ step }: { step: AgentStep }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="glass-tile glass-tile-edge rounded-xl shadow-lg p-3 border border-crimson-600/40"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} className="text-crimson-500" />
        <span className="text-xs font-medium text-crimson-400">任务出错</span>
      </div>
      <div className="mt-1.5 text-xs text-argent-200 break-words">
        {step.content ?? "未知错误"}
      </div>
    </motion.div>
  );
}

// ============================================================
// 空状态
// ============================================================

function EmptyState({ isRunning }: { isRunning: boolean }) {
  return (
    <div className="glass-tile glass-tile-edge rounded-xl shadow-lg p-6 flex flex-col items-center gap-2">
      {isRunning ? (
        <>
          <Loader2 size={18} className="animate-spin text-titanium-400" />
          <span className="text-xs text-argent-300">AI 正在思考...</span>
        </>
      ) : (
        <span className="text-xs text-argent-400">等待任务开始...</span>
      )}
    </div>
  );
}

// ============================================================
// TaskProgress 主组件
// ============================================================

export function TaskProgress({
  steps,
  maxSteps,
  isRunning,
  className,
}: TaskProgressProps) {
  const items = useMemo(() => buildRenderItems(steps), [steps]);

  const hasFinal = steps.some((s) => s.type === "final");
  const hasError = steps.some((s) => s.type === "error");

  // 顶部状态文案与图标
  const statusText = hasFinal ? "任务完成" : hasError ? "任务中断" : "任务执行中";
  const StatusIcon = hasFinal ? CheckCircle2 : hasError ? AlertTriangle : Loader2;
  const statusColor = hasFinal
    ? "text-emerald-400"
    : hasError
    ? "text-crimson-500"
    : "text-titanium-400";

  // 已完成步骤数：thinking / final / error / 已有结果的 tool 视为完成
  const completedCount = items.filter(
    (it) =>
      it.kind === "thinking" ||
      it.kind === "final" ||
      it.kind === "error" ||
      (it.kind === "tool" && it.status !== "running")
  ).length;
  const progress = Math.min(completedCount / maxSteps, 1);
  const showSpinner = isRunning && !hasFinal && !hasError;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* 顶部进度条 */}
      <div className="glass-tile glass-tile-edge rounded-xl shadow-lg p-3">
        <div className="flex items-center gap-2">
          <StatusIcon
            size={16}
            className={cn("shrink-0", statusColor, showSpinner && "animate-spin")}
          />
          <span className="text-xs font-medium text-argent-100">{statusText}</span>
          <span className="ml-auto font-mono text-xs text-argent-300">
            第 {completedCount} / {maxSteps} 步
          </span>
        </div>
        {/* 横向进度条 */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-base-900/60">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-titanium-500 to-titanium-400 shadow-[0_0_8px_rgba(255,110,64,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
          />
        </div>
      </div>

      {/* 步骤列表 / 空状态 */}
      {items.length === 0 ? (
        <EmptyState isRunning={isRunning} />
      ) : (
        <div className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {items.map((item, idx) => {
              const key = `${item.kind}-${idx}`;
              switch (item.kind) {
                case "thinking":
                  return (
                    <ThinkingCard key={key} step={item.step} isRunning={isRunning} />
                  );
                case "tool":
                  return <ToolCard key={key} item={item} />;
                case "final":
                  return <FinalCard key={key} step={item.step} />;
                case "error":
                  return <ErrorCard key={key} step={item.step} />;
              }
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
