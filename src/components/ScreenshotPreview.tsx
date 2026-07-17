// 截图预览组件：在对话流中展示 AI 截屏的缩略图，点击可放大查看
// 用于 ReAct Agent 调用 screenshot 工具后向用户可视化"AI 看到的画面"
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScreenshotPreviewProps {
  base64: string; // 不带 data: 前缀的 base64 PNG
  timestamp?: number; // 截图时间戳
  label?: string; // 标签，如 "AI 看到的画面"
  className?: string;
}

// 时间戳格式化为 HH:MM:SS
function formatTime(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("zh-CN", { hour12: false });
}

export function ScreenshotPreview({ base64, timestamp, label, className }: ScreenshotPreviewProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const src = `data:image/png;base64,${base64}`;
  const timeText = formatTime(timestamp);

  // Esc 键关闭模态
  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, handleEsc]);

  // base64 变化时重置加载状态
  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [base64]);

  return (
    <>
      {/* 缩略图卡片：160x90 16:9，玻璃质感边框 */}
      <motion.div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          "glass-tile glass-tile-edge group relative h-[90px] w-[160px] shrink-0 cursor-zoom-in overflow-hidden rounded-lg",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
          className
        )}
      >
        {/* 未加载/出错时的占位背景 */}
        {(!loaded || error) && (
          <div className="absolute inset-0 flex items-center justify-center bg-base-900/60">
            {error ? (
              <span className="text-[10px] text-crimson-400">截图加载失败</span>
            ) : (
              <Loader2 size={16} className="animate-spin text-argent-300" />
            )}
          </div>
        )}
        {!error && (
          <img
            src={src}
            alt={label ?? "AI 截图"}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-200",
              loaded ? "opacity-100" : "opacity-0"
            )}
          />
        )}

        {/* 左上角时间戳 */}
        {timeText && (
          <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white/90 backdrop-blur-sm">
            {timeText}
          </span>
        )}
        {/* 左下角标签 */}
        {label && (
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 max-w-[110px] truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
            {label}
          </span>
        )}
        {/* 右下角放大图标 */}
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded bg-black/55 text-white/90 backdrop-blur-sm">
          <Maximize2 size={11} />
        </span>
        {/* 悬停"点击放大"提示 */}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/30 group-hover:opacity-100">
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
            点击放大
          </span>
        </span>
      </motion.div>

      {/* 放大查看模态框 */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* 右上角关闭按钮：玻璃风格 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="glass-tile glass-tile-edge absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:text-crimson-400"
              aria-label="关闭"
            >
              <X size={18} />
            </button>

            {/* 大图容器：阻止点击冒泡到遮罩 */}
            <motion.div
              className="flex max-h-[90vh] max-w-[95vw] flex-col items-center gap-3"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <img
                src={src}
                alt={label ?? "AI 截图"}
                className="max-h-[82vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
              />
              {/* 大图下方完整信息 */}
              <div className="flex items-center gap-3 text-xs text-white/80">
                {timeText && (
                  <span className="font-mono">{new Date(timestamp!).toLocaleString("zh-CN", { hour12: false })}</span>
                )}
                {label && <span className="rounded-full bg-white/10 px-2 py-0.5 backdrop-blur-sm">{label}</span>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
