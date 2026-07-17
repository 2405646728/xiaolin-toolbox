/**
 * 小林 AI · API 用量追踪核心模块
 *
 * 纯前端模块，不依赖 Tauri。
 * localStorage key 前缀统一为 "xiaolin-ai-usage-"。
 * 所有函数不抛错（容错），失败返回空数组或 0。
 */

// ============================================================
// 1. 类型定义
// ============================================================

export type UsageType = "text" | "vision";

export interface UsageRecord {
  timestamp: number;          // 毫秒时间戳
  model: string;              // 模型名，如 "gpt-4o-mini"
  type: UsageType;            // 文本 or 视觉调用
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  imageTokens?: number;       // 视觉调用专用
  cost: number;               // 人民币费用
  conversationId?: string;    // 对话 ID
}

export interface UsageSummary {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  imageTokens: number;
  cost: number;
  count: number;              // 调用次数
}

export interface ModelUsage {
  model: string;
  count: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface DailyUsage {
  date: string;               // YYYY-MM-DD
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  count: number;
}

// ============================================================
// 2. 模型单价表
// ============================================================

export const MODEL_PRICING: Record<string, {
  input: number;   // 元/1K input tokens
  output: number;  // 元/1K output tokens
  image?: number;  // 元/1K image tokens
}> = {
  // OpenAI (按 7.2 人民币/美元 估算)
  "gpt-4o":               { input: 0.018,   output: 0.072,  image: 0.0144 },
  "gpt-4o-mini":          { input: 0.00108, output: 0.00432, image: 0.0009 },
  "gpt-4-vision-preview": { input: 0.072,   output: 0.144,  image: 0.0144 },
  // DeepSeek
  "deepseek-chat":        { input: 0.001,   output: 0.002,  image: undefined },
  "deepseek-vision":      { input: 0.002,   output: 0.005,  image: 0.002 },
  // 智谱
  "glm-4":                { input: 0.1,     output: 0.1,    image: undefined },
  "glm-4v":               { input: 0.1,     output: 0.1,    image: 0.015 },
  "glm-4-flash":          { input: 0.0001,  output: 0.0001, image: undefined },
  // 通义
  "qwen-turbo":           { input: 0.002,   output: 0.006,  image: undefined },
  "qwen-plus":            { input: 0.004,   output: 0.012,  image: undefined },
  "qwen-max":             { input: 0.02,    output: 0.06,   image: undefined },
  "qwen-vl-max":          { input: 0.02,    output: 0.06,   image: 0.008 },
};

// 默认单价（模型未在表中时的兜底估值，元/1K tokens）
const DEFAULT_PRICING = { input: 0.002, output: 0.006, image: 0.002 };

// localStorage key 常量
const STORAGE_KEY_RECORDS = "xiaolin-ai-usage-records";
const STORAGE_KEY_BY_DATE = "xiaolin-ai-usage-by-date";

// ============================================================
// 内部工具函数
// ============================================================

/** 安全读取 localStorage 中的 JSON，失败返回 fallback */
function safeReadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 安全写入 localStorage，失败静默 */
function safeWriteJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 静默失败
  }
}

