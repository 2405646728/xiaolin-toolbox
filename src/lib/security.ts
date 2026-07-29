/**
 * 小林 AI · 安全策略模块
 *
 * 统一管理工具执行的安全策略：
 * - 全局开关：是否启用危险操作确认
 * - 按工具粒度：每个危险工具可单独开关确认
 * - 命令黑名单：run_shell 中禁止执行的命令
 *
 * localStorage key: "xiaolin-ai-security"
 */

import { DANGEROUS_TOOLS } from "./tools";

// ============================================================
// 类型定义
// ============================================================

export interface SecurityConfig {
  /** 全局开关：关闭后所有工具直接执行不确认 */
  confirmDangerous: boolean;
  /** 每日费用上限（元），超过后状态栏红色高亮 */
  dailyCostLimit: number;
  /** 按工具名粒度的确认开关。true=需要确认，false=跳过确认。
   *  未列入此 map 的危险工具默认按 confirmDangerous 处理 */
  toolConfirmOverrides: Record<string, boolean>;
}

// ============================================================
// 常量
// ============================================================

const SECURITY_KEY = "xiaolin-ai-security";

/** Shell 命令黑名单（不可配置，硬编码）
 * 与后端 lib.rs BLOCKED 列表保持一致 */
export const COMMAND_BLOCKLIST = [
  "format", "del", "rd", "rmdir", "mkfs", "dd",
  "diskpart", "diskmgmt", "reg delete",
  "shutdown", "taskkill /f /im explorer",
  "remove-item", "rm", "cipher /w", "bcdedit",
  "net user", "sc delete", "net stop", "takeown", "icacls",
];

/** 预编译的正则数组，避免每次调用 checkShellCommand 都重新编译 */
const BLOCKED_PATTERNS: ReadonlyArray<{ word: string; regex: RegExp }> = COMMAND_BLOCKLIST.map(
  (word) => ({
    word,
    regex: new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
  })
);

const DEFAULT_SECURITY: SecurityConfig = {
  confirmDangerous: true,
  dailyCostLimit: 10,
  toolConfirmOverrides: {},
};

// ============================================================
// 读写函数
// ============================================================

export function loadSecurity(): SecurityConfig {
  try {
    const raw = localStorage.getItem(SECURITY_KEY);
    if (!raw) return { ...DEFAULT_SECURITY };
    const parsed = JSON.parse(raw) as Partial<SecurityConfig>;
    // 合并默认值，保证新字段存在
    const config: SecurityConfig = {
      confirmDangerous: parsed.confirmDangerous ?? DEFAULT_SECURITY.confirmDangerous,
      dailyCostLimit: typeof parsed.dailyCostLimit === "number" && parsed.dailyCostLimit >= 0
        ? parsed.dailyCostLimit
        : DEFAULT_SECURITY.dailyCostLimit,
      toolConfirmOverrides: parsed.toolConfirmOverrides ?? {},
    };
    // 验证 toolConfirmOverrides 的值类型，确保是 boolean
    for (const k of Object.keys(config.toolConfirmOverrides)) {
      if (typeof config.toolConfirmOverrides[k] !== "boolean") {
        delete config.toolConfirmOverrides[k];
      }
    }
    return config;
  } catch {
    return { ...DEFAULT_SECURITY };
  }
}

export function saveSecurity(config: SecurityConfig): void {
  try {
    localStorage.setItem(SECURITY_KEY, JSON.stringify(config));
  } catch {
    // 静默失败
  }
}

// ============================================================
// 查询函数
// ============================================================

/**
 * 判断指定工具是否需要二次确认
 * 规则：
 *   1. 非危险工具（不在 DANGEROUS_TOOLS 中）→ 永不需要确认
 *   2. 全局开关 confirmDangerous=false → 所有工具都不确认
 *   3. toolConfirmOverrides[toolName] 存在 → 按该值
 *   4. 否则 → 默认需要确认（危险工具）
 */
export function shouldConfirmTool(toolName: string, config: SecurityConfig): boolean {
  // 非危险工具不需要确认
  if (!DANGEROUS_TOOLS.has(toolName)) return false;
  // 全局开关关闭 → 不确认
  if (!config.confirmDangerous) return false;
  // 工具粒度覆盖
  if (toolName in config.toolConfirmOverrides) {
    return config.toolConfirmOverrides[toolName];
  }
  // 默认危险工具需要确认
  return true;
}

/**
 * 检查 shell 命令是否被黑名单拦截
 * @returns 拦截原因，null 表示通过
 */
export function checkShellCommand(command: string): string | null {
  const lower = command.toLowerCase();
  for (const { word, regex } of BLOCKED_PATTERNS) {
    if (regex.test(lower)) {
      return `命令包含黑名单关键词「${word}」，已拦截`;
    }
  }
  return null;
}

/**
 * 检查 args 数组是否包含黑名单关键词（防止 cmd /c "format C:" 绕过）
 * @returns 拦截原因，null 表示通过
 */
export function checkShellArgs(args: string[]): string | null {
  if (!args || args.length === 0) return null;
  const joined = args.join(" ").toLowerCase();
  for (const { word, regex } of BLOCKED_PATTERNS) {
    if (regex.test(joined)) {
      return `参数包含黑名单关键词「${word}」，已拦截`;
    }
  }
  return null;
}

/**
 * 检查今日累计费用是否超过每日上限
 * @returns 超限原因，null 表示未超限或未配置上限
 */
export function checkDailyCostLimit(todayCost: number, config: SecurityConfig): string | null {
  if (config.dailyCostLimit <= 0) return null;
  if (todayCost >= config.dailyCostLimit) {
    return `今日累计费用 ¥${todayCost.toFixed(2)} 已超过每日上限 ¥${config.dailyCostLimit}，已拦截任务执行`;
  }
  return null;
}

/** 获取所有危险工具名（排序后） */
export function getDangerousToolList(): string[] {
  return Array.from(DANGEROUS_TOOLS).sort();
}
