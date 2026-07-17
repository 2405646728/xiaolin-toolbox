// 小林 AI · 本地定时任务面板（Phase 5.8）
// 浮动面板：管理本地定时任务，到期自动触发指令
// 浏览器 setInterval 实现，不依赖后端
// iOS 26 液态玻璃风格

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, X, Plus, Trash2, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadTasks, addTask, removeTask, toggleTask,
  type ScheduledTask,
} from "@/lib/scheduler";

export interface SchedulerPanelProps {
  open: boolean;
  onClose: () => void;
  onTrigger: (command: string) => void;  // 任务触发时回调
}

export default function SchedulerPanel({ open, onClose, onTrigger }: SchedulerPanelProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  // 新建表单状态
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formInterval, setFormInterval] = useState("10");
  // 倒计时刷新触发器（每秒更新一次，用于展示下次运行时间）
  const [tick, setTick] = useState(0);

  // 打开时加载任务列表
  useEffect(() => {
    if (open) {
      setTasks(loadTasks());
      setShowForm(false);
    }
  }, [open]);

  // 每秒刷新一次，用于下次运行时间的相对显示
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  // 重新读取本地任务并刷新状态
  const refresh = () => setTasks(loadTasks());

  // 提交新建任务
  const handleAdd = () => {
    const name = formName.trim();
    const command = formCommand.trim();
    const intervalMinutes = parseInt(formInterval, 10);
    if (!name || !command || !intervalMinutes || intervalMinutes < 1) return;
    addTask({
      name,
      command,
      intervalMinutes,
      enabled: true,
    });
    setFormName("");
    setFormCommand("");
    setFormInterval("10");
    setShowForm(false);
    refresh();
  };

  // 删除任务
  const handleRemove = (id: string) => {
    removeTask(id);
    refresh();
  };

  // 切换启用状态
  const handleToggle = (id: string, enabled: boolean) => {
    toggleTask(id, enabled);
    refresh();
  };

  // 立即手动触发一次（便于测试）
  const handleManualTrigger = (task: ScheduledTask) => {
    onTrigger(task.command);
  };

  // 格式化下次运行时间（相对时间）
  const formatNextRun = (ts?: number): string => {
    if (!ts) return "未启用";
    const diff = ts - Date.now();
    if (diff <= 0) return "即将执行";
    const minutes = Math.floor(diff / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}时${mins}分后`;
    }
    if (minutes > 0) return `${minutes}分${seconds}秒后`;
    return `${seconds}秒后`;
  };

  // 引用 tick 变量避免未使用警告（每秒刷新相对时间）
  void tick;

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
              "fixed inset-y-0 right-0 z-50 flex w-[380px] max-w-[90vw] flex-col",
              "border-l border-white/10 bg-base-900/60 backdrop-blur-xl",
              "shadow-[0_0_40px_0_rgba(0,0,0,0.5)]"
            )}
          >
            {/* 顶部标题栏 */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg glass-tile-strong glass-tile-edge text-titanium-400">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <h2 className="text-sm font-semibold text-white">定时任务</h2>
                {tasks.length > 0 && (
                  <span className="rounded-full glass-tile px-1.5 py-0.5 text-[9px] text-argent-300">
                    {tasks.filter((t) => t.enabled).length}/{tasks.length}
                  </span>
                )}
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

            {/* 顶部操作区：新建按钮 */}
            <div className="flex shrink-0 items-center gap-2 px-3 py-2">
              <button
                onClick={() => setShowForm((v) => !v)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all active:scale-[0.98]",
                  showForm
                    ? "glass-tile glass-tile-edge text-argent-200"
                    : "glass-tile-strong glass-tile-edge text-white"
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                {showForm ? "取消新建" : "新建任务"}
              </button>
            </div>

            {/* 新建任务表单 */}
            <AnimatePresence initial={false}>
              {showForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 overflow-hidden"
                >
                  <div className="flex flex-col gap-2 px-3 pb-3">
                    <div className="rounded-xl glass-tile glass-tile-edge p-3">
                      <div className="flex flex-col gap-2">
                        {/* 名称 */}
                        <input
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="任务名称，如「每小时截屏」"
                          className="w-full rounded-lg bg-white/5 px-3 py-2 text-xs text-white placeholder:text-argent-500 focus:outline-none focus:ring-1 focus:ring-titanium-500/40"
                        />
                        {/* 指令 */}
                        <input
                          value={formCommand}
                          onChange={(e) => setFormCommand(e.target.value)}
                          placeholder="触发指令，如「帮我截屏看看当前屏幕」"
                          className="w-full rounded-lg bg-white/5 px-3 py-2 text-xs text-white placeholder:text-argent-500 focus:outline-none focus:ring-1 focus:ring-titanium-500/40"
                        />
                        {/* 间隔 + 确认 */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-argent-400">间隔</span>
                            <input
                              type="number"
                              min={1}
                              value={formInterval}
                              onChange={(e) => setFormInterval(e.target.value)}
                              className="w-16 rounded-lg bg-white/5 px-2 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-titanium-500/40"
                            />
                            <span className="text-[10px] text-argent-400">分钟</span>
                          </div>
                          <button
                            onClick={handleAdd}
                            disabled={!formName.trim() || !formCommand.trim()}
                            className="ml-auto rounded-lg bg-gradient-to-br from-titanium-500 to-titanium-700 px-3 py-2 text-xs font-medium text-white transition-all hover:from-titanium-400 hover:to-titanium-600 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                          >
                            确认创建
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 任务列表（可滚动） */}
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto px-3 pb-3",
                // 细线滚动条
                "[&::-webkit-scrollbar]:w-1.5",
                "[&::-webkit-scrollbar-thumb]:rounded-full",
                "[&::-webkit-scrollbar-thumb]:bg-white/15",
                "[&::-webkit-scrollbar-thumb:hover]:bg-white/25",
                "[&::-webkit-scrollbar-track]:bg-transparent"
              )}
            >
              {tasks.length === 0 ? (
                // 空状态
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                  <Bell className="h-8 w-8 text-argent-500/60" />
                  <p className="text-xs text-argent-500">
                    还没有定时任务
                  </p>
                  <p className="text-[10px] text-argent-600">
                    点击上方「新建任务」创建
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={(enabled) => handleToggle(task.id, enabled)}
                      onRemove={() => handleRemove(task.id)}
                      onTrigger={() => handleManualTrigger(task)}
                      nextRunText={formatNextRun(task.nextRun)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 底部说明 */}
            <div className="shrink-0 border-t border-white/10 px-4 py-2.5">
              <p className="text-center text-[10px] text-argent-500">
                调度器每 30 秒检查一次到期任务
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------- 单条任务行 ----------

interface TaskRowProps {
  task: ScheduledTask;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
  onTrigger: () => void;  // 手动触发
  nextRunText: string;
}

function TaskRow({ task, onToggle, onRemove, onTrigger, nextRunText }: TaskRowProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl p-3 transition-opacity",
        "glass-tile glass-tile-edge glass-tile-hover",
        !task.enabled && "opacity-60"
      )}
    >
      {/* 第一行：名称 + 间隔徽章 + 启用开关 + 删除 */}
      <div className="relative z-10 flex items-center gap-2">
        <button
          onClick={onTrigger}
          className="min-w-0 flex-1 text-left"
          title="点击立即执行一次"
        >
          <span className="block truncate text-xs font-medium text-white">
            {task.name}
          </span>
        </button>
        {/* 间隔徽章 */}
        <span className="shrink-0 rounded-full glass-tile px-1.5 py-0.5 text-[9px] text-titanium-400">
          {task.intervalMinutes} 分钟
        </span>
        {/* 启用开关 */}
        <button
          onClick={() => onToggle(!task.enabled)}
          className={cn(
            "relative h-4 w-7 shrink-0 rounded-full transition-colors",
            task.enabled ? "bg-titanium-500/80" : "bg-white/15"
          )}
          role="switch"
          aria-checked={task.enabled}
          title={task.enabled ? "点击禁用" : "点击启用"}
        >
          <span
            className={cn(
              "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all",
              task.enabled ? "left-3.5" : "left-0.5"
            )}
          />
        </button>
        {/* 删除按钮 */}
        <button
          onClick={onRemove}
          className={cn(
            "shrink-0 rounded p-0.5 text-argent-500 transition",
            "hover:bg-crimson-600/20 hover:text-crimson-400"
          )}
          title="删除任务"
          aria-label="删除任务"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 第二行：指令文本（截断） */}
      <p className="relative z-10 truncate text-[10px] text-argent-500" title={task.command}>
        {task.command}
      </p>

      {/* 第三行：下次运行时间 */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[10px] text-argent-400">
          <Clock className="h-2.5 w-2.5" />
          {nextRunText}
        </span>
        {task.lastRun && (
          <span className="text-[9px] text-argent-600">
            上次：{new Date(task.lastRun).toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
