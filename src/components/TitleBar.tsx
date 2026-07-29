// 小林 AI · 自定义窗口标题栏
// 替代系统默认标题栏，与应用液态玻璃风格统一
// 左侧应用图标 + 名称，右侧最小化/最大化/关闭按钮
// 整条可拖拽（data-tauri-drag-region）

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Minus, Square, X, Copy } from "lucide-react";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  // 监听窗口最大化状态变化
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const appWindow = await import("@tauri-apps/api/window");
        const win = await appWindow.getCurrentWindow();
        // 初始读取
        setMaximized(await win.isMaximized());
        // 监听resize事件（最大化/还原会触发）
        unlisten = await win.onResized(() => {
          win.isMaximized().then(setMaximized).catch(() => {});
        });
      } catch {
        // 静默失败
      }
    })();
    return () => { unlisten?.(); };
  }, []);

  // 窗口操作
  const handleMinimize = async () => {
    if (!isTauri) return;
    try {
      const appWindow = await import("@tauri-apps/api/window");
      await (await appWindow.getCurrentWindow()).minimize();
    } catch { /* 静默 */ }
  };

  const handleToggleMaximize = async () => {
    if (!isTauri) return;
    try {
      const appWindow = await import("@tauri-apps/api/window");
      await (await appWindow.getCurrentWindow()).toggleMaximize();
    } catch { /* 静默 */ }
  };

  const handleClose = async () => {
    if (!isTauri) return;
    try {
      const appWindow = await import("@tauri-apps/api/window");
      await (await appWindow.getCurrentWindow()).close();
    } catch { /* 静默 */ }
  };

  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 left-0 right-0 z-[300] flex h-9 items-center justify-between border-b border-white/5 bg-base-950/80 backdrop-blur-xl select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* 左侧：应用图标 + 名称 */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 pl-3 pointer-events-none"
      >
        <img src="/app-icon.png" alt="小林 AI"
          className="h-5 w-5 rounded-md object-cover shadow-sm" draggable={false} />
        <span className="text-[11px] font-medium text-argent-200 tracking-wide">
          小林 AI
        </span>
      </div>

      {/* 右侧：窗口控制按钮 */}
      <div
        className="flex h-full items-stretch"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {/* 最小化 */}
        <motion.button
          type="button"
          onClick={handleMinimize}
          whileHover={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          whileTap={{ backgroundColor: "rgba(255,255,255,0.04)" }}
          className="flex w-11 items-center justify-center text-argent-300 transition-colors hover:text-white"
          title="最小化"
        >
          <Minus className="h-3.5 w-3.5" />
        </motion.button>

        {/* 最大化/还原 */}
        <motion.button
          type="button"
          onClick={handleToggleMaximize}
          whileHover={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          whileTap={{ backgroundColor: "rgba(255,255,255,0.04)" }}
          className="flex w-11 items-center justify-center text-argent-300 transition-colors hover:text-white"
          title={maximized ? "还原" : "最大化"}
        >
          {maximized ? (
            <Copy className="h-3 w-3 -scale-x-100" />
          ) : (
            <Square className="h-3 w-3" />
          )}
        </motion.button>

        {/* 关闭 */}
        <motion.button
          type="button"
          onClick={handleClose}
          whileHover={{ backgroundColor: "rgba(248,113,113,0.85)" }}
          whileTap={{ backgroundColor: "rgba(220,92,92,0.9)" }}
          className="flex w-11 items-center justify-center text-argent-300 transition-colors hover:text-white"
          title="关闭"
        >
          <X className="h-3.5 w-3.5" />
        </motion.button>
      </div>
    </div>
  );
}