/** 把毫秒时间戳格式化为 YYYY-MM-DD（本地时区） */
function toDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 返回今日 00:00:00 的毫秒时间戳（本地时区） */
function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 返回本周一 00:00:00 的毫秒时间戳（本地时区，周一为一周开始） */
function startOfWeek(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // getDay(): 0=周日, 1=周一, ... 6=周六
  // 周一为开始：偏移量 = (day + 6) % 7
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

/** 返回本月 1 日 00:00:00 的毫秒时间戳（本地时区） */
function startOfMonth(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

/** 把一组记录聚合为 UsageSummary */
function summarize(records: UsageRecord[]): UsageSummary {
  const summary: UsageSummary = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    imageTokens: 0,
    cost: 0,
    count: 0,
  };
  for (const r of records) {
    summary.promptTokens += r.promptTokens || 0;
    summary.completionTokens += r.completionTokens || 0;
    summary.totalTokens += r.totalTokens || 0;
    summary.imageTokens += r.imageTokens || 0;
    summary.cost += r.cost || 0;
    summary.count += 1;
  }
  return summary;
}

// ============================================================
// 3. 费用计算
// ============================================================

/**
 * 按模型单价计算单次调用费用（人民币元）
 * 未找到模型时按默认 0.002/0.006 估算
 * 返回保留 6 位小数
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  imageTokens?: number
): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const inputPrice = pricing.input ?? DEFAULT_PRICING.input;
  const outputPrice = pricing.output ?? DEFAULT_PRICING.output;
  const imagePrice = pricing.image ?? DEFAULT_PRICING.image;

  const cost =
    (promptTokens / 1000) * inputPrice +
    (completionTokens / 1000) * outputPrice +
    ((imageTokens || 0) / 1000) * imagePrice;

  // 保留 6 位小数
  return Math.round(cost * 1e6) / 1e6;
}

// ============================================================
// 4. 记录用量
// ============================================================

/**
 * 记录一次 API 调用的用量
 * - 自动计算 cost（若未提供）
 * - 写入 localStorage 数组（key: xiaolin-ai-usage-records）
 * - 同时更新每日索引（key: xiaolin-ai-usage-by-date）
 * - localStorage 不可用时静默失败
 */
export function recordUsage(
  record: Omit<UsageRecord, "cost"> & { cost?: number }
): void {
  try {
    const now = record.timestamp ?? Date.now();

    // 自动计算 cost
    const cost =
      typeof record.cost === "number"
        ? Math.round(record.cost * 1e6) / 1e6
        : calculateCost(
            record.model,
            record.promptTokens,
            record.completionTokens,
            record.imageTokens
          );

    const fullRecord: UsageRecord = {
      timestamp: now,
      model: record.model,
      type: record.type,
      promptTokens: record.promptTokens || 0,
      completionTokens: record.completionTokens || 0,
      totalTokens:
        record.totalTokens ??
        (record.promptTokens || 0) + (record.completionTokens || 0),
      imageTokens: record.imageTokens,
      cost,
      conversationId: record.conversationId,
    };

    // 追加到全部记录
    const records = safeReadJSON<UsageRecord[]>(STORAGE_KEY_RECORDS, []);
    records.push(fullRecord);
    safeWriteJSON(STORAGE_KEY_RECORDS, records);

    // 更新每日索引（Record<dateKey, timestamp[]>）
    const byDate = safeReadJSON<Record<string, number[]>>(
      STORAGE_KEY_BY_DATE,
      {}
    );
    const dateKey = toDateKey(now);
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(now);
    safeWriteJSON(STORAGE_KEY_BY_DATE, byDate);
  } catch {
    // 静默失败
  }
}

// ============================================================
// 5. 查询函数
// ============================================================

/** 全部记录（用于面板展示） */
export function getAllUsage(): UsageRecord[] {
  return safeReadJSON<UsageRecord[]>(STORAGE_KEY_RECORDS, []);
}

/** 今日汇总 */
export function getUsageToday(): UsageSummary {
  const start = startOfToday();
  const records = getAllUsage().filter((r) => r.timestamp >= start);
  return summarize(records);
}

/** 本周汇总（从周一开始） */
export function getUsageWeek(): UsageSummary {
  const start = startOfWeek();
  const records = getAllUsage().filter((r) => r.timestamp >= start);
  return summarize(records);
}

/** 本月汇总 */
export function getUsageMonth(): UsageSummary {
  const start = startOfMonth();
  const records = getAllUsage().filter((r) => r.timestamp >= start);
  return summarize(records);
}

/** 按模型分组 */
export function getUsageByModel(): ModelUsage[] {
  const map = new Map<string, ModelUsage>();
  for (const r of getAllUsage()) {
    let entry = map.get(r.model);
    if (!entry) {
      entry = {
        model: r.model,
        count: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
      };
      map.set(r.model, entry);
    }
    entry.count += 1;
    entry.promptTokens += r.promptTokens || 0;
    entry.completionTokens += r.completionTokens || 0;
    entry.totalTokens += r.totalTokens || 0;
    entry.cost += r.cost || 0;
  }
  // 转为数组，按总 tokens 降序
  return Array.from(map.values()).sort((a, b) => b.totalTokens - a.totalTokens);
}

/** 按对话分组 */
export function getUsageByConversation(conversationId: string): UsageSummary {
  const records = getAllUsage().filter(
    (r) => r.conversationId === conversationId
  );
  return summarize(records);
}

/**
 * 近 N 天用量趋势（用于折线图）
 * 返回 N 个 DailyUsage，按日期升序排列
 * 包含今日（即使无数据也返回零值条目）
 */
export function getUsageTrend(days: number): DailyUsage[] {
  const result: DailyUsage[] = [];
  if (days <= 0) return result;

  // 预生成日期列表（包含今日，倒序回溯 N-1 天）
  const dateKeys: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dateKeys.push(toDateKey(d.getTime()));
  }

  // 利用每日索引快速查找（若索引可用），否则全量扫描
  const byDate = safeReadJSON<Record<string, number[]>>(
    STORAGE_KEY_BY_DATE,
    {}
  );
  const hasIndex = Object.keys(byDate).length > 0;

  const allRecords = hasIndex ? [] : getAllUsage();
  if (hasIndex) {
    // 收集所需日期的全部 timestamp
    const neededTimestamps = new Set<number>();
    for (const key of dateKeys) {
      const arr = byDate[key];
      if (Array.isArray(arr)) {
        for (const ts of arr) neededTimestamps.add(ts);
      }
    }
    // 仍需读取全部记录以获取完整字段（按 timestamp 索引）
    const all = getAllUsage();
    const filtered = all.filter((r) => neededTimestamps.has(r.timestamp));
    for (const key of dateKeys) {
      const dayStart = new Date(key + "T00:00:00").getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const dayRecords = filtered.filter(
        (r) => r.timestamp >= dayStart && r.timestamp < dayEnd
      );
      result.push(toDailyUsage(key, dayRecords));
    }
  } else {
    for (const key of dateKeys) {
      const dayStart = new Date(key + "T00:00:00").getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const dayRecords = allRecords.filter(
        (r) => r.timestamp >= dayStart && r.timestamp < dayEnd
      );
      result.push(toDailyUsage(key, dayRecords));
    }
  }

  return result;
}

