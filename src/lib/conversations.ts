/**
 * 小林 AI · 多对话会话管理模块
 *
 * 纯前端模块，不依赖 Tauri。
 * localStorage key：
 *   - "xiaolin-ai-conversations"          存放 Conversation[] 数组
 *   - "xiaolin-ai-current-conversation"   存放当前活跃会话 ID
 * 所有函数容错，localStorage 不可用时不抛错，只在内存中维护（模块级数组）。
 */

import type { ChatMessage } from "./llm";

// ============================================================
// 1. 类型定义
// ============================================================

/** 会话消息：在 ChatMessage 基础上扩展 UI 展示字段 */
export interface ConversationMessage extends ChatMessage {
  id: string;                // 消息唯一 ID
  timestamp: number;         // 毫秒时间戳
  // 扩展字段用于 UI 展示
  toolCall?: {
    name: string;
    args: Record<string, any>;
    result?: { success: boolean; data?: any; error?: string };
    status: "pending" | "running" | "done" | "failed";
  };
  screenshot?: string;       // base64 截图数据（仅 screenshot 工具调用消息）
  thinking?: string;         // AI 思考过程文本
  usage?: {                  // 单条消息的 token 用量
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** 对话会话 */
export interface Conversation {
  id: string;                // 会话唯一 ID
  title: string;             // 会话标题
  messages: ConversationMessage[];
  createdAt: number;         // 毫秒时间戳
  updatedAt: number;         // 毫秒时间戳
}

// ============================================================
// 2. 常量与内部工具
// ============================================================

const STORAGE_KEY_CONVERSATIONS = "xiaolin-ai-conversations";
const STORAGE_KEY_CURRENT = "xiaolin-ai-current-conversation";

/** 模块级缓存：作为 localStorage 的内存镜像
 *  localStorage 不可用时仍可在内存中维护数据
 *  null 表示尚未加载 */
let conversationsCache: Conversation[] | null = null;

/** 当前会话 ID 的内存兜底（localStorage 不可用时使用） */
let currentIdFallback: string | null = null;

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

/** 生成唯一 ID：优先用 crypto.randomUUID，不可用时降级为 Date.now + 随机串 */
function generateId(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    // fallthrough
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 加载全部会话到缓存（懒加载，按 id 去重） */
function loadConversations(): Conversation[] {
  if (conversationsCache !== null) return conversationsCache;
  const data = safeReadJSON<Conversation[]>(STORAGE_KEY_CONVERSATIONS, []);
  // 按 id 去重（保留后出现的）
  const map = new Map<string, Conversation>();
  if (Array.isArray(data)) {
    for (const c of data) {
      if (c && typeof c.id === "string") {
        map.set(c.id, c);
      }
    }
  }
  conversationsCache = Array.from(map.values());
  return conversationsCache;
}

/** 把当前缓存写入 localStorage（写穿） */
function saveConversations(list: Conversation[]): void {
  conversationsCache = list;
  safeWriteJSON(STORAGE_KEY_CONVERSATIONS, list);
}

// ============================================================
// 3. 会话 CRUD
// ============================================================

/**
 * 创建新会话
 * @param title 会话标题，默认 "新对话"
 */
export function createConversation(title?: string): Conversation {
  const now = Date.now();
  const conv: Conversation = {
    id: generateId(),
    title: title || "新对话",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  const list = loadConversations();
  list.push(conv);
  saveConversations(list);
  return conv;
}

/** 列出所有会话（按 updatedAt 降序） */
export function listConversations(): Conversation[] {
  const list = loadConversations();
  // 返回副本并排序，避免调用方污染缓存
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 获取单个会话，不存在返回 null */
export function getConversation(id: string): Conversation | null {
  const list = loadConversations();
  const conv = list.find((c) => c.id === id);
  return conv ?? null;
}

/**
 * 更新会话（追加消息、修改标题等）
 * 自动刷新 updatedAt（除非 updates 显式提供 updatedAt）
 */
export function updateConversation(
  id: string,
  updates: Partial<Conversation>
): void {
  const list = loadConversations();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  const updatedAt = updates.updatedAt ?? Date.now();
  list[idx] = { ...list[idx], ...updates, updatedAt };
  saveConversations(list);
}

/** 删除会话 */
export function deleteConversation(id: string): void {
  const list = loadConversations();
  const next = list.filter((c) => c.id !== id);
  if (next.length !== list.length) {
    saveConversations(next);
  }
  // 若删除的正是当前会话，清空当前会话引用
  if (getCurrentConversationId() === id) {
    setCurrentConversationId(null);
  }
}

/** 追加消息到会话（同时刷新 updatedAt） */
export function appendMessage(
  conversationId: string,
  message: ConversationMessage
): void {
  const list = loadConversations();
  const conv = list.find((c) => c.id === conversationId);
  if (!conv) return;
  conv.messages.push(message);
  conv.updatedAt = Date.now();
  saveConversations(list);
}

/** 清空会话消息（保留会话本身） */
export function clearMessages(conversationId: string): void {
  const list = loadConversations();
  const conv = list.find((c) => c.id === conversationId);
  if (!conv) return;
  conv.messages = [];
  conv.updatedAt = Date.now();
  saveConversations(list);
}

// ============================================================
// 4. 当前会话管理
// ============================================================

/** 获取当前活跃会话 ID */
export function getCurrentConversationId(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY_CURRENT);
    if (v) return v;
  } catch {
    // 静默失败
  }
  return currentIdFallback;
}

/** 设置当前活跃会话，传 null 清空 */
export function setCurrentConversationId(id: string | null): void {
  currentIdFallback = id;
  try {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY_CURRENT);
    } else {
      localStorage.setItem(STORAGE_KEY_CURRENT, id);
    }
  } catch {
    // 静默失败
  }
}

/** 获取当前活跃会话对象 */
export function getCurrentConversation(): Conversation | null {
  const id = getCurrentConversationId();
  if (!id) return null;
  return getConversation(id);
}

// ============================================================
// 5. 自动生成标题
// ============================================================

/**
 * 根据首条用户消息生成对话标题
 * 简单实现：截取前 20 个字符，超出则补 "..."，不调用 LLM
 */
export function generateConversationTitle(
  firstUserMessage: string
): string {
  const text = (firstUserMessage || "").trim();
  if (text.length <= 20) return text || "新对话";
  return text.slice(0, 20) + "...";
}

// ============================================================
// 6. 导出消息为 OpenAI 格式
// ============================================================

/**
 * 把会话消息导出为 OpenAI ChatMessage 格式
 * 过滤掉 thinking / toolCall / screenshot / usage 等 UI 字段
 * 只保留 role / content / tool_calls / tool_call_id
 */
export function toChatMessages(conversation: Conversation): ChatMessage[] {
  return conversation.messages.map((m) => {
    const msg: ChatMessage = {
      role: m.role,
      content: m.content,
    };
    if (m.tool_calls) msg.tool_calls = m.tool_calls;
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    return msg;
  });
}

// ============================================================
// 7. Token 截断
// ============================================================

/** 估算单条消息的 tokens：(content 字符数 + tool_calls JSON 字符数) / 4 */
function estimateMessageTokens(m: ChatMessage): number {
  const contentStr = typeof m.content === "string" ? m.content : "";
  let s = contentStr || "";
  if (m.tool_calls) {
    try {
      s += JSON.stringify(m.tool_calls);
    } catch {
      // tool_calls 含不可序列化对象时忽略
    }
  }
  return Math.ceil(s.length / 4);
}

/**
 * 按最大 token 数截断消息列表
 * - 从最早的非 system 消息开始删除，保留 system 消息
 * - truncated 标志位表示是否发生过截断
 *
 * @param messages 待截断的消息列表
 * @param maxTokens 最大 token 数，默认 8000
 */
export function truncateMessages(
  messages: ChatMessage[],
  maxTokens: number = 8000
): { messages: ChatMessage[]; truncated: boolean } {
  let totalTokens = messages.reduce(
    (sum, m) => sum + estimateMessageTokens(m),
    0
  );
  if (totalTokens <= maxTokens) {
    return { messages: [...messages], truncated: false };
  }

  // 从最早的非 system 消息开始删除
  const result = [...messages];
  let i = 0;
  while (totalTokens > maxTokens && i < result.length) {
    if (result[i].role === "system") {
      i++;
      continue;
    }
    const removed = result.splice(i, 1)[0];
    totalTokens -= estimateMessageTokens(removed);
    // 不递增 i：删除后下一条消息移动到当前 i 位置
  }

  return { messages: result, truncated: true };
}
