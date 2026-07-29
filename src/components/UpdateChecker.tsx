// 小林 AI · 启动时自动检查更新
// 应用启动后延迟 3 秒静默检查，发现新版本时弹出更新介绍弹窗
// 用户可选择「立即下载安装」或「稍后再说」
// 检查失败静默处理，不打扰用户

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, CheckCircle2, Loader2, Sparkles } from "lucide-react";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let updaterModulePromise: Promise<typeof import("@tauri-apps/plugin-updater")> | null = null;
let processModulePromise: Promise<typeof import("@tauri-apps/plugin-process")> | null = null;

function loadUpdaterModule() {
  if (!updaterModulePromise) updaterModulePromise = import("@tauri-apps/plugin-updater");
  return updaterModulePromise;
}
function loadProcessModule() {
  if (!processModulePromise) processModulePromise = import("@tauri-apps/plugin-process");
  return processModulePromise;
}

interface UpdateData {
  version: string;
  notes: string;
  update: any; // Tauri updater Update 实例
}

export function UpdateChecker() {
  // 是否显示更新弹窗
  const [showDialog, setShowDialog] = useState(false);
  // 更新详情
  const [updateData, setUpdateData] = useState<UpdateData | null>(null);
  // 下载中
  const [downloading, setDownloading] = useState(false);
  // 下载进度 0-100
  const [progress, setProgress] = useState<number | null>(null);
  // 错误信息（下载失败时显示）
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri) return;
    // 启动后延迟 3 秒检查，避免和初始化流程冲突
    const timer = window.setTimeout(async () => {
      try {
        const updater = await loadUpdaterModule();
        const update = await updater.check();
        if (update?.available) {
          setUpdateData({
            version: update.version,
            notes: update.body || "暂无更新说明",
            update,
          });
          setShowDialog(true);
        }
      } catch {
        // 静默失败，不打扰用户
      }
    }, 3000);
    return () => window.clearTimeout(timer);
  }, []);

  // 用户点击「立即下载安装」
  const handleInstall = async () => {
    if (!updateData) return;
    setDownloading(true);
    setProgress(0);
    setError(null);
    try {
      const processApi = await loadProcessModule();
      let totalBytes = 0;
      let downloadedBytes = 0;
      await updateData.update.downloadAndInstall((event: any) => {
        if (event?.event === "Started" && typeof event.data?.contentLength === "number") {
          totalBytes = event.data.contentLength;
        } else if (event?.event === "Progress" && typeof event.data?.chunkLength === "number") {
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) {
            const pct = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
            setProgress(pct);
          }
        } else if (event?.event === "Finished") {
          setProgress(100);
        }
      });
      // 安装完成后重启应用
      await processApi.relaunch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "下载安装失败";
      setError(msg);
    } finally {
      setDownloading(false);
    }
  };

  // 用户点击「稍后再说」
  const handleLater = () => {
    setShowDialog(false);
    setUpdateData(null);
  };

  return (
    <AnimatePresence>
      {showDialog && updateData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={handleLater}
        >
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />

          {/* 弹窗面板 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong glass-edge glass-shine relative z-10 w-full max-w-md max-h-[80vh] overflow-y-auto rounded-3xl p-6 shadow-2xl"
          >
            {/* 顶部标题栏 */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-titanium-500/30 to-titanium-700/20 glass-tile-edge">
                  <Sparkles className="h-4 w-4 text-titanium-200" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white">发现新版本</span>
                  <span className="text-[11px] text-argent-300">v{updateData.version}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLater}
                className="rounded-lg p-1.5 text-argent-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 更新内容 */}
            <div className="mb-5 rounded-2xl border border-white/10 bg-base-900/40 p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-titanium-300" />
                <span className="text-xs font-medium text-titanium-200">更新内容</span>
              </div>
              <div className="max-h-[40vh] overflow-y-auto text-[12px] leading-relaxed text-argent-100 whitespace-pre-wrap">
                {updateData.notes}
              </div>
            </div>

            {/* 下载进度（下载中显示） */}
            {downloading && progress !== null && (
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between text-xs text-argent-300">
                  <span>下载中...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-base-900/60">
                  <motion.div
                    className="h-full bg-gradient-to-r from-titanium-500 to-titanium-300"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}

            {/* 错误提示（下载失败显示） */}
            {error && (
              <div className="mb-4 rounded-xl border border-crimson-500/30 bg-crimson-500/10 p-3 text-xs text-crimson-200">
                {error}
              </div>
            )}

            {/* 底部按钮 */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleLater}
                disabled={downloading}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                稍后再说
              </button>
              <button
                type="button"
                onClick={handleInstall}
                disabled={downloading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-titanium-500 to-titanium-700 px-4 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-titanium-500/30 disabled:opacity-60"
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    下载中
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    立即下载安装
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
