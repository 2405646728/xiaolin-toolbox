// 危险操作确认弹窗
// 当 AI 决定调用危险工具（如 delete_file / kill_process）时弹出，请求用户确认
// 支持两种使用方式：
//   1. 受控模式：父组件直接传 open/title/onConfirm 等 props
//   2. 命令式模式：在 App.tsx 挂载一次本组件，业务代码调用 confirmAction() 返回 Promise<boolean>
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Check, Shield, X } from "lucide-react";
import { GlassButton } from "./glass/GlassButton";
import { cn } from "@/lib/utils";

// ============================================================
// 对外接口
// ============================================================

export interface ConfirmDialogProps {
  open: boolean;
  title: string; // 如 "小林 AI 想要执行"
  toolName: string; // 如 "delete_file"
  toolLabel?: string; // 中文标签，如 "删除文件"
  args: Record<string, any>; // 工具参数，如 { path: "D:\\test.txt" }
  description?: string; // 额外描述
  onConfirm: () => void; // 用户点击允许
  onCancel: () => void; // 用户点击拒绝
}

// ============================================================
// Promise 管理器单例
// ConfirmDialog mount 时通过 setRenderer 注册渲染回调，
// 业务侧调用 confirmAction() → manager.confirm() → 触发 renderer 显示弹窗
// ============================================================

type ConfirmOptions = {
  toolName: string;
  toolLabel: string;
  args: Record<string, any>;
  description?: string;
};

type Renderer = (opts: ConfirmOptions, resolve: (v: boolean) => void) => void;

class ConfirmDialogManager {
  private renderer: Renderer | null = null;

  setRenderer(r: Renderer | null) {
    this.renderer = r;
  }

  confirm(opts: ConfirmOptions): Promise<boolean> {
    if (!this.renderer) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      this.renderer!(opts, resolve);
    });
  }
}

export const confirmDialogManager = new ConfirmDialogManager();

// 命令式调用辅助函数：在 App.tsx 挂载一次 ConfirmDialog 后即可随处调用
export function confirmAction(
  toolName: string,
  toolLabel: string,
  args: Record<string, any>,
  description?: string
): Promise<boolean> {
  return confirmDialogManager.confirm({ toolName, toolLabel, args, description });
}

// ============================================================
// 参数值格式化
// ============================================================

type FormattedValue = {
  text: string;
  block: boolean; // 是否需要用代码块展示（对象/数组/长字符串）
};

// 安全 stringify，避免循环引用抛错（虽然工具参数来自 JSON 不会有环，兜底保护）
function safeStringify(value: any): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatValue(value: any): FormattedValue {
  if (value === null) return { text: "null", block: false };
  if (value === undefined) return { text: "undefined", block: false };
  if (typeof value === "object") {
    // 对象/数组 → JSON 缩进展示
    return { text: safeStringify(value), block: true };
  }
  const text = String(value);
  // 超长字符串换行展示
  return { text, block: text.length > 50 };
}

// ============================================================
// 单个参数行：左对齐 key，右对齐 value，等宽字体
// ============================================================

function ArgRow({ name, value }: { name: string; value: any }) {
  const { text, block } = formatValue(value);
  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-xs text-argent-300">{name}</span>
        {!block && (
          <span className="font-mono text-xs text-argent-100 break-all text-right">
            {text}
          </span>
        )}
      </div>
      {block && (
        // 长字符串 / 对象 → 深色代码块包裹，等宽字体
        <pre className="font-mono text-xs text-argent-100 bg-base-900/80 border border-white/10 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">
          {text}
        </pre>
      )}
    </div>
  );
}

// ============================================================
// ConfirmDialog 组件
// ============================================================

