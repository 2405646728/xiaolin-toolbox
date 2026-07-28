// 小林 AI · 工具桥接层
// 把 Rust 后端的 40 个 Tauri command 封装为 OpenAI Function Calling 工具定义，
// 并提供统一的 executeTool 调度器：路由 LLM tool_calls → 对应 Tauri command
// 设计要点：
//   1. TOOL_DEFINITIONS 用 OpenAI Function Calling 格式（name/description/parameters）
//   2. DANGEROUS_TOOLS 标记破坏性工具，executeTool 内部调用 confirmAction 二次确认
//   3. Tauri API 全部用动态 import，浏览器环境降级返回错误
//   4. 工具结果标准化为 { success, data?, error? }，方便 ReAct Agent 解析
import { confirmAction } from "@/components/ConfirmDialog";

// ============================================================
// 类型定义
// ============================================================

// OpenAI Function Calling 工具定义
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

// 工具执行标准化结果
export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

// 工具调用上下文（预留扩展：会话 ID / 自定义确认策略）
export interface ToolCallContext {
  conversationId?: string;
  requiresConfirmation?: (toolName: string) => boolean;
}

// ============================================================
// 危险工具集合 + 确认函数
// 这些工具具有破坏性或不可逆，执行前必须弹窗让用户确认
// ============================================================

export const DANGEROUS_TOOLS = new Set([
  "kill_process",
  "write_file",
  "delete_file",
  "move_file",
  "close_window",
  "power_sleep",
  "power_restart",
  "power_shutdown",
  "run_shell",
]);

// 判断工具是否需要二次确认
export function requiresConfirmation(toolName: string): boolean {
  return DANGEROUS_TOOLS.has(toolName);
}

// ============================================================
// 工具中文标签映射（用于确认弹窗与结果展示）
// ============================================================

export const TOOL_LABELS: Record<string, string> = {
  get_system_info: "获取系统状态",
  get_hardware_info: "获取硬件信息",
  open_app: "启动应用",
  list_processes: "列出进程",
  kill_process: "终止进程",
  list_files: "列出文件",
  read_file: "读取文件",
  write_file: "写入文件",
  delete_file: "删除文件",
  move_file: "移动文件",
  search_files: "搜索文件",
  clipboard_get: "读取剪贴板",
  clipboard_set: "写入剪贴板",
  open_url: "打开网址",
  search_web: "搜索网页",
  mouse_move: "移动鼠标",
  mouse_click: "鼠标点击",
  mouse_double_click: "鼠标双击",
  mouse_right_click: "鼠标右键",
  mouse_drag: "鼠标拖拽",
  mouse_scroll: "鼠标滚动",
  keyboard_type: "键盘输入",
  keyboard_press: "键盘按键",
  keyboard_hotkey: "键盘组合键",
  screenshot: "截屏",
  screenshot_region: "区域截屏",
  list_windows: "列出窗口",
  focus_window: "聚焦窗口",
  minimize_window: "最小化窗口",
  maximize_window: "最大化窗口",
  close_window: "关闭窗口",
  set_volume: "设置音量",
  mute_volume: "静音",
  unmute_volume: "取消静音",
  power_sleep: "睡眠",
  power_restart: "重启电脑",
  power_shutdown: "关闭电脑",
  run_shell: "执行 Shell 命令",
  wifi_status: "查询 WiFi 状态",
  wifi_toggle: "切换 WiFi",
  bluetooth_status: "查询蓝牙状态",
  bluetooth_toggle: "切换蓝牙",
};

