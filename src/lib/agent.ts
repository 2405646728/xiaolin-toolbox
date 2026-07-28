// 小林 AI · ReAct Agent 循环引擎
// 实现"思考→行动→观察→反思"循环，让 AI 能自主分解并执行多步骤复杂任务
// 核心流程：调用 LLM → 检测 tool_calls → 执行工具 → 把结果喂回 LLM → 重复直到完成
// 设计要点：
//   1. 单一 runAgent 入口，通过 callbacks 实时上报每一步状态
//   2. 视觉工具（screenshot / screenshot_region）特殊处理：截图以多模态消息回传给模型
//   3. 最大步数兜底（默认 20），避免无限循环；中断信号随时可停止
//   4. 所有回调 try/catch 包裹，回调异常不影响主流程

import { chatCompletion, visionChat, type ChatMessage, type LLMConfig } from "./llm";
import {
  executeTool,
  TOOL_DEFINITIONS,
  type ToolExecutionResult,
} from "./tools";
import { loadSecurity, shouldConfirmTool, checkShellCommand } from "./security";

// ============================================================
// 1. 类型定义
// ============================================================

/** 单个 ReAct 步骤记录 */
export interface AgentStep {
  index: number; // 步骤序号（从 1 开始）
  type: "thinking" | "tool_call" | "tool_result" | "final" | "error";
  // thinking: AI 思考文本
  // tool_call: AI 决定调用工具
  // tool_result: 工具执行结果
  // final: AI 最终回复（任务完成）
  // error: 错误信息
  content?: string; // thinking/final/error 的文本
  toolCall?: {
    id: string;
    name: string;
    args: Record<string, any>;
  };
  toolResult?: ToolExecutionResult;
  screenshot?: string; // 如果工具是 screenshot，存 base64（不含 data: 前缀）
  timestamp: number;
}

/** Agent 回调集合，所有回调都被 try/catch 包裹，异常不影响主流程 */
export interface AgentCallbacks {
  onStep?: (step: AgentStep) => void; // 每步回调（最通用）
  onThinking?: (text: string) => void; // AI 思考文本
  onToolCall?: (toolCall: AgentStep["toolCall"]) => void;
  onToolResult?: (result: ToolExecutionResult, toolName: string) => void;
  onScreenshot?: (base64: string) => void; // 截图回调
  onFinal?: (text: string) => void; // 最终回复
  onError?: (error: string) => void;
  onComplete?: (
    steps: AgentStep[],
    totalUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }
  ) => void;
}

/** Agent 运行选项 */
export interface AgentOptions {
  config: LLMConfig;
  messages: ChatMessage[]; // 初始消息（含 system + user）
  conversationId?: string;
  maxSteps?: number; // 默认 20
  signal?: AbortSignal; // 中断信号
  callbacks?: AgentCallbacks;
}