export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    open: propOpen,
    title: propTitle,
    toolName: propToolName,
    toolLabel: propToolLabel,
    args: propArgs,
    description: propDescription,
    onConfirm: propOnConfirm,
    onCancel: propOnCancel,
  } = props;

  // 内部状态：由 confirmAction() 触发时使用，记录当前选项与 resolver
  const [internal, setInternal] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  // 用 ref 保存最新值，供回调与 Esc 监听读取，避免依赖过期导致闭包陷阱
  const internalRef = useRef(internal);
  internalRef.current = internal;
  const onCancelRef = useRef(propOnCancel);
  onCancelRef.current = propOnCancel;
  const onConfirmRef = useRef(propOnConfirm);
  onConfirmRef.current = propOnConfirm;

  // mount 时注册渲染器（全局单例，App.tsx 中只挂载一次）
  useEffect(() => {
    confirmDialogManager.setRenderer((opts, resolve) => {
      setInternal({ opts, resolve });
    });
    return () => confirmDialogManager.setRenderer(null);
  }, []);

  const handleCancel = useCallback(() => {
    const cur = internalRef.current;
    if (cur) {
      cur.resolve(false);
      setInternal(null);
    } else {
      onCancelRef.current();
    }
  }, []);

  const handleConfirm = useCallback(() => {
    const cur = internalRef.current;
    if (cur) {
      cur.resolve(true);
      setInternal(null);
    } else {
      onConfirmRef.current();
    }
  }, []);

  // 实际展示状态：内部（命令式）触发优先于 props（受控）
  const isOpen = internal !== null || propOpen;
  const title = internal ? "小林 AI 想要执行" : propTitle;
  const toolName = internal?.opts.toolName ?? propToolName;
  const toolLabel = internal?.opts.toolLabel ?? propToolLabel ?? toolName;
  const args = internal?.opts.args ?? propArgs ?? {};
  const description = internal?.opts.description ?? propDescription;

  // Esc 键触发拒绝
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, handleCancel]);

  const argEntries = Object.entries(args);

  return (
    <AnimatePresence>
      {isOpen && (
        // 全屏半透明遮罩：rgba(0,0,0,0.5) + backdrop-blur
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
          onClick={handleCancel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            // iOS 26 液态玻璃卡片：圆角 16px，半透明背景，高光边，阴影
            className={cn(
              "glass-strong glass-edge relative w-full max-w-md rounded-2xl overflow-hidden",
              "flex flex-col max-h-[85vh]"
            )}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            {/* 顶部标题区：警告图标 + title */}
            <header className="flex items-center gap-3 px-5 pt-5 pb-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-crimson-600/15 border border-crimson-600/30 text-crimson-500">
                <AlertTriangle size={18} className="shrink-0" />
              </div>
              <h2 className="text-sm font-medium text-argent-100">{title}</h2>
            </header>

            {/* 中部内容区 */}
            <div className="px-5 pb-4 overflow-y-auto">
              {/* 工具中文名（大字号加粗）+ 工具名（小字号灰色等宽） */}
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-lg font-semibold text-white">{toolLabel}</span>
                <span className="font-mono text-xs text-argent-400">{toolName}</span>
              </div>

              {/* 额外描述 */}
              {description && (
                <p className="text-xs text-argent-300 mb-3 leading-relaxed">
                  {description}
                </p>
              )}

              {/* 参数表格 */}
              {argEntries.length > 0 ? (
                <div className="rounded-xl border border-white/10 bg-base-900/40 divide-y divide-white/5 px-3">
                  {argEntries.map(([k, v]) => (
                    <ArgRow key={k} name={k} value={v} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-base-900/40 px-3 py-2 text-xs text-argent-400">
                  无参数
                </div>
              )}

              {/* 安全提示 */}
              <div className="flex items-center gap-1.5 mt-3 text-[11px] text-argent-400">
                <Shield size={11} className="shrink-0" />
                <span>请确认此操作安全后再允许执行</span>
              </div>
            </div>

            {/* 底部按钮区 */}
            <footer className="flex items-center gap-3 px-5 py-4 border-t border-white/8">
              {/* 拒绝按钮：次要样式，灰色玻璃 */}
              <GlassButton
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={handleCancel}
              >
                <X size={16} />
                <span>拒绝</span>
              </GlassButton>
              {/* 允许按钮：警告样式，橙红渐变玻璃 */}
              <GlassButton
                variant="danger"
                size="md"
                className={cn(
                  "flex-1",
                  "bg-gradient-to-br from-titanium-500 to-crimson-600",
                  "border-transparent text-white",
                  "hover:from-titanium-400 hover:to-crimson-500 hover:text-white"
                )}
                onClick={handleConfirm}
              >
                <Check size={16} />
                <span>允许</span>
              </GlassButton>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