// ============================================================
// TOOL_DEFINITIONS：OpenAI Function Calling 工具定义
// 参数命名与 Rust 命令签名保持一致（snake_case）
// ============================================================

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // -------- 系统信息（只读，无需确认） --------
  {
    type: "function",
    function: {
      name: "get_system_info",
      description: "获取实时系统状态，包括 CPU 使用率、内存占用、磁盘空间、网络速率、运行时长、Top 8 进程。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_hardware_info",
      description: "获取硬件详细信息，包括主机名、操作系统、CPU 品牌/核心/频率、内存总量、磁盘列表、网络接口。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },

  // -------- 应用与进程 --------
  {
    type: "function",
    function: {
      name: "open_app",
      description: "启动系统应用。仅允许白名单：notepad（记事本）、calc（计算器）、explorer（资源管理器）、msedge（Edge 浏览器）、chrome（Chrome 浏览器）、firefox（Firefox 浏览器）、code（VSCode）、wpsoffice（WPS）、word、excel、powerpoint。",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "应用名（小写白名单）：notepad / calc / explorer / msedge / chrome / firefox / code / wpsoffice / word / excel / powerpoint",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_processes",
      description: "列出当前 CPU 占用最高的前 20 个进程，返回 pid / name / cpu / mem 字段。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "kill_process",
      description: "通过 PID 终止进程。系统关键进程（svchost/explorer/lsass 等）受保护不可终止。属于危险操作，执行前需用户确认。",
      parameters: {
        type: "object",
        properties: {
          pid: {
            type: "integer",
            description: "进程 ID",
          },
        },
        required: ["pid"],
      },
    },
  },

  // -------- 文件操作 --------
  {
    type: "function",
    function: {
      name: "list_files",
      description: "列出指定目录下的文件与子目录，返回 name / size / isDir / modified 字段。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "目录绝对路径，如 D:\\Downloads",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "读取文本文件内容（限制 1MB）。返回文件字符串。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "文件绝对路径",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "写入文本文件（覆盖已存在内容）。若未指定 path 或使用纯文件名，默认保存到「桌面/小林AI产出/」目录。属于危险操作，执行前需用户确认。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "文件路径。可省略扩展名；为纯文件名或留空时自动使用「桌面/小林AI产出/」目录",
          },
          content: {
            type: "string",
            description: "要写入的文本内容",
          },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "删除文件或目录（递归删除）。系统目录（C:\\Windows 等）受保护不可删除。属于危险操作，执行前需用户确认。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "要删除的文件或目录绝对路径",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_file",
      description: "移动或重命名文件/目录。属于危险操作，执行前需用户确认。",
      parameters: {
        type: "object",
        properties: {
          from: {
            type: "string",
            description: "源路径",
          },
          to: {
            type: "string",
            description: "目标路径",
          },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "在指定目录递归搜索文件名包含 pattern 的文件，最多返回 50 个匹配结果。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "搜索起始目录",
          },
          pattern: {
            type: "string",
            description: "文件名匹配关键字（不区分大小写）",
          },
        },
        required: ["path", "pattern"],
      },
    },
  },

  // -------- 剪贴板 --------
  {
    type: "function",
    function: {
      name: "clipboard_get",
      description: "读取系统剪贴板文本内容。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clipboard_set",
      description: "写入文本到系统剪贴板。",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "要写入剪贴板的文本",
          },
        },
        required: ["text"],
      },
    },
  },

  // -------- 浏览器 --------
  {
    type: "function",
    function: {
      name: "open_url",
      description: "用默认浏览器打开指定 URL。",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "要打开的网址，如 https://www.bilibili.com",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description: "用默认浏览器的搜索引擎（Bing）搜索关键词，会新开一个搜索结果页。\n\n注意：此工具只适合「用搜索引擎搜索」。如果用户要求「在某个网站里搜索」（如「在B站搜索XX」「在淘宝搜索YY」），不要用此工具，而应该：open_url 打开该网站 → screenshot 截屏 → mouse_click 点击站内搜索框 → keyboard_type 输入关键词 → keyboard_press Enter。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词",
          },
        },
        required: ["query"],
      },
    },
  },

  // -------- 鼠标键盘 --------
  {
    type: "function",
    function: {
      name: "mouse_move",
      description: "移动鼠标到屏幕指定坐标。",
      parameters: {
        type: "object",
        properties: {
          x: { type: "integer", description: "屏幕横坐标" },
          y: { type: "integer", description: "屏幕纵坐标" },
        },
        required: ["x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mouse_click",
      description: "在指定坐标执行鼠标单击（先移动后点击）。",
      parameters: {
        type: "object",
        properties: {
          x: { type: "integer", description: "屏幕横坐标" },
          y: { type: "integer", description: "屏幕纵坐标" },
          button: {
            type: "string",
            enum: ["left", "right", "middle"],
            description: "鼠标按键（默认 left）",
          },
        },
        required: ["x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mouse_double_click",
      description: "在指定坐标执行鼠标左键双击。",
      parameters: {
        type: "object",
        properties: {
          x: { type: "integer", description: "屏幕横坐标" },
          y: { type: "integer", description: "屏幕纵坐标" },
        },
        required: ["x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mouse_right_click",
      description: "在指定坐标执行鼠标右键单击。",
      parameters: {
        type: "object",
        properties: {
          x: { type: "integer", description: "屏幕横坐标" },
          y: { type: "integer", description: "屏幕纵坐标" },
        },
        required: ["x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mouse_drag",
      description: "从坐标 (from_x, from_y) 拖拽到 (to_x, to_y)。",
      parameters: {
        type: "object",
        properties: {
          from_x: { type: "integer", description: "起点横坐标" },
          from_y: { type: "integer", description: "起点纵坐标" },
          to_x: { type: "integer", description: "终点横坐标" },
          to_y: { type: "integer", description: "终点纵坐标" },
        },
        required: ["from_x", "from_y", "to_x", "to_y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mouse_scroll",
      description: "鼠标滚轮滚动。正数向上滚，负数向下滚。",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "integer",
            description: "滚动量（正数上滚，负数下滚）",
          },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "keyboard_type",
      description: "键盘输入文本字符串。",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "要输入的文本" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "keyboard_press",
      description: "按下单个按键。支持 Enter/Tab/Esc/Space/Backspace/Up/Down/Left/Right/Home/End/PageUp/PageDown/Delete/Insert 以及单字符。",
      parameters: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description: "按键名，如 Enter / Tab / Esc / Space / a / 1",
          },
        },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "keyboard_hotkey",
      description: "键盘组合键。同时按下多个键后反序释放，如 Ctrl+C / Alt+Tab / Win+E。",
      parameters: {
        type: "object",
        properties: {
          keys: {
            type: "array",
            items: { type: "string" },
            description: "组合键列表，修饰键用小写：ctrl / alt / shift / win，普通键按 keyboard_press 规则。如 [\"ctrl\",\"c\"]",
          },
        },
        required: ["keys"],
      },
    },
  },

  // -------- 视觉 --------
  {
    type: "function",
    function: {
      name: "screenshot",
      description: "截取全屏，返回 base64 PNG 图像（不含 data: 前缀）。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "screenshot_region",
      description: "截取屏幕指定矩形区域，返回 base64 PNG 图像。",
      parameters: {
        type: "object",
        properties: {
          x: { type: "integer", description: "区域左上角横坐标" },
          y: { type: "integer", description: "区域左上角纵坐标" },
          width: { type: "integer", description: "区域宽度" },
          height: { type: "integer", description: "区域高度" },
        },
        required: ["x", "y", "width", "height"],
      },
    },
  },

  // -------- 窗口管理 --------
  {
    type: "function",
    function: {
      name: "list_windows",
      description: "列出所有可见窗口，返回 title / pid / hwnd 字段。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "focus_window",
      description: "聚焦（置前）标题包含指定字符串的窗口。如果窗口最小化会先恢复。",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "窗口标题关键字（不区分大小写，包含即匹配）",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "minimize_window",
      description: "最小化标题包含指定字符串的窗口。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "窗口标题关键字" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "maximize_window",
      description: "最大化标题包含指定字符串的窗口并置前。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "窗口标题关键字" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "close_window",
      description: "关闭标题包含指定字符串的窗口。属于危险操作，执行前需用户确认。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "窗口标题关键字" },
        },
        required: ["title"],
      },
    },
  },

  // -------- 系统控制 --------
  {
    type: "function",
    function: {
      name: "set_volume",
      description: "设置系统主音量（0-100）。需要 nircmd.exe 在 PATH。",
      parameters: {
        type: "object",
        properties: {
          level: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "音量等级 0-100",
          },
        },
        required: ["level"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mute_volume",
      description: "系统静音。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unmute_volume",
      description: "取消系统静音。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "power_sleep",
      description: "让电脑进入睡眠状态。属于危险操作，执行前需用户确认。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "power_restart",
      description: "立即重启电脑。属于危险操作，执行前需用户确认。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "power_shutdown",
      description: "立即关闭电脑。属于危险操作，执行前需用户确认。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },

  // -------- Shell --------
  {
    type: "function",
    function: {
      name: "run_shell",
      description: "执行系统 Shell 命令，返回 stdout / stderr / success。安全黑名单：禁止 format/del/rd/rmdir/mkfs/dd。属于危险操作，执行前需用户确认。",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "可执行文件名或路径，如 cmd / powershell / ipconfig",
          },
          args: {
            type: "array",
            items: { type: "string" },
            description: "命令参数数组",
          },
        },
        required: ["command"],
      },
    },
  },

  // -------- 网络与无线控制 --------
  {
    type: "function",
    function: {
      name: "wifi_status",
      description: "查询 WiFi 适配器是否启用。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "wifi_toggle",
      description: "启用或禁用 WiFi 适配器。需要管理员权限。",
      parameters: {
        type: "object",
        properties: {
          enable: { type: "boolean", description: "true=启用 WiFi，false=禁用" },
        },
        required: ["enable"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bluetooth_status",
      description: "查询蓝牙无线电是否启用。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "bluetooth_toggle",
      description: "启用或禁用蓝牙无线电。需要管理员权限。",
      parameters: {
        type: "object",
        properties: {
          enable: { type: "boolean", description: "true=启用蓝牙，false=禁用" },
        },
        required: ["enable"],
      },
    },
  },
];

// ============================================================
// Tauri 环境检测
// 与 aiCommands.ts 保持一致：检查 __TAURI_INTERNALS__ / __TAURI__ 全局变量
// ============================================================

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

// 动态加载 Tauri invoke，避免浏览器环境顶层 import 报错
async function getInvoke(): Promise<
  ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null
> {
  if (!isTauri()) return null;
  try {
    const mod = await import("@tauri-apps/api/core");
    return mod.invoke as typeof mod.invoke;
  } catch {
    return null;
  }
}

// ============================================================
// executeTool 调度器
// 路由：LLM tool_calls → 危险工具确认 → Tauri command → 标准化结果
// ============================================================

export async function executeTool(
  name: string,
  args: Record<string, any>,
  context?: ToolCallContext
): Promise<ToolExecutionResult> {
  // 1. 危险工具二次确认（通过 context.requiresConfirmation 或默认 requiresConfirmation 判断）
  const needConfirm = context?.requiresConfirmation
    ? context.requiresConfirmation(name)
    : requiresConfirmation(name);
  if (needConfirm) {
    const label = TOOL_LABELS[name] || name;
    let allowed = false;
    try {
      allowed = await confirmAction(name, label, args);
    } catch {
      allowed = false;
    }
    if (!allowed) {
      return { success: false, error: "用户拒绝执行" };
    }
  }

  // 2. Tauri 环境检测 + 动态加载 invoke
  const invoke = await getInvoke();
  if (!invoke) {
    return { success: false, error: "此功能需在桌面环境运行" };
  }

  // 3. 调用对应 Tauri command
  // 参数名按 Rust 命令签名传递（snake_case），Tauri 自动处理 camelCase ↔ snake_case
  // 网络与无线控制：wifi_status/bluetooth_status 无参数，移除可能误传的 enable
  if (name === "wifi_status" || name === "bluetooth_status") {
    delete args.enable;
  }

  // write_file：未指定 path 或纯文件名时，默认保存到「桌面/小林AI产出/」
  if (name === "write_file") {
    const rawPath = typeof args.path === "string" ? args.path.trim() : "";
    // 判断是否为纯文件名（无盘符、无斜杠）或为空
    const isBareName = !rawPath || (
      !rawPath.includes(":") && !rawPath.includes("/") && !rawPath.includes("\\")
    );
    if (isBareName) {
      const desktop = await invoke("get_desktop_path", {});
      if (typeof desktop === "string") {
        const dir = `${desktop}\\小林AI产出`;
        // 确保目录存在
        try {
          await invoke("run_shell", { command: `if (!(Test-Path '${dir}')) { New-Item -ItemType Directory -Path '${dir}' -Force | Out-Null }` });
        } catch {
          // 目录创建失败不阻断，write_file 会报错
        }
        const fileName = rawPath || `输出_${Date.now()}.txt`;
        args.path = `${dir}\\${fileName}`;
      }
    }
  }

  try {
    const result = await invoke(name, args as Record<string, unknown>);
    // write_file 成功时返回最终路径，便于 UI 显示文件位置
    if (name === "write_file" && typeof args.path === "string") {
      return { success: true, data: { path: args.path } };
    }
    return { success: true, data: result };
  } catch (e: any) {
    // Tauri 抛出的错误可能是字符串或 { message } 或 Error
    const message =
      typeof e === "string"
        ? e
        : e?.message ?? (e?.toString?.() ?? "未知错误");
    return { success: false, error: message };
  }
}

// ============================================================
// formatToolResult 工具结果格式化为人类可读字符串
// 成功：根据工具名返回有意义的摘要
// 失败：返回 "执行失败：error"
// ============================================================

export function formatToolResult(
  name: string,
  result: ToolExecutionResult
): string {
  if (!result.success) {
    return `执行失败：${result.error ?? "未知错误"}`;
  }

  const data = result.data;

  switch (name) {
    // -------- 系统信息 --------
    case "get_system_info": {
      if (data && typeof data === "object") {
        const d = data as any;
        const cpu = typeof d.cpuUsage === "number" ? d.cpuUsage.toFixed(1) : "?";
        const memUsed = typeof d.memUsed === "number" ? d.memUsed.toFixed(1) : "?";
        const memTotal = typeof d.memTotal === "number" ? d.memTotal.toFixed(1) : "?";
        return `CPU: ${cpu}%, 内存: ${memUsed}/${memTotal} GB`;
      }
      return "已获取系统状态";
    }
    case "get_hardware_info": {
      if (data && typeof data === "object") {
        const d = data as any;
        const host = d.hostname ?? "?";
        const cpuBrand = d.cpuBrand ?? "?";
        return `主机: ${host}, CPU: ${cpuBrand}`;
      }
      return "已获取硬件信息";
    }

    // -------- 应用与进程 --------
    case "open_app":
      return "已启动应用";
    case "list_processes": {
      const n = Array.isArray(data) ? data.length : 0;
      return `列出 ${n} 个进程`;
    }
    case "kill_process":
      return "已终止进程";

    // -------- 文件操作 --------
    case "list_files": {
      const n = Array.isArray(data) ? data.length : 0;
      return `列出 ${n} 个项目`;
    }
    case "read_file": {
      if (typeof data === "string") {
        const truncated = data.length > 100 ? data.slice(0, 100) + "..." : data;
        return `已读取文件（${data.length} 字符）：${truncated}`;
      }
      return "已读取文件";
    }
    case "write_file": {
      if (data && typeof data === "object" && typeof (data as any).path === "string") {
        return `已写入文件：${(data as any).path}`;
      }
      return "已写入文件";
    }
    case "delete_file":
      return "已删除";
    case "move_file":
      return "已移动/重命名文件";
    case "search_files": {
      const n = Array.isArray(data) ? data.length : 0;
      return `找到 ${n} 个匹配文件`;
    }

    // -------- 剪贴板 --------
    case "clipboard_get": {
      if (typeof data === "string") {
        const truncated = data.length > 50 ? data.slice(0, 50) + "..." : data;
        return `剪贴板内容：${truncated}`;
      }
      return "已读取剪贴板";
    }
    case "clipboard_set":
      return "已写入剪贴板";

    // -------- 浏览器 --------
    case "open_url":
      return "已打开网址";
    case "search_web":
      return "已在浏览器搜索";

    // -------- 鼠标键盘 --------
    case "mouse_move":
      return "已移动鼠标";
    case "mouse_click":
      return "已点击";
    case "mouse_double_click":
      return "已双击";
    case "mouse_right_click":
      return "已右键点击";
    case "mouse_drag":
      return "已拖拽";
    case "mouse_scroll":
      return "已滚动";
    case "keyboard_type":
      return "已输入文本";
    case "keyboard_press":
      return "已按键";
    case "keyboard_hotkey":
      return "已执行组合键";

    // -------- 视觉 --------
    case "screenshot":
      return "已截屏";
    case "screenshot_region":
      return "已截取区域";

    // -------- 窗口管理 --------
    case "list_windows": {
      const n = Array.isArray(data) ? data.length : 0;
      return `列出 ${n} 个窗口`;
    }
    case "focus_window":
      return "已聚焦窗口";
    case "minimize_window":
      return "已最小化窗口";
    case "maximize_window":
      return "已最大化窗口";
    case "close_window":
      return "已关闭窗口";

    // -------- 系统控制 --------
    case "set_volume":
      return "音量已设置";
    case "mute_volume":
      return "已静音";
    case "unmute_volume":
      return "已取消静音";
    case "power_sleep":
      return "已进入睡眠";
    case "power_restart":
      return "已执行重启";
    case "power_shutdown":
      return "已执行关机";

    // -------- Shell --------
    case "run_shell": {
      if (data && typeof data === "object") {
        const d = data as any;
        const stdout = typeof d.stdout === "string" ? d.stdout : "";
        const truncated =
          stdout.length > 100 ? stdout.slice(0, 100) + "..." : stdout;
        return `命令执行完成：${truncated || "(无输出)"}`;
      }
      return "命令执行完成";
    }

    default:
      return "已执行";
  }
}
