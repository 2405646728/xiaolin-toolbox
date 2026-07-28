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

/** Shell 命令黑名单（不可配置，硬编码） */
export const COMMAND_BLOCKLIST = [
  "format", "del", "rd", "rmdir", "mkfs", "dd",
  "diskpart", "diskmgmt", "reg delete",
  "shutdown", "taskkill /f /im explorer",
];

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
    return {
      confirmDangerous: parsed.confirmDangerous ?? DEFAULT_SECURITY.confirmDangerous,
      dailyCostLimit: parsed.dailyCostLimit ?? DEFAULT_SECURITY.dailyCostLimit,
      toolConfirmOverrides: parsed.toolConfirmOverrides ?? {},
    };
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
  for (const blocked of COMMAND_BLOCKLIST) {
    // 用单词边界匹配，避免误伤（如 "delete" 不会匹配 "deletefile"）
    const pattern = new RegExp(`\\b${blocked.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(lower)) {
      return `命令包含黑名单关键词「${blocked}」，已拦截`;
    }
  }
  return null;
}

/** 获取所有危险工具名（排序后） */
export function getDangerousToolList(): string[] {
  return Array.from(DANGEROUS_TOOLS).sort();
}
