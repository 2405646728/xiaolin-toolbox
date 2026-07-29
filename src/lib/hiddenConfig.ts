/**
 * 小林 AI · 隐藏配置模块
 *
 * 管理隐藏菜单中暴露的「动态参数」和「批量操作」。
 * 这些参数原本硬编码在代码里，现在可通过隐藏菜单动态调整。
 *
 * 与 Settings 页的安全策略（security.ts）区分：
 * - security.ts：常规安全配置，Settings 页有完整 UI
 * - hiddenConfig.ts：硬编码参数动态化 + 批量操作 + 调试开关，仅隐藏菜单可访问
 *
 * localStorage key: "xiaolin-ai-hidden-config"
 */

// ============================================================
// 类型定义
// ============================================================

export interface HiddenConfig {
  // ---- 硬编码参数动态化（原代码写死的常量）----

  /** Agent 最大步数（原 agent.ts MAX_STEPS=20） */
  maxSteps: number;
  /** 用户空闲阈值秒数（原 agent.ts IDLE_THRESHOLD_SECONDS=120） */
  idleThresholdSeconds: number;
  /** 历史上下文消息数量（原 CommandAI.tsx slice(-10)） */
  contextMessageCount: number;
  /** GUI 工具等待超时毫秒（原 agent.ts WAIT_MAX_TIMEOUT_MS=10*60*1000） */
  guiWaitTimeoutMs: number;
  /** 自动截图失败重试次数（原 agent.ts MAX_AUTO_SCREENSHOT_FAILURES=2） */
  autoScreenshotMaxFailures: number;

  // ---- 调试开关 ----

  /** 调试模式：控制 console.log 详细日志输出 */
  debugMode: boolean;
  /** 强制离线模式：即使配置了 API 也走本地命令 */
  forceOffline: boolean;
}

// ============================================================
// 常量
// ============================================================

const HIDDEN_CONFIG_KEY = "xiaolin-ai-hidden-config";

/** 默认值与原硬编码常量保持一致，确保升级后行为不变 */
const DEFAULT_HIDDEN: HiddenConfig = {
  maxSteps: 20,
  idleThresholdSeconds: 120,
  contextMessageCount: 10,
  guiWaitTimeoutMs: 10 * 60 * 1000,
  autoScreenshotMaxFailures: 2,
  debugMode: false,
  forceOffline: false,
};

/** 所有 localStorage key 清单（用于一键重置和占用估算） */
export const ALL_STORAGE_KEYS: ReadonlyArray<{ key: string; label: string; module: string }> = [
  { key: "xiaolin-ai-llm-config", label: "LLM 配置", module: "llm" },
  { key: "xiaolin-ai-security", label: "安全策略", module: "security" },
  { key: "xiaolin-ai-hidden-config", label: "隐藏配置", module: "hidden" },
  { key: "xiaolin-ai-conversations", label: "对话记录", module: "conversations" },
  { key: "xiaolin-ai-current-conversation", label: "当前会话", module: "conversations" },
  { key: "xiaolin-ai-scheduled-tasks", label: "定时任务", module: "scheduler" },
  { key: "xiaolin-ai-usage-records", label: "用量记录", module: "usage" },
  { key: "xiaolin-ai-usage-by-date", label: "用量按日", module: "usage" },
  { key: "xiaolin-ai-user-avatar", label: "用户头像", module: "avatar" },
  { key: "xiaolin-ai-preset-apikeys", label: "预置 Key 缓存", module: "preset" },
];

// ============================================================
// 读写函数
// ============================================================

export function loadHiddenConfig(): HiddenConfig {
  try {
    const raw = localStorage.getItem(HIDDEN_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_HIDDEN };
    const parsed = JSON.parse(raw) as Partial<HiddenConfig>;
    return {
      maxSteps: clampInt(parsed.maxSteps, DEFAULT_HIDDEN.maxSteps, 1, 100),
      idleThresholdSeconds: clampInt(parsed.idleThresholdSeconds, DEFAULT_HIDDEN.idleThresholdSeconds, 10, 3600),
      contextMessageCount: clampInt(parsed.contextMessageCount, DEFAULT_HIDDEN.contextMessageCount, 0, 50),
      guiWaitTimeoutMs: clampInt(parsed.guiWaitTimeoutMs, DEFAULT_HIDDEN.guiWaitTimeoutMs, 60_000, 60 * 60 * 1000),
      autoScreenshotMaxFailures: clampInt(parsed.autoScreenshotMaxFailures, DEFAULT_HIDDEN.autoScreenshotMaxFailures, 0, 10),
      debugMode: parsed.debugMode ?? DEFAULT_HIDDEN.debugMode,
      forceOffline: parsed.forceOffline ?? DEFAULT_HIDDEN.forceOffline,
    };
  } catch {
    return { ...DEFAULT_HIDDEN };
  }
}

export function saveHiddenConfig(config: HiddenConfig): void {
  try {
    localStorage.setItem(HIDDEN_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // 静默失败
  }
}

/** 数值钳制到 [min, max]，非数字/undefined 返回 fallback */
function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : fallback;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.round(n);
  return Math.max(min, Math.min(max, i));
}

// ============================================================
// 批量操作
// ============================================================

/**
 * 一键重置全部设置：清空所有 localStorage key，恢复出厂状态
 * @returns 已清除的 key 数量
 */
export function resetAllData(): number {
  let cleared = 0;
  for (const { key } of ALL_STORAGE_KEYS) {
    try {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        cleared += 1;
      }
    } catch {
      // 忽略单个 key 清除失败
    }
  }
  return cleared;
}

/**
 * 估算 localStorage 各 key 的占用空间
 * @returns 各 key 的字节数 + 总字节数
 */
export function estimateStorageUsage(): {
  items: Array<{ key: string; label: string; bytes: number }>;
  totalBytes: number;
} {
  const items: Array<{ key: string; label: string; bytes: number }> = [];
  let totalBytes = 0;
  for (const { key, label } of ALL_STORAGE_KEYS) {
    let bytes = 0;
    try {
      const raw = localStorage.getItem(key);
      // UTF-16 每字符约 2 字节，粗略估算
      bytes = raw ? raw.length * 2 : 0;
    } catch {
      bytes = 0;
    }
    items.push({ key, label, bytes });
    totalBytes += bytes;
  }
  return { items, totalBytes };
}

/** 格式化字节数为人类可读字符串 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