/** 把一天内的记录聚合为 DailyUsage */
function toDailyUsage(dateKey: string, records: UsageRecord[]): DailyUsage {
  const s = summarize(records);
  return {
    date: dateKey,
    promptTokens: s.promptTokens,
    completionTokens: s.completionTokens,
    totalTokens: s.totalTokens,
    cost: s.cost,
    count: s.count,
  };
}

/**
 * 检查今日费用是否超阈值
 * 返回预警状态
 */
export function checkDailyLimit(limitYuan: number): {
  exceeded: boolean;
  todayCost: number;
  limit: number;
} {
  const today = getUsageToday();
  return {
    exceeded: today.cost >= limitYuan,
    todayCost: today.cost,
    limit: limitYuan,
  };
}

// ============================================================
// 6. 重置用量
// ============================================================

/**
 * 清空所有用量记录
 * 弹窗确认由调用方做，本函数直接清空 localStorage
 */
export function resetUsage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_RECORDS);
    localStorage.removeItem(STORAGE_KEY_BY_DATE);
  } catch {
    // 静默失败
  }
}

// ============================================================
// 7. 导出 CSV
// ============================================================

/**
 * 导出用量明细为 CSV 字符串
 * 字段：时间,模型,类型,prompt_tokens,completion_tokens,total_tokens,image_tokens,费用,对话ID
 * 时间列用 ISO 8601 格式，第一行为表头
 */
export function exportUsageCsv(): string {
  const headers = [
    "时间",
    "模型",
    "类型",
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "image_tokens",
    "费用",
    "对话ID",
  ];

  const rows: string[] = [headers.join(",")];

  const records = getAllUsage();
  for (const r of records) {
    const isoTime = new Date(r.timestamp).toISOString();
    const row = [
      isoTime,
      r.model,
      r.type,
      String(r.promptTokens ?? 0),
      String(r.completionTokens ?? 0),
      String(r.totalTokens ?? 0),
      String(r.imageTokens ?? 0),
      String(r.cost ?? 0),
      r.conversationId ?? "",
    ];
    rows.push(row.map(escapeCsvCell).join(","));
  }

  return rows.join("\n");
}

/** CSV 单元格转义：含逗号、引号、换行时用双引号包裹并把内部引号翻倍 */
function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ============================================================
// 8. 单位格式化辅助
// ============================================================

/**
 * 格式化 token 数量
 * 1234 -> "1.2k"，1234567 -> "1.2M"
 */
export function formatTokens(n: number): string {
  if (n < 1000) {
    return String(Math.round(n));
  }
  if (n < 1_000_000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

/**
 * 格式化人民币费用
 * 0.423456 -> "¥0.42"
 */
export function formatCost(yuan: number): string {
  return "¥" + yuan.toFixed(2);
}
