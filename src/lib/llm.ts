// 大模型 API 客户端
// 基于 OpenAI 兼容协议，支持文本对话（流式 / 非流式）、视觉多模态、Function Calling
// 使用原生 fetch + ReadableStream 解析 SSE，不依赖 axios 等额外包

import { recordUsage } from "./usage";

// ---------- 类型定义 ----------

/** LLM 配置 */
export interface LLMConfig {
  baseUrl: string; // 如 "https://api.openai.com/v1"
  apiKey: string; // API Key
  model: string; // 文本模型，如 "gpt-4o-mini"
  visionModel: string; // 视觉模型，如 "gpt-4o"
  temperature: number; // 0-2
  maxTokens: number; // 最大 tokens
}

/** 对话消息 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

/** 流式对话选项 */
export interface StreamChatOptions {
  config: LLMConfig;
  messages: ChatMessage[];
  tools?: any[]; // OpenAI Function Calling 工具定义
  onDelta?: (delta: string) => void; // 流式回调
  signal?: AbortSignal; // 中断信号
}

/** 对话返回结果 */
export interface ChatResult {
  content: string;
  tool_calls?: any[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** 视觉对话选项 */
export interface VisionChatOptions {
  config: LLMConfig;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } } // url 为 data:image/png;base64,xxx
    >;
  }>;
  signal?: AbortSignal;
}

/** 视觉对话返回结果 */
export interface VisionChatResult {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    image_tokens?: number;
  };
}

// ---------- 错误类型 ----------

/** 401 认证失败 */
export class AuthError extends Error {
  constructor(message = "API 认证失败，请检查 API Key") {
    super(message);
    this.name = "AuthError";
  }
}

/** 网络错误 */
export class NetworkError extends Error {
  constructor(message = "无法连接到 AI 服务，请检查网络或 Base URL") {
    super(message);
    this.name = "NetworkError";
  }
}

/** 429 限流 */
export class RateLimitError extends Error {
  constructor(message = "请求过于频繁，已被限流，请稍后再试") {
    super(message);
    this.name = "RateLimitError";
  }
}

/** 余额不足 */
export class QuotaError extends Error {
  constructor(message = "API 余额不足，请充值后重试") {
    super(message);
    this.name = "QuotaError";
  }
}

// ---------- 配置管理 ----------

const LLM_CONFIG_KEY = "xiaolin-ai-llm-config";

