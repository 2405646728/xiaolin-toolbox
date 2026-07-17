// 小林 AI · 快捷指令面板（Phase 5.7）
// 浮动面板：从右侧滑入，展示预设常用任务，点击即发送给 AI
// iOS 26 液态玻璃风格

import { motion, AnimatePresence } from "framer-motion";
import { Cpu, FileText, Globe, Folder, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickActionsProps {
  open: boolean;
  onClose: () => void;
  onAction: (command: string) => void;  // 用户点击指令后回调
}

// ---------- 预设指令分组（组件内部定义，无需外部配置） ----------

interface QuickItem {
  label: string;
  command: string;
}
interface QuickGroup {
  title: string;
  icon: typeof Cpu;
  items: QuickItem[];
}

const QUICK_GROUPS: QuickGroup[] = [
  {
    title: "系统",
    icon: Cpu,
    items: [
      { label: "截屏看看", command: "帮我截屏看看当前屏幕" },
      { label: "系统状态", command: "获取当前系统状态" },
      { label: "硬件信息", command: "获取硬件详细信息" },
      { label: "列出进程", command: "列出 CPU 占用最高的进程" },
      { label: "静音", command: "把系统静音" },
    ],
  },
  {
    title: "办公",
    icon: FileText,
    items: [
      { label: "记事本", command: "打开记事本" },
      { label: "计算器", command: "打开计算器" },
      { label: "资源管理器", command: "打开资源管理器" },
      { label: "浏览器", command: "打开 Edge 浏览器" },
    ],
  },
  {
    title: "网络",
    icon: Globe,
    items: [
      { label: "搜索网页", command: "在浏览器搜索：" },  // 这个用户可后续编辑
      { label: "打开 B 站", command: "打开网址 https://www.bilibili.com" },
      { label: "打开 GitHub", command: "打开网址 https://github.com" },
    ],
  },
  {
    title: "文件",
    icon: Folder,
    items: [
      { label: "下载文件夹", command: "列出 D:\\Downloads 目录的文件" },
      { label: "整理桌面", command: "帮我整理桌面文件" },
    ],
  },
];

export default function QuickActions({ open, onClose, onAction }: QuickActionsProps) {
  // 点击指令：触发回调后关闭面板
  const handlePick = (command: string) => {
    onAction(command);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 遮罩层：点击空白处关闭 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />

          {/* 浮动面板：从右侧滑入 */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className={cn(
              "fixed inset-y-0 right-0 z-50 flex w-[340px] max-w-[90vw] flex-col",
              "border-l border-white/10 bg-base-900/60 backdrop-blur-xl",
              "shadow-[0_0_40px_0_rgba(0,0,0,0.5)]"
            )}
          >
            {/* 顶部标题栏 */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg glass-tile-strong glass-tile-edge text-titanium-400">
                  <Cpu className="h-3.5 w-3.5" />
                </div>
                <h2 className="text-sm font-semibold text-white">快捷指令</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-argent-400 transition-colors hover:bg-white/10 hover:text-white"
                title="关闭"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 中间分组列表（可滚动） */}
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto px-3 py-3",
                // 细线滚动条
                "[&::-webkit-scrollbar]:w-1.5",
                "[&::-webkit-scrollbar-thumb]:rounded-full",
                "[&::-webkit-scrollbar-thumb]:bg-white/15",
                "[&::-webkit-scrollbar-thumb:hover]:bg-white/25",
                "[&::-webkit-scrollbar-track]:bg-transparent"
              )}
            >
              <div className="flex flex-col gap-4">
                {QUICK_GROUPS.map((group) => {
                  const Icon = group.icon;
                  return (
                    <section key={group.title} className="flex flex-col gap-1.5">
                      {/* 分组标题 */}
                      <div className="flex items-center gap-1.5 px-1">
                        <Icon className="h-3.5 w-3.5 text-titanium-400" />
                        <span className="text-[11px] font-medium uppercase tracking-wider text-argent-400">
                          {group.title}
                        </span>
                        <div className="ml-1 h-px flex-1 bg-white/10" />
                      </div>

                      {/* 指令卡片列表 */}
                      <div className="flex flex-col gap-1.5">
                        {group.items.map((item) => (
                          <button
                            key={item.label}
                            onClick={() => handlePick(item.command)}
                            className={cn(
                              "group relative flex items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2.5 text-left",
                              "glass-tile glass-tile-edge glass-tile-hover",
                              "transition-all duration-200 active:scale-[0.98]"
                            )}
                          >
                            {/* 指令文本 */}
                            <div className="relative z-10 flex min-w-0 flex-1 flex-col">
                              <span className="text-xs font-medium text-white">
                                {item.label}
                              </span>
                              <span className="truncate text-[10px] text-argent-500">
                                {item.command}
                              </span>
                            </div>
                            {/* 悬停提示箭头 */}
                            <span className="relative z-10 shrink-0 text-argent-500 opacity-0 transition-opacity group-hover:opacity-100">
                              →
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>

            {/* 底部小提示 */}
            <div className="shrink-0 border-t border-white/10 px-4 py-2.5">
              <p className="text-center text-[10px] text-argent-500">
                点击指令即可发送给 AI
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