/** Agent 运行结果 */
export interface AgentResult {
  steps: AgentStep[];
  finalText: string;
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================
// 2. 系统提示词
// ============================================================

export const SYSTEM_PROMPT = `你是小林 AI，一个能自主操控电脑的桌面 AI 助手。你能通过调用工具来完成用户的任务。

## 你的能力
- 启动应用、打开网页、搜索网页
- 模拟鼠标移动、点击、双击、右键、拖拽、滚动
- 模拟键盘输入文字、按键、组合键
- 截屏并通过视觉识别屏幕内容
- 读写文件、管理进程、控制窗口
- 读取系统状态（CPU/内存/磁盘/网络）

## 工作流程（ReAct）
面对复杂任务时，按以下循环工作：
1. **思考**：分析当前状态，决定下一步该做什么
2. **行动**：调用合适的工具
3. **观察**：查看工具返回的结果（截图、文件内容、命令输出等）
4. **反思**：根据观察结果调整策略
重复以上循环直到任务完成。

## 关键规则
1. **每轮只调用一个工具**：不要一次返回多个 tool_calls。调用一个工具后，等观察结果再决定下一步。这是强制要求。
2. **截屏先行**：操作 GUI 前先调用 screenshot 看清屏幕，再决定点击哪里
3. **坐标精准**：根据截图判断 UI 元素的精确像素坐标，再调用 mouse_click
4. **小步前进**：每步只做一件事，观察结果后再决定下一步
5. **错误重试**：如果点击没生效，重新截屏观察，调整坐标重试
6. **用户拒绝**：如果用户拒绝了某个危险操作，不要重复请求，告知用户并询问替代方案
7. **任务完成**：任务完成后用简洁的中文总结结果，不再调用工具

## 网页操作场景（重要）
**指令识别**：以下表达都表示「在网站内搜索」，不要用 search_web 工具：
- 「打开B站搜索XX」=「在B站网站内搜索XX」
- 「去淘宝搜索XX」=「在淘宝网站内搜索XX」
- 「在知乎搜索XX」=「在知乎网站内搜索XX」

正确流程（每步只调用一个工具，观察结果后再进行下一步）：
1. **open_url** 打开目标网站（如 https://www.bilibili.com）
2. **screenshot** 截屏看清页面布局和搜索框位置
3. **mouse_click** 点击网站内的搜索框（根据截图判断坐标）
4. **keyboard_type** 输入搜索关键词
5. **keyboard_press** 按 Enter 提交搜索
6. **screenshot** 截屏查看搜索结果

**只有**当用户说「打开浏览器搜索XX」（没有指定具体网站）时，才使用 search_web 工具。

## 安全边界
- 不会执行 format/del/rd/rmdir 等破坏性命令
- 删除文件、终止进程、关机等危险操作需要用户确认
- 不会修改系统关键目录（C:\\Windows 等）`;

// ============================================================
// 3. 辅助函数
// ============================================================

/** 生成工具调用 ID（OpenAI 格式：call_xxx） */
function generateToolCallId(): string {
  return "call_" + Math.random().toString(36).substring(2, 11);
}

/** 简单估算 tokens（备用，按字符数 / 4） */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** 安全触发回调，吞掉异常避免影响主流程 */
function safeCall(
  fn: ((...args: any[]) => void) | undefined,
  ...args: any[]
): void {
  if (typeof fn !== "function") return;
  try {
    fn(...args);
  } catch {
    // 回调异常不影响主流程
  }
}

/** 判断是否为视觉工具（截图类，需要把图片回传给模型） */
function isVisionTool(name: string): boolean {
  return name === "screenshot" || name === "screenshot_region";
}

/**
 * 从工具执行结果中提取 base64 截图（不含 data: 前缀）
 * Rust 端 screenshot 命令返回纯 base64 字符串
 */
function extractScreenshot(result: ToolExecutionResult): string | undefined {
  if (!result.success || !result.data) return undefined;
  const data = result.data;
  // 标准形式：纯 base64 字符串
  if (typeof data === "string") {
    // 去掉可能存在的 data: 前缀
    const match = data.match(/^data:image\/\w+;base64,(.+)$/);
    return match ? match[1] : data;
  }
  // 兼容 { base64 } / { data } 对象形式
  if (data && typeof data === "object") {
    const d = data as any;
    if (typeof d.base64 === "string") return d.base64;
    if (typeof d.data === "string") return d.data;
  }
  return undefined;
}

/** 解析 tool_call 的 arguments 字符串为对象，失败返回空对象 */
function parseToolArgs(raw: string | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// ============================================================
// 4. runAgent 主函数
// ============================================================

/**
 * ReAct Agent 主循环
 *
 * 流程：
 *   1. messages = [system, ...user messages]
 *   2. for step 1 to maxSteps:
 *      a. 调用 chatCompletion({ config, messages, tools: TOOL_DEFINITIONS })
 *      b. 累积 usage
 *      c. 如果 response.tool_calls 为空 → 最终回复，触发 onFinal，返回
 *      d. 否则对每个 tool_call：执行工具 → 触发回调 → 把结果追加到 messages
 *      e. 检查 signal.aborted
 *   3. 超过 maxSteps 时触发 onError
 *
 * @param options Agent 运行选项
 * @returns steps / finalText / totalUsage
 */
export async function runAgent(options: AgentOptions): Promise<AgentResult> {
  const {
    config,
    messages,
    conversationId,
    maxSteps = 20,
    signal,
    callbacks = {},
  } = options;

  const steps: AgentStep[] = [];
  const totalUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  // 工作消息列表（副本），循环中持续追加 assistant / tool 消息
  const workingMessages: ChatMessage[] = [...messages];

  let finalText = "";

  try {
    for (let step = 1; step <= maxSteps; step++) {
      // ---- 中断检查（每步开始）----
      if (signal?.aborted) {
        pushErrorStep(steps, step, "任务已中断", callbacks);
        break;
      }

      // ---- 调用 LLM ----
      let response;
      try {
        response = await chatCompletion({
          config,
          messages: workingMessages,
          tools: TOOL_DEFINITIONS,
          signal,
          conversationId,
        });
      } catch (err: any) {
        // 中断单独处理
        if (err instanceof DOMException && err.name === "AbortError") {
          pushErrorStep(steps, step, "任务已中断", callbacks);
        } else {
          const errMsg = err?.message || "LLM 调用失败";
          pushErrorStep(steps, step, errMsg, callbacks);
        }
        break;
      }

      // ---- 累积 usage ----
      totalUsage.promptTokens += response.usage.prompt_tokens;
      totalUsage.completionTokens += response.usage.completion_tokens;
      totalUsage.totalTokens += response.usage.total_tokens;

      // ---- 完成判定：没有 tool_calls 即为最终回复 ----
      if (!response.tool_calls || response.tool_calls.length === 0) {
        finalText = response.content || "";

        // thinking 回调（最终回复也作为思考文本推送一次）
        if (finalText) {
          safeCall(callbacks.onThinking, finalText);
        }

        const finalStep: AgentStep = {
          index: step,
          type: "final",
          content: finalText,
          timestamp: Date.now(),
        };
        steps.push(finalStep);
        safeCall(callbacks.onFinal, finalText);
        safeCall(callbacks.onStep, finalStep);
        break;
      }

      // ---- thinking 步骤（AI 在调用工具前的思考文本）----
      if (response.content) {
        safeCall(callbacks.onThinking, response.content);
        const thinkingStep: AgentStep = {
          index: step,
          type: "thinking",
          content: response.content,
          timestamp: Date.now(),
        };
        steps.push(thinkingStep);
        safeCall(callbacks.onStep, thinkingStep);
      }

      // ---- 把 assistant 消息（含 tool_calls）追加到 messages（每个 LLM 响应一次）----
      workingMessages.push({
        role: "assistant",
        content: response.content || "",
        tool_calls: response.tool_calls,
      });

      // ---- 依次执行每个 tool_call ----
      // 强制单步执行：若一轮返回多个 tool_calls，只执行第一个，其余推迟
      // 这样 AI 必须观察上一步结果后再决定下一步，避免盲目批量操作
      let aborted = false;
      const toolCallList = response.tool_calls || [];
      for (let tcIdx = 0; tcIdx < toolCallList.length; tcIdx++) {
        const tc = toolCallList[tcIdx];
        // 中断检查（工具执行前）
        if (signal?.aborted) {
          aborted = true;
          break;
        }

        // 第 2 个及之后的 tool_call 不执行，返回推迟提示（保持 OpenAI 协议合规）
        if (tcIdx > 0) {
          const toolCallId = tc?.id || generateToolCallId();
          const toolName = tc?.function?.name || "unknown";
          const toolCallInfo = { id: toolCallId, name: toolName, args: {} };
          const deferredResult = {
            success: false,
            error: "已推迟执行。请先观察上一个工具的结果（尤其是截图），再决定下一步操作。每轮只执行一个工具。",
          };
          const deferredStep: AgentStep = {
            index: step,
            type: "tool_result",
            toolCall: toolCallInfo,
            toolResult: deferredResult,
            timestamp: Date.now(),
          };
          steps.push(deferredStep);
          safeCall(callbacks.onToolResult, deferredResult, toolName);
          safeCall(callbacks.onStep, deferredStep);
          workingMessages.push({
            role: "tool",
            content: JSON.stringify(deferredResult),
            tool_call_id: toolCallId,
          });
          continue;
        }

        const toolName: string = tc?.function?.name || "unknown";
        const toolArgs: Record<string, any> = parseToolArgs(
          tc?.function?.arguments
        );
        const toolCallId: string = tc?.id || generateToolCallId();
        const toolCallInfo = { id: toolCallId, name: toolName, args: toolArgs };

        // tool_call 步骤
        const toolCallStep: AgentStep = {
          index: step,
          type: "tool_call",
          toolCall: toolCallInfo,
          timestamp: Date.now(),
        };
        steps.push(toolCallStep);
        safeCall(callbacks.onToolCall, toolCallInfo);
        safeCall(callbacks.onStep, toolCallStep);

        // ---- 执行工具 ----
        let result: ToolExecutionResult;
        try {
          // run_shell 黑名单检查（在确认前拦截，避免危险命令弹出确认框）
          if (toolName === "run_shell" && typeof toolArgs.command === "string") {
            const blocked = checkShellCommand(toolArgs.command);
            if (blocked) {
              result = { success: false, error: blocked };
              // 跳过执行，直接进入结果处理
              const toolResultStep: AgentStep = {
                index: step,
                type: "tool_result",
                toolCall: toolCallInfo,
                toolResult: result,
                timestamp: Date.now(),
              };
              steps.push(toolResultStep);
              safeCall(callbacks.onToolResult, result, toolName);
              safeCall(callbacks.onStep, toolResultStep);
              workingMessages.push({
                role: "tool",
                content: `执行失败：${blocked}`,
                tool_call_id: toolCallId,
              });
              continue;
            }
          }

          // 读取安全策略，按配置决定是否确认
          const securityConfig = loadSecurity();
          result = await executeTool(toolName, toolArgs, {
            conversationId,
            requiresConfirmation: (name) => shouldConfirmTool(name, securityConfig),
          });
        } catch (e: any) {
          result = {
            success: false,
            error: e?.message || "工具执行异常",
          };
        }

        // ---- tool_result 步骤 ----
        const toolResultStep: AgentStep = {
          index: step,
          type: "tool_result",
          toolCall: toolCallInfo,
          toolResult: result,
          timestamp: Date.now(),
        };

        // ---- 视觉工具：提取截图 base64 ----
        let screenshotBase64: string | undefined;
        if (isVisionTool(toolName)) {
          screenshotBase64 = extractScreenshot(result);
          if (screenshotBase64) {
            toolResultStep.screenshot = screenshotBase64;
            safeCall(callbacks.onScreenshot, screenshotBase64);
          }
        }

        steps.push(toolResultStep);
        safeCall(callbacks.onToolResult, result, toolName);
        safeCall(callbacks.onStep, toolResultStep);

        // ---- 把 tool result 追加到 messages ----
        if (screenshotBase64) {
          // 截屏后，需要让模型"看到"屏幕内容
          // 判断当前文本模型是否支持视觉（model === visionModel 时认为支持）
          const textModelSupportsVision =
            config.visionModel && config.model === config.visionModel;

          if (textModelSupportsVision) {
            // 当前模型本身支持视觉：直接发多模态消息
            workingMessages.push({
              role: "tool",
              content: "已截屏，画面已作为图片发送给你",
              tool_call_id: toolCallId,
            });
            workingMessages.push({
              role: "user",
              content: [
                {
                  type: "text",
                  text: "这是刚才截屏的画面，请根据屏幕内容决定下一步操作。",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${screenshotBase64}`,
                  },
                },
              ],
            });
          } else if (config.visionModel) {
            // 配置了独立的视觉模型：用 visionChat 分析截图，把文字描述返回给文本模型
            let screenshotDescription = "";
            try {
              const visionResult = await visionChat({
                config,
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: "请简洁描述这个屏幕截图中的关键内容，重点说明：1) 当前打开了什么窗口/网页 2) 搜索框、输入框、按钮等可交互元素的大致位置（用屏幕坐标描述，如「顶部中央约(600,50)有搜索框」）3) 页面上可见的文字内容。300字以内。",
                      },
                      {
                        type: "image_url",
                        image_url: {
                          url: `data:image/png;base64,${screenshotBase64}`,
                        },
                      },
                    ],
                  },
                ],
                signal,
                conversationId,
              });
              screenshotDescription = visionResult.content;
            } catch {
              screenshotDescription = "（视觉模型分析截图失败，可能视觉模型未启动）";
            }
            workingMessages.push({
              role: "tool",
              content: `已截屏。截图内容描述（由视觉模型分析）：${screenshotDescription}`,
              tool_call_id: toolCallId,
            });
          } else {
            // 未配置视觉模型：降级为纯文本提示
            workingMessages.push({
              role: "tool",
              content: "已截屏，但未配置视觉模型，无法分析截图内容。请在设置中配置视觉模型（如 llava:7b、gpt-4o）以启用视觉能力。",
              tool_call_id: toolCallId,
            });
          }
        } else {
          // 普通工具：直接 JSON.stringify(result)
          workingMessages.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: toolCallId,
          });
        }
      } // end for each tool_call

      // ---- 工具循环中若已中断，则跳出主循环 ----
      if (aborted || signal?.aborted) {
        pushErrorStep(steps, step, "任务已中断", callbacks);
        break;
      }

      // ---- 到达最大步数仍未完成 ----
      if (step === maxSteps) {
        const errMsg = `任务超出最大步数限制（${maxSteps}步）`;
        pushErrorStep(steps, step, errMsg, callbacks);
      }
    } // end for step
  } finally {
    // 无论正常完成、出错还是中断，都触发 onComplete
    safeCall(callbacks.onComplete, steps, totalUsage);
  }

  return { steps, finalText, totalUsage };
}

// ============================================================
// 5. 内部工具：推送错误步骤
// ============================================================

/** 构造并推送一个 error 步骤，同时触发 onError / onStep 回调 */
function pushErrorStep(
  steps: AgentStep[],
  index: number,
  message: string,
  callbacks: AgentCallbacks
): void {
  const errorStep: AgentStep = {
    index,
    type: "error",
    content: message,
    timestamp: Date.now(),
  };
  steps.push(errorStep);
  safeCall(callbacks.onError, message);
  safeCall(callbacks.onStep, errorStep);
}