/** 从 localStorage 读取配置，未配置时返回 null */
export function loadLLMConfig(): LLMConfig | null {
  try {
    const raw = localStorage.getItem(LLM_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LLMConfig;
    // 基础校验，字段缺失视为未配置
    if (!parsed.baseUrl || !parsed.apiKey || !parsed.model) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 保存配置到 localStorage */
export function saveLLMConfig(config: LLMConfig): void {
  localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
}

/** 掩码 API Key，如 "sk-***xyz" */
export function maskApiKey(key: string): string {
  if (!key) return "";
  // 太短的 key 全部掩码
  if (key.length <= 8) return "*".repeat(key.length);
  const head = key.slice(0, 3);
  const tail = key.slice(-3);
  return `${head}***${tail}`;
}

// ---------- 内部工具函数 ----------

/** 简单估算 token 数：按字符数 / 4 估算 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** 累积估算 messages 的 prompt tokens */
function estimatePromptTokens(messages: ChatMessage[]): number {
  const totalText = messages
    .map((m) => {
      let s = m.content || "";
      if (m.tool_calls) s += JSON.stringify(m.tool_calls);
      return s;
    })
    .join("");
  return estimateTokens(totalText);
}

/** 根据 HTTP 状态码抛出对应错误 */
function throwErrorByStatus(status: number, bodyText: string): never {
  // 尝试从响应体提取错误信息
  let serverMsg = "";
  try {
    const parsed = JSON.parse(bodyText);
    serverMsg = parsed?.error?.message || parsed?.message || "";
  } catch {
    // 非 JSON 响应体，忽略
  }

  if (status === 401) {
    throw new AuthError(serverMsg || undefined);
  }
  if (status === 429) {
    throw new RateLimitError(serverMsg || undefined);
  }
  // 余额不足常见 402 / 403 + quota 文案，部分服务用 429
  if (status === 402 || /quota|余额|insufficient/i.test(serverMsg)) {
    throw new QuotaError(serverMsg || undefined);
  }
  // 其他错误统一作为网络错误抛出
  throw new NetworkError(serverMsg || `请求失败，HTTP ${status}`);
}

/** 调用 recordUsage 上报用量，吞掉异常避免影响主流程 */
function safeRecordUsage(record: {
  model: string;
  type: "text" | "vision";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  imageTokens?: number;
}): void {
  try {
    recordUsage({
      timestamp: Date.now(),
      model: record.model,
      type: record.type,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      totalTokens: record.totalTokens,
      imageTokens: record.imageTokens,
      cost: 0, // 费用由 usage 模块根据 MODEL_PRICING 计算，这里传 0 由其覆盖
      conversationId: undefined,
    });
  } catch {
    // 用量记录失败不影响主流程
  }
}

// ---------- streamChat 流式对话 ----------

/**
 * 流式对话
 * 使用 fetch + ReadableStream + TextDecoder 解析 SSE
 * 每个 `data: {...}` 行提取 delta.content 调用 onDelta，累积 content 与 tool_calls
 */
export async function streamChat(options: StreamChatOptions): Promise<ChatResult> {
  const { config, messages, tools, onDelta, signal } = options;

  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: true,
    // 请求返回 usage 字段（OpenAI 在 stream_options.include_usage 时会返回）
    stream_options: { include_usage: true },
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    // 中断不算网络错误
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new NetworkError();
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throwErrorByStatus(response.status, errText);
  }

  if (!response.body) {
    throw new NetworkError("响应体为空");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  let content = "";
  const toolCalls: any[] = [];
  let usage: ChatResult["usage"] | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 按行处理 SSE
      let lineEnd: number;
      while ((lineEnd = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);

        if (!line) continue;
        if (line.startsWith(":")) continue; // SSE 注释行
        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          // 流结束
          continue;
        }

        let chunk: any;
        try {
          chunk = JSON.parse(data);
        } catch {
          // 跳过无法解析的行
          continue;
        }

        // 提取 usage（通常最后一个 chunk 携带）
        if (chunk.usage) {
          usage = {
            prompt_tokens: chunk.usage.prompt_tokens ?? 0,
            completion_tokens: chunk.usage.completion_tokens ?? 0,
            total_tokens: chunk.usage.total_tokens ?? 0,
          };
        }

        const choices = chunk.choices;
        if (!Array.isArray(choices) || choices.length === 0) continue;
        const choice = choices[0];
        const delta = choice?.delta;
        if (!delta) continue;

        // 累积内容
        if (typeof delta.content === "string" && delta.content.length > 0) {
          content += delta.content;
          if (onDelta) onDelta(delta.content);
        }

        // 累积 tool_calls（流式分片返回，需按 index 合并）
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx]) {
              toolCalls[idx] = {
                id: tc.id || "",
                type: tc.type || "function",
                function: { name: "", arguments: "" },
              };
            }
            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }
      }
    }
  } catch (err) {
    // 中断时返回已累积的内容
    if (err instanceof DOMException && err.name === "AbortError") {
      // 仍然记录用量后抛出
      const finalUsage: ChatResult["usage"] = usage || {
        prompt_tokens: estimatePromptTokens(messages),
        completion_tokens: estimateTokens(content),
        total_tokens: 0,
      };
      if (finalUsage.total_tokens === 0) {
        finalUsage.total_tokens = finalUsage.prompt_tokens + finalUsage.completion_tokens;
      }
      safeRecordUsage({
        model: config.model,
        type: "text",
        promptTokens: finalUsage.prompt_tokens,
        completionTokens: finalUsage.completion_tokens,
        totalTokens: finalUsage.total_tokens,
      });
      throw err;
    }
    throw new NetworkError();
  }

  // usage 缺失则估算
  if (!usage) {
    const prompt = estimatePromptTokens(messages);
    const completion = estimateTokens(content);
    usage = {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: prompt + completion,
    };
  }

  // 上报用量
  safeRecordUsage({
    model: config.model,
    type: "text",
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  });

  const result: ChatResult = {
    content,
    usage,
  };
  // 仅在有 tool_calls 时附加
  if (toolCalls.length > 0) {
    result.tool_calls = toolCalls;
  }
  return result;
}

