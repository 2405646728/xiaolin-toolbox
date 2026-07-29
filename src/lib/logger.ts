/**
 * 小林 AI · 日志查看器模块
 *
 * 拦截 console.log/warn/error 存入环形缓冲区，
 * 供隐藏菜单中的日志查看器 UI 展示。
 *
 * 仅在调试模式开启时才记录（避免生产环境性能影响）。
 * 缓冲区上限 500 条，超出后丢弃最早条目。
 */

// ============================================================
// 类型定义
// ============================================================

export type LogLevel = "log" | "warn" | "error" | "info";

export interface LogEntry {
  /** 毫秒时间戳 */
  timestamp: number;
  level: LogLevel;
  /** 序列化后的消息文本 */
  message: string;
  /** 来源标签（如 [Agent] / [runShell]） */
  source?: string;
}

// ============================================================
// 环形缓冲区
// ============================================================

const MAX_ENTRIES = 500;
const buffer: LogEntry[] = [];
const listeners = new Set<(entries: LogEntry[]) => void>();

/** 原始 console 方法引用（仅初始化一次） */
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
};

/** 是否已安装拦截器 */
let installed = false;
/** 当前是否正在记录（由调试模式控制） */
let recording = false;

/**
 * 安装 console 拦截器
 * 拦截 log/warn/error/info，在 recording=true 时存入缓冲区
 */
export function installLogger(): void {
  if (installed) return;
  installed = true;

  const wrap = (level: LogLevel) => {
    return (...args: unknown[]) => {
      // 先调用原始方法，确保控制台仍正常输出
      originalConsole[level](...args);
      if (recording) {
        pushEntry({
          timestamp: Date.now(),
          level,
          message: serializeArgs(args),
        });
      }
    };
  };

  console.log = wrap("log");
  console.warn = wrap("warn");
  console.error = wrap("error");
  console.info = wrap("info");
}

/** 开启/关闭日志记录 */
export function setRecording(enabled: boolean): void {
  recording = enabled;
  if (enabled) {
    pushEntry({
      timestamp: Date.now(),
      level: "info",
      message: "日志记录已开启",
      source: "[Logger]",
    });
  }
}

/** 向缓冲区追加一条日志，并通知所有监听者 */
function pushEntry(entry: LogEntry): void {
  buffer.push(entry);
  // 环形缓冲区：超出上限丢弃最早条目
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
  notifyListeners();
}

/** 序列化 console 参数为字符串 */
function serializeArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (arg === null) return "null";
      if (arg === undefined) return "undefined";
      if (typeof arg === "number" || typeof arg === "boolean" || typeof arg === "bigint") return String(arg);
      try {
        return JSON.stringify(arg);
      } catch {
        // 覆盖 Object.prototype.toString 的默认行为
        if (arg && typeof arg.toString === "function") {
          try {
            const s = (arg as { toString: () => string }).toString();
            if (s !== "[object Object]") return s;
          } catch {
            // 忽略
          }
        }
        return "[Unserializable]";
      }
    })
    .join(" ");
}

// ============================================================
// 查询 API
// ============================================================

/** 获取缓冲区中所有日志（副本） */
export function getLogs(): LogEntry[] {
  return [...buffer];
}

/** 清空日志缓冲区 */
export function clearLogs(): void {
  buffer.length = 0;
  notifyListeners();
}

/** 订阅日志变更，返回取消订阅函数 */
export function subscribeLogs(fn: (entries: LogEntry[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 通知所有监听者 */
function notifyListeners(): void {
  const snapshot = [...buffer];
  for (const fn of listeners) {
    try {
      fn(snapshot);
    } catch {
      // 监听者异常不影响主流程
    }
  }
}

/** 日志级别对应的颜色类名（Tailwind） */
export function levelColorClass(level: LogLevel): string {
  switch (level) {
    case "error":
      return "text-crimson-300";
    case "warn":
      return "text-amber-300";
    case "info":
      return "text-titanium-200";
    case "log":
    default:
      return "text-argent-200";
  }
}

/** 格式化时间戳为 HH:MM:SS.mmm */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, l = 2) => n.toString().padStart(l, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}
