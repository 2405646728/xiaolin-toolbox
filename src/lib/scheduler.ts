/**
 * 小林 AI · 本地定时任务调度器
 *
 * 纯前端模块，不依赖 Tauri / 后端。
 * 使用浏览器 setInterval 每 30 秒检查一次到期任务。
 * localStorage key: "xiaolin-ai-scheduled-tasks"
 *
 * 所有函数容错：localStorage 不可用时只在内存中维护（模块级数组）。
 */

// ============================================================
// 1. 类型定义
// ============================================================

/** 定时任务 */
export interface ScheduledTask {
  id: string;                       // 任务唯一 ID
  name: string;                     // 任务名称（展示用）
  command: string;                  // 触发时发送给 AI 的指令文本
  intervalMinutes: number;          // 执行间隔（分钟）
  enabled: boolean;                 // 是否启用
  lastRun?: number;                 // 上次执行时间戳（毫秒）
  nextRun?: number;                 // 下次执行时间戳（毫秒）
  createdAt: number;                // 创建时间戳（毫秒）
}

// ============================================================
// 2. 常量与内部工具
// ============================================================

const STORAGE_KEY = "xiaolin-ai-scheduled-tasks";
/** 调度器检查间隔（毫秒） = 30 秒 */
const TICK_INTERVAL_MS = 30_000;

/** 模块级缓存：localStorage 的内存镜像
 *  localStorage 不可用时仍可在内存中维护数据
 *  null 表示尚未加载 */
let tasksCache: ScheduledTask[] | null = null;

/** 生成唯一 ID */
function genId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 计算下次运行时间：now + intervalMinutes */
function calcNextRun(intervalMinutes: number, from: number = Date.now()): number {
  return from + Math.max(1, intervalMinutes) * 60_000;
}

// ============================================================
// 3. 持久化
// ============================================================

/** 从 localStorage 读取任务列表 */
export function loadTasks(): ScheduledTask[] {
  if (tasksCache !== null) return tasksCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      tasksCache = [];
      return tasksCache;
    }
    const parsed = JSON.parse(raw) as ScheduledTask[];
    if (!Array.isArray(parsed)) {
      tasksCache = [];
      return tasksCache;
    }
    tasksCache = parsed;
    return tasksCache;
  } catch {
    // 解析失败：回退到空数组
    tasksCache = [];
    return tasksCache;
  }
}

/** 保存任务列表到 localStorage */
export function saveTasks(tasks: ScheduledTask[]): void {
  tasksCache = tasks;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // localStorage 不可用时，仅保留内存镜像
  }
}

// ============================================================
// 4. CRUD 操作
// ============================================================

/** 添加任务：自动生成 id / createdAt / nextRun，返回新建的任务 */
export function addTask(task: Omit<ScheduledTask, "id" | "createdAt">): ScheduledTask {
  const now = Date.now();
  const newTask: ScheduledTask = {
    ...task,
    id: genId(),
    createdAt: now,
    nextRun: task.enabled ? calcNextRun(task.intervalMinutes, now) : undefined,
  };
  const tasks = loadTasks();
  const next = [...tasks, newTask];
  saveTasks(next);
  return newTask;
}

/** 删除任务（按 id） */
export function removeTask(id: string): void {
  const tasks = loadTasks();
  saveTasks(tasks.filter((t) => t.id !== id));
}

/** 启用 / 禁用任务
 *  - 启用时：重置 nextRun = now + interval
 *  - 禁用时：清除 nextRun */
export function toggleTask(id: string, enabled: boolean): void {
  const tasks = loadTasks();
  const next = tasks.map((t) => {
    if (t.id !== id) return t;
    return {
      ...t,
      enabled,
      nextRun: enabled ? calcNextRun(t.intervalMinutes) : undefined,
    };
  });
  saveTasks(next);
}

// ============================================================
// 5. 调度器
// ============================================================

/**
 * 启动调度器：每 30 秒检查一次到期任务，触发回调。
 *
 * @param onTrigger 任务到期时回调，传入任务对象
 * @returns stop 函数，调用后停止调度器
 */
export function startScheduler(onTrigger: (task: ScheduledTask) => void): () => void {
  // 立即检查一次（避免启动后需等待 30 秒才首次检查）
  const checkOnce = () => {
    const tasks = loadTasks();
    const now = Date.now();
    let mutated = false;
    const next = tasks.map((t) => {
      // 仅处理已启用且 nextRun 已到期的任务
      if (!t.enabled || !t.nextRun) return t;
      if (t.nextRun > now) return t;
      // 触发回调
      try {
        onTrigger(t);
      } catch {
        // 回调异常不影响调度器继续运行
      }
      mutated = true;
      return {
        ...t,
        lastRun: now,
        nextRun: calcNextRun(t.intervalMinutes, now),
      };
    });
    if (mutated) saveTasks(next);
  };

  checkOnce();
  const timer = window.setInterval(checkOnce, TICK_INTERVAL_MS);

  // 返回 stop 函数
  return () => {
    window.clearInterval(timer);
  };
}