// ---------- chatCompletion 非流式对话 ----------

/** 非流式对话，与 streamChat 相同但不流式 */
export async function chatCompletion(
  options: Omit<StreamChatOptions, "onDelta">,
): Promise<ChatResult> {
  const { config, messages, tools, signal } = options;

  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new NetworkError();
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throwErrorByStatus(response.status, errText);
  }

  const data = await response.json().catch(() => null);
  if (!data) {
    throw new NetworkError("响应解析失败");
  }

  const choice = data.choices?.[0];
  const message = choice?.message || {};
  const content: string = message.content || "";
  const toolCalls: any[] | undefined = Array.isArray(message.tool_calls)
    ? message.tool_calls
    : undefined;

  // usage 缺失则估算
  let usage: ChatResult["usage"];
  if (data.usage) {
    usage = {
      prompt_tokens: data.usage.prompt_tokens ?? 0,
      completion_tokens: data.usage.completion_tokens ?? 0,
      total_tokens: data.usage.total_tokens ?? 0,
    };
  } else {
    const prompt = estimatePromptTokens(messages);
    const completion = estimateTokens(content);
    usage = {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: prompt + completion,
    };
  }

  // 上报用量
  safeRecordUsage({
    model: config.model,
    type: "text",
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  });

  const result: ChatResult = { content, usage };
  if (toolCalls) result.tool_calls = toolCalls;
  return result;
}

// ---------- visionChat 多模态对话 ----------

/** 视觉多模态对话，使用 config.visionModel，不流式 */
export async function visionChat(options: VisionChatOptions): Promise<VisionChatResult> {
  const { config, messages, signal } = options;

  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model: config.visionModel,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new NetworkError();
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throwErrorByStatus(response.status, errText);
  }

  const data = await response.json().catch(() => null);
  if (!data) {
    throw new NetworkError("响应解析失败");
  }

  const choice = data.choices?.[0];
  const content: string = choice?.message?.content || "";

  // 估算 prompt 文本字符数（不含图片 base64）
  const promptText = messages
    .map((m) =>
      m.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .join(""),
    )
    .join("");
  const promptEstimate = estimateTokens(promptText);
  const completionEstimate = estimateTokens(content);

  let usage: VisionChatResult["usage"];
  let imageTokens = 0;
  if (data.usage) {
    // 部分视觉模型返回 prompt_tokens_details.cached_tokens 或单独字段
    const promptTokens = data.usage.prompt_tokens ?? promptEstimate;
    const completionTokens = data.usage.completion_tokens ?? completionEstimate;
    const totalTokens =
      data.usage.total_tokens ?? promptTokens + completionTokens;
    // 尝试提取图片 token
    imageTokens =
      data.usage.prompt_tokens_details?.image_tokens ??
      data.usage.image_tokens ??
      0;
    usage = {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      image_tokens: imageTokens,
    };
  } else {
    usage = {
      prompt_tokens: promptEstimate,
      completion_tokens: completionEstimate,
      total_tokens: promptEstimate + completionEstimate,
      image_tokens: 0,
    };
  }

  // 上报用量，type 标记为 vision
  safeRecordUsage({
    model: config.visionModel,
    type: "vision",
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    imageTokens: imageTokens,
  });

  return { content, usage };
}
