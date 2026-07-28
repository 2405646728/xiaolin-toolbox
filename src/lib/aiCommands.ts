// AI 命令助手本地智能解析器
// 识别用户输入关键词，匹配对应功能并执行（Tauri 真实执行 / 浏览器降级）
// 不依赖外部 AI API，全部本地解析

export interface AICommand {
  id: string;
  category: string;
  title: string;
  description: string;
  icon: string; // lucide 图标名
  keywords: string[];
  danger?: boolean; // 危险操作标记
}

export interface AIResponse {
  text: string;
  status: "success" | "error" | "info" | "warning";
  data?: unknown;
  executed?: boolean; // 是否真实执行了操作
}

// ---------- 命令分类与清单 ----------

export const commandCategories = [
  { id: "system", name: "系统控制", icon: "Power" },
  { id: "launch", name: "快捷启动", icon: "Rocket" },
  { id: "network", name: "网络工具", icon: "Wifi" },
  { id: "encode", name: "编码转换", icon: "Binary" },
  { id: "text", name: "文本处理", icon: "Type" },
  { id: "time", name: "时间日期", icon: "Clock" },
  { id: "math", name: "数学计算", icon: "Calculator" },
  { id: "convert", name: "单位换算", icon: "Ruler" },
  { id: "color", name: "颜色工具", icon: "Palette" },
  { id: "dev", name: "开发工具", icon: "Code" },
  { id: "file", name: "文件操作", icon: "Folder" },
  { id: "clip", name: "剪贴板", icon: "Clipboard" },
  { id: "info", name: "信息查询", icon: "Info" },
] as const;

export const aiCommands: AICommand[] = [
  // 系统控制
  { id: "shutdown", category: "system", title: "关机", description: "关闭计算机（1分钟延迟）", icon: "Power", keywords: ["关机", "shutdown", "关闭计算机"], danger: true },
  { id: "restart", category: "system", title: "重启", description: "重启计算机（1分钟延迟）", icon: "RotateCw", keywords: ["重启", "restart", "重新启动"], danger: true },
  { id: "sleep", category: "system", title: "休眠", description: "进入休眠状态", icon: "Moon", keywords: ["休眠", "睡眠", "sleep"], danger: true },
  { id: "lock", category: "system", title: "锁屏", description: "锁定屏幕", icon: "Lock", keywords: ["锁屏", "锁定", "lock"] },
  { id: "logout", category: "system", title: "注销", description: "注销当前用户", icon: "LogOut", keywords: ["注销", "logout", "登出"], danger: true },
  { id: "cancel-shutdown", category: "system", title: "取消关机", description: "取消计划的关机/重启", icon: "XCircle", keywords: ["取消关机", "取消重启", "abort", "cancel shutdown"] },
  { id: "empty-recycle", category: "system", title: "清空回收站", description: "清空 Windows 回收站", icon: "Trash2", keywords: ["清空回收站", "回收站", "recycle", "empty recycle"], danger: true },
  { id: "flush-dns", category: "system", title: "刷新 DNS", description: "刷新 DNS 解析缓存", icon: "RefreshCw", keywords: ["刷新dns", "flushdns", "dns缓存"] },

  // 快捷启动（Windows 系统程序）
  { id: "open-calc", category: "launch", title: "计算器", description: "打开系统计算器", icon: "Calculator", keywords: ["计算器", "calc", "calculator"] },
  { id: "open-notepad", category: "launch", title: "记事本", description: "打开记事本", icon: "FileText", keywords: ["记事本", "notepad"] },
  { id: "open-explorer", category: "launch", title: "资源管理器", description: "打开文件资源管理器", icon: "Folder", keywords: ["资源管理器", "文件管理器", "explorer"] },
  { id: "open-taskmgr", category: "launch", title: "任务管理器", description: "打开任务管理器", icon: "Activity", keywords: ["任务管理器", "taskmgr", "task manager"] },
  { id: "open-regedit", category: "launch", title: "注册表", description: "打开注册表编辑器", icon: "Database", keywords: ["注册表", "regedit", "registry"] },
  { id: "open-cmd", category: "launch", title: "CMD", description: "打开命令提示符", icon: "Terminal", keywords: ["cmd", "命令提示符", "command prompt"] },
  { id: "open-powershell", category: "launch", title: "PowerShell", description: "打开 PowerShell", icon: "TerminalSquare", keywords: ["powershell", "ps"] },
  { id: "open-paint", category: "launch", title: "画图", description: "打开画图工具", icon: "Paintbrush", keywords: ["画图", "paint", "mspaint"] },
  { id: "open-control", category: "launch", title: "控制面板", description: "打开控制面板", icon: "Settings", keywords: ["控制面板", "control panel", "control"] },
  { id: "open-devmgmt", category: "launch", title: "设备管理器", description: "打开设备管理器", icon: "Cpu", keywords: ["设备管理器", "devmgmt", "device manager"] },
  { id: "open-snipping", category: "launch", title: "截图工具", description: "打开截图工具", icon: "Scissors", keywords: ["截图", "snipping", "截图工具"] },
  { id: "open-clock", category: "launch", title: "时钟", description: "打开时钟应用", icon: "Clock", keywords: ["时钟", "闹钟", "clock", "alarm"] },
  { id: "open-on_screen_keyboard", category: "launch", title: "屏幕键盘", description: "打开屏幕键盘", icon: "Keyboard", keywords: ["屏幕键盘", "osk", "软键盘"] },
  { id: "open-magnifier", category: "launch", title: "放大镜", description: "打开放大镜", icon: "ZoomIn", keywords: ["放大镜", "magnifier"] },
  { id: "open-charmap", category: "launch", title: "字符映射表", description: "打开特殊字符表", icon: "Type", keywords: ["字符映射表", "charmap", "特殊字符"] },

  // 网络工具
  { id: "ip", category: "network", title: "本机 IP", description: "查看本机 IP 地址", icon: "Globe", keywords: ["ip", "ip地址", "本机ip"] },
  { id: "ping", category: "network", title: "Ping 测试", description: "测试网络连通性", icon: "Activity", keywords: ["ping", "连通性", "网络测试"] },
  { id: "dns-lookup", category: "network", title: "DNS 查询", description: "查询域名解析", icon: "Search", keywords: ["dns", "域名解析", "nslookup"] },
  { id: "url-encode", category: "network", title: "URL 编码", description: "URL 编码/解码", icon: "Link", keywords: ["url编码", "url解码", "encode url", "decode url"] },
  { id: "speedtest", category: "network", title: "网速测试", description: "测试网络速度", icon: "Gauge", keywords: ["测速", "网速", "speedtest", "speed test"] },
  { id: "port-check", category: "network", title: "端口查询", description: "查看端口占用", icon: "Plug", keywords: ["端口", "port", "端口占用", "netstat"] },
  { id: "trace-route", category: "network", title: "路由追踪", description: "追踪网络路由", icon: "Route", keywords: ["tracert", "路由追踪", "trace"] },

  // 编码转换
  { id: "base64", category: "encode", title: "Base64", description: "Base64 编码/解码", icon: "Binary", keywords: ["base64", "b64"] },
  { id: "md5", category: "encode", title: "SHA-256", description: "计算 SHA-256 哈希", icon: "Hash", keywords: ["md5", "sha256", "哈希", "hash"] },
  { id: "uuid", category: "encode", title: "UUID", description: "生成 UUID", icon: "Fingerprint", keywords: ["uuid", "guid", "唯一标识"] },
  { id: "timestamp", category: "encode", title: "时间戳", description: "时间戳转换", icon: "Clock", keywords: ["时间戳", "timestamp", "unix time"] },
  { id: "hex", category: "encode", title: "进制转换", description: "二进制/十进制/十六进制转换", icon: "Hash", keywords: ["进制", "二进制", "十六进制", "hex", "binary", "decimal"] },
  { id: "html-escape", category: "encode", title: "HTML 转义", description: "HTML 实体编码/解码", icon: "Code", keywords: ["html转义", "html编码", "html escape", "html entity"] },
  { id: "unicode", category: "encode", title: "Unicode", description: "Unicode 编码/解码", icon: "Languages", keywords: ["unicode", "编码", "转码"] },
  { id: "jwt-decode", category: "encode", title: "JWT 解析", description: "解析 JWT Token", icon: "KeyRound", keywords: ["jwt", "token", "jwt解析"] },

  // 文本处理
  { id: "word-count", category: "text", title: "字数统计", description: "统计字符/单词/行数", icon: "Type", keywords: ["字数", "统计", "word count", "字符数"] },
  { id: "case", category: "text", title: "大小写转换", description: "英文大小写转换", icon: "CaseSensitive", keywords: ["大小写", "大写", "小写", "uppercase", "lowercase"] },
  { id: "json-format", category: "text", title: "JSON 格式化", description: "JSON 美化/压缩", icon: "Braces", keywords: ["json", "格式化", "美化", "format"] },
  { id: "reverse", category: "text", title: "文本反转", description: "反转字符串", icon: "ArrowLeftRight", keywords: ["反转", "倒序", "reverse"] },
  { id: "dedupe", category: "text", title: "去重", description: "文本行去重", icon: "ListChecks", keywords: ["去重", "重复", "unique", "dedupe"] },
  { id: "sort", category: "text", title: "排序", description: "文本行排序", icon: "ArrowDownUp", keywords: ["排序", "sort"] },
  { id: "replace", category: "text", title: "替换", description: "批量文本替换", icon: "Replace", keywords: ["替换", "replace"] },
  { id: "trim", category: "text", title: "去除空白", description: "去除首尾空白和空行", icon: "Scissors", keywords: ["去空格", "trim", "去除空白", "空行"] },
  { id: "pinyin", category: "text", title: "拼音首字母", description: "提取中文拼音首字母", icon: "Languages", keywords: ["拼音", "首字母", "pinyin"] },
  { id: "regex-test", category: "text", title: "正则测试", description: "正则表达式匹配测试", icon: "Regex", keywords: ["正则", "regex", "regexp"] },

  // 时间日期
  { id: "now", category: "time", title: "当前时间", description: "显示当前日期时间", icon: "Clock", keywords: ["时间", "现在", "几点", "now", "current time"] },
  { id: "date", category: "time", title: "今日日期", description: "显示今天日期", icon: "Calendar", keywords: ["日期", "今天", "几号", "date", "today"] },
  { id: "week", category: "time", title: "星期", description: "今天是星期几", icon: "CalendarDays", keywords: ["星期", "周几", "week"] },
  { id: "countdown", category: "time", title: "倒计时", description: "距指定时间倒计时", icon: "Timer", keywords: ["倒计时", "countdown"] },
  { id: "calendar", category: "time", title: "本月日历", description: "显示当月日历", icon: "Calendar", keywords: ["日历", "calendar", "本月"] },
  { id: "year-progress", category: "time", title: "年度进度", description: "今年已过去多少", icon: "TrendingUp", keywords: ["年度进度", "今年", "进度"] },

  // 数学计算
  { id: "calc", category: "math", title: "四则运算", description: "计算数学表达式", icon: "Calculator", keywords: ["计算", "calc", "calculate", "+", "-", "*", "/"] },
  { id: "sqrt", category: "math", title: "开方", description: "计算平方根", icon: "Square", keywords: ["开方", "sqrt", "平方根"] },
  { id: "power", category: "math", title: "幂运算", description: "计算 x 的 y 次方", icon: "ChevronsUp", keywords: ["幂", "power", "次方", "^"] },
  { id: "trig", category: "math", title: "三角函数", description: "sin/cos/tan 计算", icon: "Triangle", keywords: ["sin", "cos", "tan", "三角函数"] },
  { id: "random", category: "math", title: "随机数", description: "生成指定范围随机数", icon: "Dices", keywords: ["随机数", "random", "rand"] },
  { id: "statistics", category: "math", title: "统计计算", description: "求和/平均/最大/最小", icon: "BarChart3", keywords: ["统计", "平均值", "求和", "average", "sum"] },

  // 单位换算
  { id: "length", category: "convert", title: "长度换算", description: "米/英尺/英寸等", icon: "Ruler", keywords: ["长度", "米", "英尺", "英寸", "length"] },
  { id: "weight", category: "convert", title: "重量换算", description: "千克/磅/盎司等", icon: "Weight", keywords: ["重量", "千克", "磅", "kg", "lb", "weight"] },
  { id: "temperature", category: "convert", title: "温度换算", description: "摄氏/华氏/开尔文", icon: "Thermometer", keywords: ["温度", "摄氏", "华氏", "celsius", "fahrenheit"] },
  { id: "area", category: "convert", title: "面积换算", description: "平方米/平方英尺/亩", icon: "Square", keywords: ["面积", "平方米", "平方英尺", "area"] },
  { id: "speed", category: "convert", title: "速度换算", description: "m/s / km/h / mph", icon: "Gauge", keywords: ["速度", "km/h", "mph", "speed"] },
  { id: "data-size", category: "convert", title: "数据存储", description: "字节/KB/MB/GB 换算", icon: "Database", keywords: ["数据大小", "字节", "byte", "kb", "mb", "gb"] },

  // 颜色工具
  { id: "random-color", category: "color", title: "随机颜色", description: "生成随机 HEX 颜色", icon: "Palette", keywords: ["随机颜色", "random color", "颜色"] },
  { id: "rgb-hex", category: "color", title: "RGB/HEX", description: "RGB 与 HEX 互转", icon: "Pipette", keywords: ["rgb", "hex", "颜色转换"] },
  { id: "color-info", category: "color", title: "颜色信息", description: "查看颜色 HSL/HSV/CMYK", icon: "Eye", keywords: ["颜色信息", "hsl", "hsv", "cmyk"] },
  { id: "gradient", category: "color", title: "渐变生成", description: "生成随机渐变色", icon: "Blend", keywords: ["渐变", "gradient", "渐变色"] },

  // 开发工具
  { id: "git-status", category: "dev", title: "Git 状态", description: "查看当前仓库状态", icon: "GitBranch", keywords: ["git status", "git状态"] },
  { id: "node-version", category: "dev", title: "Node 版本", description: "查看 Node.js 版本", icon: "Hexagon", keywords: ["node", "node版本", "npm"] },
  { id: "npm-list", category: "dev", title: "NPM 包列表", description: "查看已安装的 npm 包", icon: "Package", keywords: ["npm list", "npm列表", "npm包"] },
  { id: "lorem-ipsum", category: "dev", title: "占位文本", description: "生成 Lorem Ipsum 文本", icon: "AlignLeft", keywords: ["lorem", "占位文本", "ipsum"] },
  { id: "cron-parse", category: "dev", title: "Cron 解析", description: "解析 Cron 表达式", icon: "Clock", keywords: ["cron", "cron表达式", "定时任务"] },
  { id: "http-status", category: "dev", title: "HTTP 状态码", description: "查询 HTTP 状态码含义", icon: "Server", keywords: ["http", "状态码", "status code"] },

  // 文件操作
  { id: "open-path", category: "file", title: "打开路径", description: "在资源管理器中打开路径", icon: "FolderOpen", keywords: ["打开路径", "open path"] },
  { id: "list-dir", category: "file", title: "列出目录", description: "列出指定目录文件", icon: "List", keywords: ["列目录", "list dir", "文件列表"] },
  { id: "create-folder", category: "file", title: "创建文件夹", description: "在指定位置创建文件夹", icon: "FolderPlus", keywords: ["创建文件夹", "mkdir", "新建文件夹"] },
  { id: "file-info", category: "file", title: "文件信息", description: "查看文件大小/修改时间", icon: "FileSearch", keywords: ["文件信息", "file info"] },

  // 剪贴板
  { id: "copy-text", category: "clip", title: "复制文本", description: "复制指定文本到剪贴板", icon: "Copy", keywords: ["复制", "copy", "剪贴板"] },
  { id: "read-clip", category: "clip", title: "读取剪贴板", description: "读取剪贴板内容", icon: "ClipboardPaste", keywords: ["读取剪贴板", "paste", "read clipboard"] },
  { id: "clear-clip", category: "clip", title: "清空剪贴板", description: "清空系统剪贴板", icon: "Eraser", keywords: ["清空剪贴板", "clear clipboard"] },

  // 信息查询
  { id: "sysinfo", category: "info", title: "系统信息", description: "查看操作系统信息", icon: "Monitor", keywords: ["系统信息", "sysinfo", "系统", "操作系统"] },
  { id: "battery", category: "info", title: "电池状态", description: "查看电池电量", icon: "BatteryCharging", keywords: ["电池", "电量", "battery"] },
  { id: "screen", category: "info", title: "屏幕信息", description: "查看屏幕分辨率", icon: "Monitor", keywords: ["屏幕", "分辨率", "screen", "resolution"] },
  { id: "network-info", category: "info", title: "网络状态", description: "查看网络连接状态", icon: "Wifi", keywords: ["网络", "联网", "network"] },
  { id: "help", category: "info", title: "帮助", description: "显示可用命令", icon: "HelpCircle", keywords: ["帮助", "help", "命令", "能做什么", "?", "？"] },
];

// ---------- Tauri 环境检测 ----------

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

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

// 执行 shell 命令（仅 Tauri 环境）
async function runShell(command: string, args: string[] = []): Promise<{ stdout: string; stderr: string; success: boolean } | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    const result = await invoke("run_shell", { command, args }) as {
      stdout: string;
      stderr: string;
      success: boolean;
    };
    return result;
  } catch (e) {
    console.warn("[runShell] 失败", e);
    return null;
  }
}

// ---------- 命令匹配 ----------

export function matchCommand(input: string): AICommand | null {
  const lower = input.toLowerCase().trim();
  // 精确匹配优先
  for (const cmd of aiCommands) {
    for (const kw of cmd.keywords) {
      if (lower === kw.toLowerCase()) return cmd;
    }
  }
  // 包含匹配
  for (const cmd of aiCommands) {
    for (const kw of cmd.keywords) {
      if (lower.includes(kw.toLowerCase())) return cmd;
    }
  }
  return null;
}

// ---------- 命令执行 ----------

export async function executeCommand(
  cmd: AICommand,
  input: string
): Promise<AIResponse> {
  switch (cmd.id) {
    // ===== 系统控制 =====
    case "shutdown":
      return execShell("shutdown", ["/s", "/t", "60"], "已计划 60 秒后关机，输入「取消关机」可撤销");
    case "restart":
      return execShell("shutdown", ["/r", "/t", "60"], "已计划 60 秒后重启，输入「取消关机」可撤销");
    case "sleep":
      return execShell("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"], "已执行休眠");
    case "lock":
      return execShell("rundll32.exe", ["user32.dll,LockWorkStation"], "已锁定屏幕");
    case "logout":
      return execShell("shutdown", ["/l"], "已注销当前用户");
    case "cancel-shutdown":
      return execShell("shutdown", ["/a"], "已取消关机/重启计划");
    case "empty-recycle":
      return execShell("powershell", ["-Command", "Clear-RecycleBin -Force"], "已清空回收站");
    case "flush-dns":
      return execShell("ipconfig", ["/flushdns"], "已刷新 DNS 解析缓存");

    // ===== 快捷启动 =====
    case "open-calc":
      return execShell("calc", [], "正在打开计算器");
    case "open-notepad":
      return execShell("notepad", [], "正在打开记事本");
    case "open-explorer":
      return execShell("explorer.exe", [], "正在打开资源管理器");
    case "open-taskmgr":
      return execShell("taskmgr", [], "正在打开任务管理器");
    case "open-regedit":
      return execShell("regedit", [], "正在打开注册表编辑器");
    case "open-cmd":
      return execShell("cmd", [], "正在打开命令提示符");
    case "open-powershell":
      return execShell("powershell", [], "正在打开 PowerShell");
    case "open-paint":
      return execShell("mspaint", [], "正在打开画图工具");
    case "open-control":
      return execShell("control", [], "正在打开控制面板");
    case "open-devmgmt":
      return execShell("devmgmt.msc", [], "正在打开设备管理器");
    case "open-snipping":
      return execShell("snippingtool", [], "正在打开截图工具");
    case "open-clock":
      return execShell("ms-clock:", [], "正在打开时钟应用");
    case "open-on_screen_keyboard":
      return execShell("osk", [], "正在打开屏幕键盘");
    case "open-magnifier":
      return execShell("magnify", [], "正在打开放大镜");
    case "open-charmap":
      return execShell("charmap", [], "正在打开字符映射表");

    // ===== 网络工具 =====
    case "ip": {
      const res = await runShell("ipconfig", ["/all"]);
      if (!res) {
        return browserFallback("ipconfig 命令", "浏览器环境无法执行系统命令，请在桌面应用中使用此功能");
      }
      const lines = res.stdout.split("\n").filter((l) => l.includes("IPv4") || l.includes("IPv6"));
      return {
        text: lines.length > 0 ? lines.join("\n").trim() : "未找到 IP 地址",
        status: "success",
        executed: true,
      };
    }
    case "ping": {
      const host = extractArg(input, ["ping"]) || "baidu.com";
      const res = await runShell("ping", ["-n", "4", host]);
      if (!res) return browserFallback(`ping ${host}`, "浏览器环境无法执行 ping 命令");
      return { text: res.stdout, status: res.success ? "success" : "warning", executed: true };
    }
    case "dns-lookup": {
      const domain = extractArg(input, ["dns", "nslookup", "域名解析"]) || "baidu.com";
      const res = await runShell("nslookup", [domain]);
      if (!res) return browserFallback(`nslookup ${domain}`, "浏览器环境无法执行 DNS 查询");
      return { text: res.stdout, status: "success", executed: true };
    }
    case "url-encode": {
      const text = extractArg(input, ["url编码", "url解码", "encode url", "decode url"]) || "";
      if (!text) return { text: "请在命令后输入要编码/解码的文本", status: "info" };
      const isDecode = input.includes("解码") || input.toLowerCase().includes("decode");
      try {
        const result = isDecode ? decodeURIComponent(text) : encodeURIComponent(text);
        return { text: `${isDecode ? "解码" : "编码"}结果：\n${result}`, status: "success", executed: true };
      } catch {
        return { text: "URL 解码失败，请检查输入", status: "error" };
      }
    }
    case "speedtest": {
      const conn = (navigator as Navigator & { connection?: { downlink?: number; rtt?: number } }).connection;
      if (conn) {
        return {
          text: `网络速度估算：\n下载速度: ${conn.downlink ?? "未知"} Mbps\n延迟: ${conn.rtt ?? "未知"} ms`,
          status: "success",
          executed: true,
        };
      }
      return { text: "浏览器不支持网络信息 API，请在桌面应用中执行真实测速", status: "info" };
    }
    case "port-check": {
      const port = extractArg(input, ["端口", "port", "端口占用"]);
      if (!port) return { text: "请指定端口号，如：端口 8080", status: "info" };
      const res = await runShell("netstat", ["-ano", "|", "findstr", `:${port}`]);
      if (!res) return browserFallback(`netstat -ano | findstr :${port}`, "浏览器环境无法执行 netstat 命令");
      const lines = res.stdout.split("\n").filter(Boolean);
      if (lines.length === 0) return { text: `端口 ${port} 未被占用`, status: "success", executed: true };
      return {
        text: `端口 ${port} 占用情况：\n${lines.slice(0, 10).join("\n")}${lines.length > 10 ? `\n...（共 ${lines.length} 条）` : ""}`,
        status: "warning",
        executed: true,
      };
    }
    case "trace-route": {
      const host = extractArg(input, ["tracert", "路由追踪", "trace"]) || "baidu.com";
      return execShell("tracert", ["-d", "-h", "15", host], `正在追踪到 ${host} 的路由（可能耗时较久）`);
    }

    // ===== 编码转换 =====
    case "base64": {
      const text = extractArg(input, ["base64", "b64"]) || "";
      if (!text) return { text: "请在命令后输入要编码/解码的文本", status: "info" };
      const isDecode = input.includes("解码") || input.toLowerCase().includes("decode");
      try {
        if (isDecode) {
          const result = atob(text);
          return { text: `Base64 解码结果：\n${result}`, status: "success", executed: true };
        }
        const result = btoa(text);
        return { text: `Base64 编码结果：\n${result}`, status: "success", executed: true };
      } catch {
        return { text: "Base64 解码失败，请检查输入", status: "error" };
      }
    }
    case "md5": {
      const text = extractArg(input, ["md5", "哈希", "hash"]) || "";
      if (!text) return { text: "请在命令后输入要计算 MD5 的文本", status: "info" };
      const hash = await calcMD5(text);
      return { text: `MD5(${text}) =\n${hash}`, status: "success", executed: true };
    }
    case "uuid": {
      const uuid = crypto.randomUUID();
      return { text: `生成的 UUID：\n${uuid}`, status: "success", executed: true };
    }
    case "timestamp": {
      const arg = extractArg(input, ["时间戳", "timestamp", "unix time"]);
      const now = Math.floor(Date.now() / 1000);
      if (arg && /^\d+$/.test(arg)) {
        // 数字 -> 转日期
        const ts = parseInt(arg, 10);
        const date = new Date(ts * (arg.length > 10 ? 1 : 1000));
        return {
          text: `时间戳 ${arg} 转换为：\n${date.toLocaleString("zh-CN")}`,
          status: "success",
          executed: true,
        };
      }
      return {
        text: `当前时间戳（秒）：${now}\n当前时间戳（毫秒）：${Date.now()}\n当前时间：${new Date().toLocaleString("zh-CN")}`,
        status: "success",
        executed: true,
      };
    }
    case "hex": {
      const arg = extractArg(input, ["进制", "二进制", "十六进制", "hex", "binary", "decimal"]);
      if (!arg) return { text: "请输入要转换的数字，如：255 转 16 进制", status: "info" };
      const num = parseInt(arg, 10);
      if (isNaN(num)) return { text: "无法识别的数字", status: "error" };
      return {
        text: `数字 ${num} 的各进制表示：\n二进制: ${num.toString(2)}\n八进制: ${num.toString(8)}\n十进制: ${num.toString(10)}\n十六进制: ${num.toString(16).toUpperCase()}`,
        status: "success",
        executed: true,
      };
    }
    case "html-escape": {
      const text = extractArg(input, ["html转义", "html编码", "html escape", "html entity"]) || "";
      if (!text) return { text: "请在命令后输入要转义的文本", status: "info" };
      const isUnescape = input.includes("反转义") || input.toLowerCase().includes("unescape");
      if (isUnescape) {
        const tmp = document.createElement("textarea");
        tmp.innerHTML = text;
        return { text: `HTML 反转义结果：\n${tmp.value}`, status: "success", executed: true };
      }
      const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
      return { text: `HTML 转义结果：\n${escaped}`, status: "success", executed: true };
    }
    case "unicode": {
      const text = extractArg(input, ["unicode", "编码", "转码"]) || "";
      if (!text) return { text: "请在命令后输入要编码的文本", status: "info" };
      const isDecode = /\\u[0-9a-f]{4}/i.test(text);
      if (isDecode) {
        const decoded = text.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
        return { text: `Unicode 解码结果：\n${decoded}`, status: "success", executed: true };
      }
      const encoded = Array.from(text)
        .map((c) => (c.charCodeAt(0) > 127 ? `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}` : c))
        .join("");
      return { text: `Unicode 编码结果：\n${encoded}`, status: "success", executed: true };
    }
    case "jwt-decode": {
      const token = extractArg(input, ["jwt", "token", "jwt解析"]) || "";
      if (!token) return { text: "请在命令后输入 JWT Token", status: "info" };
      const parts = token.split(".");
      if (parts.length !== 3) return { text: "JWT 格式错误，应为 header.payload.signature", status: "error" };
      try {
        const decode = (s: string) => {
          const padded = s.replace(/-/g, "+").replace(/_/g, "/");
          const json = atob(padded);
          return JSON.stringify(JSON.parse(json), null, 2);
        };
        return {
          text: `JWT 解析：\n\nHeader:\n${decode(parts[0])}\n\nPayload:\n${decode(parts[1])}\n\nSignature:\n${parts[2]}`,
          status: "success",
          executed: true,
        };
      } catch {
        return { text: "JWT 解析失败，请检查 Token 格式", status: "error" };
      }
    }

    // ===== 文本处理 =====
    case "word-count": {
      const text = extractArg(input, ["字数", "统计", "word count", "字符数"]) || "";
      if (!text) return { text: "请在命令后输入要统计的文本", status: "info" };
      const chars = text.length;
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const lines = text.split("\n").length;
      return {
        text: `文本统计：\n字符数: ${chars}\n单词数: ${words}\n行数: ${lines}`,
        status: "success",
        executed: true,
      };
    }
    case "case": {
      const text = extractArg(input, ["大小写", "大写", "小写", "uppercase", "lowercase"]) || "";
      if (!text) return { text: "请在命令后输入要转换的文本", status: "info" };
      const upper = input.includes("大写") || input.toLowerCase().includes("upper");
      const lower = input.includes("小写") || input.toLowerCase().includes("lower");
      if (upper) return { text: `大写：\n${text.toUpperCase()}`, status: "success", executed: true };
      if (lower) return { text: `小写：\n${text.toLowerCase()}`, status: "success", executed: true };
      return { text: `大写: ${text.toUpperCase()}\n小写: ${text.toLowerCase()}`, status: "success", executed: true };
    }
    case "json-format": {
      const text = extractArg(input, ["json", "格式化", "美化", "format"]) || "";
      if (!text) return { text: "请在命令后输入要格式化的 JSON", status: "info" };
      try {
        const obj = JSON.parse(text);
        const isCompress = input.includes("压缩") || input.toLowerCase().includes("compress");
        const result = JSON.stringify(obj, null, isCompress ? 0 : 2);
        return { text: `JSON ${isCompress ? "压缩" : "格式化"}结果：\n${result}`, status: "success", executed: true };
      } catch {
        return { text: "JSON 解析失败，请检查格式", status: "error" };
      }
    }
    case "reverse": {
      const text = extractArg(input, ["反转", "倒序", "reverse"]) || "";
      if (!text) return { text: "请在命令后输入要反转的文本", status: "info" };
      return { text: `反转结果：\n${text.split("").reverse().join("")}`, status: "success", executed: true };
    }
    case "dedupe": {
      const text = extractArg(input, ["去重", "重复", "unique", "dedupe"]) || "";
      if (!text) return { text: "请在命令后输入要去重的文本（每行一项）", status: "info" };
      const lines = text.split("\n");
      const unique = Array.from(new Set(lines));
      return {
        text: `去重结果（${lines.length} → ${unique.length} 行）：\n${unique.join("\n")}`,
        status: "success",
        executed: true,
      };
    }
    case "sort": {
      const text = extractArg(input, ["排序", "sort"]) || "";
      if (!text) return { text: "请在命令后输入要排序的文本（每行一项）", status: "info" };
      const lines = text.split("\n").filter(Boolean);
      const desc = input.includes("降序") || input.toLowerCase().includes("desc");
      lines.sort((a, b) => desc ? b.localeCompare(a) : a.localeCompare(b));
      return { text: `排序结果：\n${lines.join("\n")}`, status: "success", executed: true };
    }
    case "replace": {
      // 格式：替换 原文本|旧词|新词
      const arg = extractArg(input, ["替换", "replace"]) || "";
      const parts = arg.split("|");
      if (parts.length < 3) return { text: "格式：替换 原文本|旧词|新词\n例：替换 hello world|world|小林", status: "info" };
      const [text, oldStr, newStr] = parts;
      const result = text.split(oldStr).join(newStr);
      return { text: `替换结果：\n${result}`, status: "success", executed: true };
    }
    case "trim": {
      const text = extractArg(input, ["去空格", "trim", "去除空白", "空行"]) || "";
      if (!text) return { text: "请在命令后输入要清理的文本", status: "info" };
      const result = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join("\n");
      return { text: `清理结果：\n${result}`, status: "success", executed: true };
    }
    case "pinyin": {
      const text = extractArg(input, ["拼音", "首字母", "pinyin"]) || "";
      if (!text) return { text: "请在命令后输入要提取拼音首字母的中文", status: "info" };
      // 简易拼音首字母映射（常用字）
      const map: Record<string, string> = {
        "啊": "a", "阿": "a", "艾": "a", "安": "a", "奥": "a",
        "巴": "b", "白": "b", "百": "b", "帮": "b", "包": "b", "北": "b", "本": "b", "比": "b", "必": "b", "边": "b", "变": "b", "表": "b", "宾": "b", "冰": "b", "波": "b", "伯": "b", "博": "b", "步": "b",
        "才": "c", "财": "c", "采": "c", "菜": "c", "参": "c", "仓": "c", "操": "c", "曹": "c", "草": "c", "层": "c", "查": "c", "差": "c", "产": "c", "长": "c", "常": "c", "场": "c", "超": "c", "朝": "c", "陈": "c", "成": "c", "程": "c", "持": "c", "池": "c", "迟": "c", "出": "c", "初": "c", "除": "c", "楚": "c", "处": "c", "川": "c", "传": "c", "创": "c", "春": "c", "次": "c", "从": "c", "崔": "c",
        "达": "d", "大": "d", "代": "d", "戴": "d", "丹": "d", "单": "d", "当": "d", "党": "d", "导": "d", "到": "d", "道": "d", "德": "d", "的": "d", "邓": "d", "迪": "d", "地": "d", "第": "d", "丁": "d", "东": "d", "冬": "d", "董": "d", "都": "d", "杜": "d", "段": "d", "短": "d", "对": "d", "多": "d",
        "俄": "e", "额": "e", "恩": "e", "二": "e", "尔": "e",
        "发": "f", "凡": "f", "方": "f", "房": "f", "放": "f", "飞": "f", "费": "f", "丰": "f", "风": "f", "封": "f", "冯": "f", "凤": "f", "夫": "f", "服": "f", "福": "f", "府": "f", "父": "f", "复": "f", "傅": "f",
        "盖": "g", "干": "g", "高": "g", "戈": "g", "格": "g", "个": "g", "各": "g", "给": "g", "根": "g", "更": "g", "工": "g", "公": "g", "共": "g", "关": "g", "观": "g", "光": "g", "广": "g", "归": "g", "贵": "g", "郭": "g", "国": "g", "过": "g",
        "哈": "h", "海": "h", "寒": "h", "韩": "h", "汉": "h", "好": "h", "何": "h", "和": "h", "河": "h", "贺": "h", "黑": "h", "很": "h", "恒": "h", "红": "h", "侯": "h", "后": "h", "胡": "h", "湖": "h", "虎": "h", "户": "h", "华": "h", "化": "h", "怀": "h", "坏": "h", "还": "h", "环": "h", "换": "h", "黄": "h", "回": "h", "会": "h", "婚": "h", "活": "h", "火": "h", "获": "h", "霍": "h",
        "几": "j", "机": "j", "击": "j", "鸡": "j", "积": "j", "基": "j", "绩": "j", "极": "j", "集": "j", "急": "j", "计": "j", "记": "j", "际": "j", "季": "j", "既": "j", "家": "j", "加": "j", "佳": "j", "甲": "j", "假": "j", "价": "j", "坚": "j", "间": "j", "建": "j", "江": "j", "将": "j", "姜": "j", "讲": "j", "奖": "j", "交": "j", "教": "j", "接": "j", "阶": "j", "节": "j", "杰": "j", "洁": "j", "结": "j", "解": "j", "介": "j", "届": "j", "今": "j", "金": "j", "紧": "j", "近": "j", "进": "j", "晋": "j", "京": "j", "经": "j", "精": "j", "景": "j", "警": "j", "净": "j", "静": "j", "敬": "j", "境": "j", "旧": "j", "救": "j", "就": "j", "居": "j", "局": "j", "举": "j", "句": "j", "具": "j", "聚": "j", "绝": "j", "军": "j", "君": "j",
        "卡": "k", "开": "k", "凯": "k", "刊": "k", "看": "k", "康": "k", "考": "k", "科": "k", "可": "k", "克": "k", "客": "k", "课": "k", "肯": "k", "空": "k", "孔": "k", "口": "k", "库": "k", "快": "k", "宽": "k", "况": "k", "矿": "k", "亏": "k", "昆": "k",
        "拉": "l", "来": "l", "兰": "l", "蓝": "l", "览": "l", "劳": "l", "老": "l", "乐": "l", "雷": "l", "类": "l", "冷": "l", "厘": "l", "李": "l", "里": "l", "理": "l", "立": "l", "利": "l", "连": "l", "联": "l", "廉": "l", "凉": "l", "梁": "l", "两": "l", "亮": "l", "林": "l", "临": "l", "伶": "l", "岭": "l", "令": "l", "刘": "l", "流": "l", "留": "l", "柳": "l", "龙": "l", "隆": "l", "楼": "l", "陆": "l", "录": "l", "鲁": "l", "路": "l", "旅": "l", "律": "l", "绿": "l", "伦": "l", "轮": "l", "罗": "l", "骆": "l", "落": "l",
        "马": "m", "买": "m", "卖": "m", "满": "m", "毛": "m", "茂": "m", "美": "m", "门": "m", "孟": "m", "梦": "m", "米": "m", "密": "m", "免": "m", "面": "m", "苗": "m", "民": "m", "明": "m", "名": "m", "命": "m", "谋": "m", "某": "m", "母": "m", "木": "m", "目": "m", "慕": "m",
        "拿": "n", "那": "n", "乃": "n", "奶": "n", "南": "n", "难": "n", "内": "n", "能": "n", "尼": "n", "年": "n", "念": "n", "娘": "n", "鸟": "n", "宁": "n", "牛": "n", "农": "n", "努": "n", "女": "n",
        "哦": "o", "欧": "o", "偶": "o",
        "怕": "p", "拍": "p", "排": "p", "盘": "p", "庞": "p", "旁": "p", "胖": "p", "泡": "p", "培": "p", "配": "p", "朋": "p", "鹏": "p", "批": "p", "皮": "p", "疲": "p", "匹": "p", "品": "p", "平": "p", "评": "p", "屏": "p", "破": "p", "普": "p",
        "七": "q", "期": "q", "奇": "q", "齐": "q", "骑": "q", "启": "q", "起": "q", "气": "q", "契": "q", "千": "q", "迁": "q", "签": "q", "钱": "q", "前": "q", "潜": "q", "强": "q", "抢": "q", "乔": "q", "侨": "q", "桥": "q", "切": "q", "亲": "q", "青": "q", "轻": "q", "清": "q", "情": "q", "晴": "q", "请": "q", "秋": "q", "求": "q", "区": "q", "曲": "q", "取": "q", "去": "q", "趣": "q", "全": "q", "权": "q", "确": "q",
        "然": "r", "燃": "r", "让": "r", "绕": "r", "热": "r", "人": "r", "任": "r", "认": "r", "日": "r", "容": "r", "熔": "r", "如": "r", "入": "r",
        "撒": "s", "赛": "s", "三": "s", "散": "s", "桑": "s", "色": "s", "森": "s", "僧": "s", "杀": "s", "沙": "s", "傻": "s", "山": "s", "闪": "s", "陕": "s", "善": "s", "商": "s", "上": "s", "烧": "s", "少": "s", "绍": "s", "邵": "s", "蛇": "s", "设": "s", "社": "s", "申": "s", "深": "s", "神": "s", "生": "s", "声": "s", "胜": "s", "盛": "s", "剩": "s", "师": "s", "诗": "s", "时": "s", "实": "s", "拾": "s", "史": "s", "使": "s", "始": "s", "世": "s", "市": "s", "试": "s", "事": "s", "侍": "s", "势": "s", "视": "s", "收": "s", "手": "s", "寿": "s", "受": "s", "售": "s", "书": "s", "叔": "s", "殊": "s", "熟": "s", "暑": "s", "署": "s", "蜀": "s", "鼠": "s", "属": "s", "术": "s", "树": "s", "数": "s", "帅": "s", "双": "s", "谁": "s", "水": "s", "说": "s", "丝": "s", "司": "s", "私": "s", "思": "s", "斯": "s", "死": "s", "四": "s", "寺": "s", "嗣": "s", "似": "s", "松": "s", "宋": "s", "苏": "s", "俗": "s", "素": "s", "速": "s", "宿": "s", "孙": "s", "算": "s", "虽": "s", "随": "s", "岁": "s", "锁": "s",
        "他": "t", "她": "t", "它": "t", "塔": "t", "太": "t", "谈": "t", "谭": "t", "汤": "t", "唐": "t", "堂": "t", "涛": "t", "淘": "t", "讨": "t", "特": "t", "腾": "t", "提": "t", "题": "t", "体": "t", "天": "t", "田": "t", "甜": "t", "条": "t", "跳": "t", "铁": "t", "厅": "t", "听": "t", "通": "t", "同": "t", "童": "t", "统": "t", "头": "t", "投": "t", "图": "t", "团": "t", "推": "t", "退": "t", "吞": "t", "托": "t", "脱": "t", "驼": "t",
        "挖": "w", "瓦": "w", "完": "w", "玩": "w", "晚": "w", "万": "w", "王": "w", "往": "w", "望": "w", "危": "w", "威": "w", "为": "w", "围": "w", "唯": "w", "维": "w", "伟": "w", "伪": "w", "尾": "w", "卫": "w", "未": "w", "文": "w", "闻": "w", "问": "w", "翁": "w", "我": "w", "沃": "w", "卧": "w", "乌": "w", "无": "w", "吴": "w", "武": "w", "五": "w", "午": "w", "舞": "w", "物": "w", "务": "w", "悟": "w", "误": "w",
        "夕": "x", "西": "x", "吸": "x", "希": "x", "析": "x", "息": "x", "悉": "x", "惜": "x", "习": "x", "喜": "x", "系": "x", "戏": "x", "细": "x", "虾": "x", "下": "x", "夏": "x", "先": "x", "纤": "x", "咸": "x", "贤": "x", "现": "x", "线": "x", "献": "x", "县": "x", "相": "x", "香": "x", "乡": "x", "享": "x", "想": "x", "向": "x", "项": "x", "象": "x", "像": "x", "消": "x", "小": "x", "晓": "x", "孝": "x", "肖": "x", "校": "x", "笑": "x", "些": "x", "协": "x", "写": "x", "心": "x", "辛": "x", "新": "x", "信": "x", "兴": "x", "星": "x", "行": "x", "幸": "x", "性": "x", "姓": "x", "休": "x", "修": "x", "秀": "x", "虚": "x", "需": "x", "许": "x", "序": "x", "续": "x", "轩": "x", "宣": "x", "选": "x", "学": "x", "雪": "x", "血": "x", "寻": "x", "询": "x",
        "压": "y", "呀": "y", "押": "y", "鸦": "y", "鸭": "y", "牙": "y", "亚": "y", "烟": "y", "言": "y", "严": "y", "研": "y", "炎": "y", "沿": "y", "眼": "y", "演": "y", "燕": "y", "央": "y", "扬": "y", "羊": "y", "阳": "y", "杨": "y", "洋": "y", "仰": "y", "养": "y", "样": "y", "妖": "y", "腰": "y", "摇": "y", "遥": "y", "要": "y", "也": "y", "业": "y", "叶": "y", "夜": "y", "一": "y", "伊": "y", "衣": "y", "医": "y", "依": "y", "仪": "y", "宜": "y", "姨": "y", "移": "y", "已": "y", "以": "y", "艺": "y", "议": "y", "亦": "y", "异": "y", "易": "y", "意": "y", "因": "y", "阴": "y", "音": "y", "银": "y", "引": "y", "印": "y", "应": "y", "英": "y", "樱": "y", "营": "y", "赢": "y", "影": "y", "映": "y", "硬": "y", "哟": "y", "永": "y", "勇": "y", "用": "y", "优": "y", "悠": "y", "尤": "y", "由": "y", "邮": "y", "油": "y", "游": "y", "友": "y", "有": "y", "又": "y", "右": "y", "于": "y", "予": "y", "余": "y", "俞": "y", "娱": "y", "渔": "y", "愚": "y", "榆": "y", "与": "y", "宇": "y", "语": "y", "玉": "y", "育": "y", "欲": "y", "预": "y", "元": "y", "原": "y", "源": "y", "圆": "y", "缘": "y", "远": "y", "院": "y", "愿": "y", "月": "y", "云": "y", "允": "y", "运": "y",
        "杂": "z", "咱": "z", "赞": "z", "脏": "z", "早": "z", "造": "z", "则": "z", "泽": "z", "窄": "z", "展": "z", "张": "z", "章": "z", "仗": "z", "招": "z", "找": "z", "赵": "z", "照": "z", "罩": "z", "折": "z", "哲": "z", "者": "z", "这": "z", "浙": "z", "贞": "z", "针": "z", "侦": "z", "珍": "z", "真": "z", "诊": "z", "阵": "z", "争": "z", "征": "z", "挣": "z", "睁": "z", "蒸": "z", "整": "z", "正": "z", "证": "z", "郑": "z", "支": "z", "知": "z", "织": "z", "职": "z", "执": "z", "止": "z", "只": "z", "旨": "z", "纸": "z", "指": "z", "制": "z", "智": "z", "中": "z", "忠": "z", "终": "z", "钟": "z", "众": "z", "重": "z", "周": "z", "洲": "z", "州": "z", "朱": "z", "珠": "z", "猪": "z", "竹": "z", "主": "z", "住": "z", "助": "z", "祝": "z", "注": "z", "驻": "z", "著": "z", "专": "z", "砖": "z", "装": "z", "庄": "z", "壮": "z", "状": "z", "追": "z", "准": "z", "桌": "z", "资": "z", "子": "z", "字": "z", "自": "z", "宗": "z", "总": "z", "走": "z", "奏": "z", "租": "z", "足": "z", "族": "z", "组": "z", "祖": "z", "钻": "z", "嘴": "z", "最": "z", "罪": "z", "尊": "z", "作": "z", "昨": "z", "左": "z", "做": "z",
      };
      const result = Array.from(text)
        .map((c) => map[c] ?? (/[a-zA-Z0-9]/.test(c) ? c : ""))
        .join("")
        .toUpperCase();
      return { text: `${text} 的拼音首字母：\n${result}`, status: "success", executed: true };
    }
    case "regex-test": {
      // 格式：正则 模式|文本
      const arg = extractArg(input, ["正则", "regex", "regexp"]) || "";
      const parts = arg.split("|");
      if (parts.length < 2) return { text: "格式：正则 模式|文本\n例：正则 \\d+|abc123def", status: "info" };
      try {
        const [pattern, text] = parts;
        const re = new RegExp(pattern);
        const matches = text.match(re);
        if (matches) {
          return {
            text: `匹配成功：\n匹配项: ${matches.join(", ")}\n位置: ${text.indexOf(matches[0])}`,
            status: "success",
            executed: true,
          };
        }
        return { text: "未匹配到内容", status: "warning", executed: true };
      } catch (e) {
        return { text: `正则错误：${(e as Error).message}`, status: "error" };
      }
    }

    // ===== 时间日期 =====
    case "now": {
      const now = new Date();
      return {
        text: `当前时间：\n${now.toLocaleString("zh-CN", { hour12: false })}\n时区: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
        status: "success",
        executed: true,
      };
    }
    case "date": {
      const now = new Date();
      return {
        text: `今日日期：\n${now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}`,
        status: "success",
        executed: true,
      };
    }
    case "week": {
      const now = new Date();
      const week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][now.getDay()];
      return { text: `今天是：${week}`, status: "success", executed: true };
    }
    case "countdown": {
      const arg = extractArg(input, ["倒计时", "countdown"]);
      if (!arg) return { text: "请指定倒计时目标，如：倒计时 2026-12-31", status: "info" };
      const target = new Date(arg).getTime();
      if (isNaN(target)) return { text: "无法识别的日期，请使用 YYYY-MM-DD 格式", status: "error" };
      const diff = target - Date.now();
      if (diff <= 0) return { text: "目标时间已过", status: "warning" };
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      return {
        text: `距 ${arg} 还有：\n${days} 天 ${hours} 小时 ${mins} 分钟`,
        status: "success",
        executed: true,
      };
    }
    case "calendar": {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const today = now.getDate();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
      let cal = `${year}年${month + 1}月\n${weekDays.join(" ")}\n`;
      let line = " ".repeat(firstDay * 2);
      for (let d = 1; d <= daysInMonth; d++) {
        const mark = d === today ? "[" + d + "]" : String(d).padStart(2, " ");
        line += mark + " ";
        if ((d + firstDay) % 7 === 0 || d === daysInMonth) {
          cal += line.trimEnd() + "\n";
          line = "";
        }
      }
      return { text: cal, status: "success", executed: true };
    }
    case "year-progress": {
      const now = new Date();
      const year = now.getFullYear();
      const start = new Date(year, 0, 1).getTime();
      const end = new Date(year + 1, 0, 1).getTime();
      const total = end - start;
      const passed = Date.now() - start;
      const percent = ((passed / total) * 100).toFixed(2);
      const dayOfYear = Math.floor((Date.now() - start) / 86400000) + 1;
      const totalDays = (end - start) / 86400000;
      return {
        text: `${year} 年进度：\n已过: ${dayOfYear} / ${totalDays} 天\n进度: ${percent}%\n剩余: ${(totalDays - dayOfYear).toFixed(0)} 天`,
        status: "success",
        executed: true,
      };
    }

    // ===== 数学计算 =====
    case "calc": {
      const expr = extractArg(input, ["计算", "calc", "calculate"]) || "";
      if (!expr) return { text: "请输入要计算的表达式，如：计算 1+2*3", status: "info" };
      // 安全校验：仅允许数字和运算符
      if (!/^[\d+\-*/().\s]+$/.test(expr)) {
        return { text: "表达式包含非法字符，仅支持数字和 + - * / ( )", status: "error" };
      }
      try {
        // 表达式已通过正则校验（仅数字和运算符），Function 构造器用于安全求值
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const result = Function(`"use strict"; return (${expr})`)();
        return { text: `${expr} = ${result}`, status: "success", executed: true };
      } catch {
        return { text: "表达式错误，请检查格式", status: "error" };
      }
    }
    case "sqrt": {
      const arg = extractArg(input, ["开方", "sqrt", "平方根"]);
      if (!arg) return { text: "请输入要开方的数字，如：开方 144", status: "info" };
      const num = parseFloat(arg);
      if (isNaN(num)) return { text: "无法识别的数字", status: "error" };
      if (num < 0) return { text: "不支持负数开方", status: "error" };
      return { text: `√${num} = ${Math.sqrt(num)}`, status: "success", executed: true };
    }
    case "power": {
      // 格式：幂 底数 指数
      const arg = extractArg(input, ["幂", "power", "次方", "^"]) || "";
      const parts = arg.split(/\s+/);
      if (parts.length < 2) return { text: "格式：幂 底数 指数\n例：幂 2 10", status: "info" };
      const base = parseFloat(parts[0]);
      const exp = parseFloat(parts[1]);
      if (isNaN(base) || isNaN(exp)) return { text: "无法识别的数字", status: "error" };
      return { text: `${base}^${exp} = ${Math.pow(base, exp)}`, status: "success", executed: true };
    }
    case "trig": {
      // 格式：sin 30 或 cos 60
      const m = input.toLowerCase().match(/(sin|cos|tan)\s+(-?[\d.]+)/);
      if (!m) return { text: "格式：sin/cos/tan 角度\n例：sin 30", status: "info" };
      const fn = m[1] as "sin" | "cos" | "tan";
      const deg = parseFloat(m[2]);
      const rad = (deg * Math.PI) / 180;
      const result = Math[fn](rad);
      return { text: `${fn}(${deg}°) = ${result.toFixed(6)}`, status: "success", executed: true };
    }
    case "random": {
      // 格式：随机数 最小值 最大值 或：随机数 100
      const arg = extractArg(input, ["随机数", "random", "rand"]) || "";
      const parts = arg.split(/\s+/).filter(Boolean);
      let min = 0, max = 100;
      if (parts.length === 1) {
        max = parseInt(parts[0], 10) || 100;
      } else if (parts.length >= 2) {
        min = parseInt(parts[0], 10) || 0;
        max = parseInt(parts[1], 10) || 100;
      }
      if (min > max) [min, max] = [max, min];
      const result = Math.floor(Math.random() * (max - min + 1)) + min;
      return { text: `随机数 [${min}, ${max}]：\n${result}`, status: "success", executed: true };
    }
    case "statistics": {
      const arg = extractArg(input, ["统计", "平均值", "求和", "average", "sum"]) || "";
      if (!arg) return { text: "请输入要统计的数字，用空格分隔\n例：统计 1 2 3 4 5", status: "info" };
      const nums = arg.split(/\s+/).map(Number).filter((n) => !isNaN(n));
      if (nums.length === 0) return { text: "未识别到有效数字", status: "error" };
      const sum = nums.reduce((a, b) => a + b, 0);
      const avg = sum / nums.length;
      const max = Math.max(...nums);
      const min = Math.min(...nums);
      return {
        text: `统计结果（${nums.length} 个数）：\n求和: ${sum}\n平均: ${avg.toFixed(4)}\n最大: ${max}\n最小: ${min}\n数据: [${nums.join(", ")}]`,
        status: "success",
        executed: true,
      };
    }

    // ===== 单位换算 =====
    case "length": {
      // 格式：长度 1 米 英尺
      const arg = extractArg(input, ["长度", "米", "英尺", "英寸", "length"]) || "";
      const parts = arg.split(/\s+/);
      if (parts.length < 3) return { text: "格式：长度 数值 源单位 目标单位\n例：长度 1 米 英尺\n支持：米/英尺/英寸/厘米/千米/英里", status: "info" };
      const value = parseFloat(parts[0]);
      const from = parts[1];
      const to = parts[2];
      const toMeter: Record<string, number> = {
        "米": 1, "m": 1, "千米": 1000, "km": 1000,
        "厘米": 0.01, "cm": 0.01, "毫米": 0.001, "mm": 0.001,
        "英尺": 0.3048, "ft": 0.3048, "英寸": 0.0254, "in": 0.0254,
        "英里": 1609.344, "mi": 1609.344, "码": 0.9144, "yd": 0.9144,
      };
      const fromM = toMeter[from];
      const toM = toMeter[to];
      if (!fromM || !toM) return { text: `不支持的单位\n支持：${Object.keys(toMeter).join(" / ")}`, status: "error" };
      const result = (value * fromM) / toM;
      return { text: `${value} ${from} = ${result.toFixed(6)} ${to}`, status: "success", executed: true };
    }
    case "weight": {
      const arg = extractArg(input, ["重量", "千克", "磅", "kg", "lb", "weight"]) || "";
      const parts = arg.split(/\s+/);
      if (parts.length < 3) return { text: "格式：重量 数值 源单位 目标单位\n例：重量 1 千克 磅\n支持：千克/克/磅/盎司/吨", status: "info" };
      const value = parseFloat(parts[0]);
      const from = parts[1];
      const to = parts[2];
      const toGram: Record<string, number> = {
        "千克": 1000, "kg": 1000, "克": 1, "g": 1,
        "磅": 453.592, "lb": 453.592, "盎司": 28.3495, "oz": 28.3495,
        "吨": 1000000, "t": 1000000, "斤": 500, "两": 50,
      };
      const fromG = toGram[from];
      const toG = toGram[to];
      if (!fromG || !toG) return { text: `不支持的单位\n支持：${Object.keys(toGram).join(" / ")}`, status: "error" };
      const result = (value * fromG) / toG;
      return { text: `${value} ${from} = ${result.toFixed(6)} ${to}`, status: "success", executed: true };
    }
    case "temperature": {
      const arg = extractArg(input, ["温度", "摄氏", "华氏", "celsius", "fahrenheit"]) || "";
      const parts = arg.split(/\s+/);
      if (parts.length < 3) return { text: "格式：温度 数值 源单位 目标单位\n例：温度 25 摄氏 华氏\n支持：摄氏/华氏/开尔文", status: "info" };
      const value = parseFloat(parts[0]);
      const from = parts[1];
      const to = parts[2];
      // 转为摄氏度
      let celsius: number;
      if (from === "摄氏" || from === "c" || from === "celsius") celsius = value;
      else if (from === "华氏" || from === "f" || from === "fahrenheit") celsius = (value - 32) * 5 / 9;
      else if (from === "开尔文" || from === "k" || from === "kelvin") celsius = value - 273.15;
      else return { text: "不支持的源单位", status: "error" };
      let result: number;
      let unit: string;
      if (to === "摄氏" || to === "c" || to === "celsius") { result = celsius; unit = "°C"; }
      else if (to === "华氏" || to === "f" || to === "fahrenheit") { result = celsius * 9 / 5 + 32; unit = "°F"; }
      else if (to === "开尔文" || to === "k" || to === "kelvin") { result = celsius + 273.15; unit = "K"; }
      else return { text: "不支持的目标单位", status: "error" };
      return { text: `${value} ${from} = ${result.toFixed(4)} ${unit}`, status: "success", executed: true };
    }
    case "area": {
      const arg = extractArg(input, ["面积", "平方米", "平方英尺", "area"]) || "";
      const parts = arg.split(/\s+/);
      if (parts.length < 3) return { text: "格式：面积 数值 源单位 目标单位\n例：面积 1 平方米 平方英尺", status: "info" };
      const value = parseFloat(parts[0]);
      const from = parts[1];
      const to = parts[2];
      const toM2: Record<string, number> = {
        "平方米": 1, "m2": 1, "平方千米": 1000000, "km2": 1000000,
        "平方英尺": 0.092903, "ft2": 0.092903, "平方英寸": 0.00064516, "in2": 0.00064516,
        "公顷": 10000, "ha": 10000, "亩": 666.667, "英亩": 4046.86, "acre": 4046.86,
      };
      const fromM2 = toM2[from];
      const toM2Val = toM2[to];
      if (!fromM2 || !toM2Val) return { text: `不支持的单位\n支持：${Object.keys(toM2).join(" / ")}`, status: "error" };
      const result = (value * fromM2) / toM2Val;
      return { text: `${value} ${from} = ${result.toFixed(6)} ${to}`, status: "success", executed: true };
    }
    case "speed": {
      const arg = extractArg(input, ["速度", "km/h", "mph", "speed"]) || "";
      const parts = arg.split(/\s+/);
      if (parts.length < 3) return { text: "格式：速度 数值 源单位 目标单位\n例：速度 100 km/h mph\n支持：m/s, km/h, mph, 节", status: "info" };
      const value = parseFloat(parts[0]);
      const from = parts[1];
      const to = parts[2];
      const toMs: Record<string, number> = {
        "m/s": 1, "km/h": 0.277778, "mph": 0.44704, "节": 0.514444, "knot": 0.514444,
      };
      const fromMs = toMs[from];
      const toMsVal = toMs[to];
      if (!fromMs || !toMsVal) return { text: `不支持的单位\n支持：${Object.keys(toMs).join(" / ")}`, status: "error" };
      const result = (value * fromMs) / toMsVal;
      return { text: `${value} ${from} = ${result.toFixed(6)} ${to}`, status: "success", executed: true };
    }
    case "data-size": {
      const arg = extractArg(input, ["数据大小", "字节", "byte", "kb", "mb", "gb"]) || "";
      const parts = arg.split(/\s+/);
      if (parts.length < 3) return { text: "格式：数据大小 数值 源单位 目标单位\n例：数据大小 1 GB MB", status: "info" };
      const value = parseFloat(parts[0]);
      const from = parts[1].toUpperCase();
      const to = parts[2].toUpperCase();
      const toB: Record<string, number> = {
        "B": 1, "KB": 1024, "MB": 1048576, "GB": 1073741824,
        "TB": 1099511627776, "PB": 1125899906842624,
      };
      const fromB = toB[from];
      const toBVal = toB[to];
      if (!fromB || !toBVal) return { text: `不支持的单位\n支持：${Object.keys(toB).join(" / ")}`, status: "error" };
      const result = (value * fromB) / toBVal;
      return { text: `${value} ${from} = ${result.toFixed(4)} ${to}`, status: "success", executed: true };
    }

    // ===== 颜色工具 =====
    case "random-color": {
      const hex = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return {
        text: `随机颜色：\nHEX: ${hex.toUpperCase()}\nRGB: rgb(${r}, ${g}, ${b})\nCSS: background-color: ${hex};`,
        status: "success",
        executed: true,
      };
    }
    case "rgb-hex": {
      const arg = extractArg(input, ["rgb", "hex", "颜色转换"]) || "";
      let hex = "", rgb = "";
      if (/^#[0-9a-f]{6}$/i.test(arg)) {
        // HEX → RGB
        const r = parseInt(arg.slice(1, 3), 16);
        const g = parseInt(arg.slice(3, 5), 16);
        const b = parseInt(arg.slice(5, 7), 16);
        hex = arg.toUpperCase();
        rgb = `rgb(${r}, ${g}, ${b})`;
      } else if (/^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test(arg)) {
        // RGB → HEX
        const [r, g, b] = arg.split(",").map((s) => parseInt(s.trim(), 10));
        if ([r, g, b].some((v) => v < 0 || v > 255)) {
          return { text: "RGB 值应在 0-255 范围内", status: "error" };
        }
        hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
        rgb = `rgb(${r}, ${g}, ${b})`;
      } else {
        return { text: "格式：rgb #FF5733 或 rgb 255,87,51", status: "info" };
      }
      return { text: `颜色转换：\nHEX: ${hex}\nRGB: ${rgb}`, status: "success", executed: true };
    }
    case "color-info": {
      const arg = extractArg(input, ["颜色信息", "hsl", "hsv", "cmyk"]) || "";
      if (!/^#[0-9a-f]{6}$/i.test(arg)) return { text: "请输入 HEX 颜色，如：颜色信息 #FF5733", status: "info" };
      const r = parseInt(arg.slice(1, 3), 16) / 255;
      const g = parseInt(arg.slice(3, 5), 16) / 255;
      const b = parseInt(arg.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const delta = max - min;
      const l = (max + min) / 2;
      let h = 0, s = 0;
      if (delta !== 0) {
        s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
        switch (max) {
          case r: h = ((g - b) / delta + (g < b ? 6 : 0)) * 60; break;
          case g: h = ((b - r) / delta + 2) * 60; break;
          case b: h = ((r - g) / delta + 4) * 60; break;
        }
      }
      const v = max;
      // CMYK
      const k = 1 - max;
      const c = k === 1 ? 0 : (1 - r - k) / (1 - k);
      const m = k === 1 ? 0 : (1 - g - k) / (1 - k);
      const y = k === 1 ? 0 : (1 - b - k) / (1 - k);
      return {
        text: `${arg.toUpperCase()} 颜色信息：\nHEX: ${arg.toUpperCase()}\nRGB: rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})\nHSL: hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)\nHSV: hsv(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(v * 100)}%)\nCMYK: cmyk(${Math.round(c * 100)}%, ${Math.round(m * 100)}%, ${Math.round(y * 100)}%, ${Math.round(k * 100)}%)`,
        status: "success",
        executed: true,
      };
    }
    case "gradient": {
      const c1 = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
      const c2 = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
      const angle = Math.floor(Math.random() * 360);
      return {
        text: `随机渐变：\nlinear-gradient(${angle}deg, ${c1}, ${c2})\n\nCSS：\nbackground: linear-gradient(${angle}deg, ${c1}, ${c2});`,
        status: "success",
        executed: true,
      };
    }

    // ===== 开发工具 =====
    case "git-status": {
      const res = await runShell("git", ["status", "--short"]);
      if (!res) return browserFallback("git status", "浏览器环境无法执行 git 命令");
      const text = res.stdout.trim();
      if (!text) return { text: "工作区干净，无未提交更改", status: "success", executed: true };
      return { text: `Git 状态：\n${text}`, status: "warning", executed: true };
    }
    case "node-version": {
      const res = await runShell("node", ["--version"]);
      if (!res) return browserFallback("node --version", "浏览器环境无法执行 node 命令");
      return { text: `Node.js 版本：${res.stdout.trim()}`, status: "success", executed: true };
    }
    case "npm-list": {
      const res = await runShell("npm", ["list", "--depth=0"]);
      if (!res) return browserFallback("npm list", "浏览器环境无法执行 npm 命令");
      return { text: `已安装 npm 包：\n${res.stdout}`, status: "success", executed: true };
    }
    case "lorem-ipsum": {
      const words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum".split(" ");
      const count = parseInt(extractArg(input, ["lorem", "占位文本", "ipsum"]) || "30", 10) || 30;
      const paras: string[] = [];
      for (let i = 0; i < Math.max(1, Math.ceil(count / 30)); i++) {
        const line: string[] = [];
        for (let j = 0; j < Math.min(count, 30); j++) {
          line.push(words[Math.floor(Math.random() * words.length)]);
        }
        paras.push(line.join(" "));
      }
      return {
        text: `Lorem Ipsum（${count} 词）：\n\n${paras.map((p) => p.charAt(0).toUpperCase() + p.slice(1) + ".").join("\n\n")}`,
        status: "success",
        executed: true,
      };
    }
    case "cron-parse": {
      const expr = extractArg(input, ["cron", "cron表达式", "定时任务"]) || "";
      if (!expr) return { text: "请输入 Cron 表达式，如：cron 0 0 * * *", status: "info" };
      const parts = expr.split(/\s+/);
      if (parts.length !== 5) return { text: "Cron 表达式应为 5 段：分 时 日 月 周\n例：0 0 * * *（每天 0 点）", status: "error" };
      const [min, hour, day, month, week] = parts;
      const desc: string[] = [];
      desc.push(`分钟：${min === "*" ? "每分钟" : min}`);
      desc.push(`小时：${hour === "*" ? "每小时" : hour}`);
      desc.push(`日期：${day === "*" ? "每天" : day}`);
      desc.push(`月份：${month === "*" ? "每月" : month}`);
      desc.push(`星期：${week === "*" ? "每周" : week}`);
      // 简单总结
      let summary = "";
      if (min === "0" && hour === "0" && day === "*" && month === "*" && week === "*") summary = "每天 0:00 执行";
      else if (min === "0" && hour === "*" && day === "*" && month === "*" && week === "*") summary = "每小时整点执行";
      else if (min === "*/5" && hour === "*") summary = "每 5 分钟执行一次";
      else if (min === "0" && hour !== "*" && day === "*" && month === "*" && week === "*") summary = `每天 ${hour}:00 执行`;
      else if (min === "0" && hour === "0" && day === "*" && month === "*" && week === "1") summary = "每周一 0:00 执行";
      return {
        text: `Cron 解析：${expr}\n${summary ? `\n说明：${summary}\n` : ""}\n${desc.join("\n")}`,
        status: "success",
        executed: true,
      };
    }
    case "http-status": {
      const code = extractArg(input, ["http", "状态码", "status code"]) || "";
      if (!code) return { text: "请输入 HTTP 状态码，如：http 404", status: "info" };
      const map: Record<string, string> = {
        "200": "OK - 请求成功",
        "201": "Created - 资源创建成功",
        "204": "No Content - 无内容返回",
        "301": "Moved Permanently - 永久重定向",
        "302": "Found - 临时重定向",
        "304": "Not Modified - 资源未修改",
        "400": "Bad Request - 请求参数错误",
        "401": "Unauthorized - 未认证",
        "403": "Forbidden - 无权限访问",
        "404": "Not Found - 资源不存在",
        "405": "Method Not Allowed - 方法不允许",
        "408": "Request Timeout - 请求超时",
        "409": "Conflict - 资源冲突",
        "413": "Payload Too Large - 请求体过大",
        "429": "Too Many Requests - 请求频率过高",
        "500": "Internal Server Error - 服务器内部错误",
        "501": "Not Implemented - 未实现",
        "502": "Bad Gateway - 网关错误",
        "503": "Service Unavailable - 服务不可用",
        "504": "Gateway Timeout - 网关超时",
      };
      const desc = map[code];
      if (!desc) return { text: `未知的 HTTP 状态码：${code}`, status: "warning" };
      return { text: `HTTP ${code}：\n${desc}`, status: "success", executed: true };
    }

    // ===== 文件操作 =====
    case "open-path": {
      const path = extractArg(input, ["打开路径", "open path"]) || "";
      if (!path) return { text: "请输入要打开的路径，如：打开路径 C:\\Users", status: "info" };
      return execShell("explorer.exe", [path], `正在打开 ${path}`);
    }
    case "list-dir": {
      const path = extractArg(input, ["列目录", "list dir", "文件列表"]) || ".";
      const res = await runShell("cmd", ["/c", "dir", path]);
      if (!res) return browserFallback(`dir ${path}`, "浏览器环境无法执行 dir 命令");
      return { text: `目录 ${path} 内容：\n${res.stdout}`, status: "success", executed: true };
    }
    case "create-folder": {
      const path = extractArg(input, ["创建文件夹", "mkdir", "新建文件夹"]) || "";
      if (!path) return { text: "请输入文件夹路径，如：创建文件夹 D:\\test", status: "info" };
      return execShell("cmd", ["/c", "mkdir", path], `已创建文件夹 ${path}`);
    }
    case "file-info": {
      const path = extractArg(input, ["文件信息", "file info"]) || "";
      if (!path) return { text: "请输入文件路径", status: "info" };
      const res = await runShell("cmd", ["/c", "dir", path]);
      if (!res) return browserFallback(`dir ${path}`, "浏览器环境无法执行命令");
      return { text: `文件信息：\n${res.stdout}`, status: "success", executed: true };
    }

    // ===== 剪贴板 =====
    case "copy-text": {
      const text = extractArg(input, ["复制", "copy", "剪贴板"]) || "";
      if (!text) return { text: "请输入要复制的文本，如：复制 hello world", status: "info" };
      try {
        await navigator.clipboard.writeText(text);
        return { text: `已复制到剪贴板：\n${text}`, status: "success", executed: true };
      } catch {
        return { text: "复制失败，浏览器可能不支持剪贴板 API", status: "error" };
      }
    }
    case "read-clip": {
      try {
        const text = await navigator.clipboard.readText();
        return {
          text: text ? `剪贴板内容：\n${text}` : "剪贴板为空",
          status: "success",
          executed: true,
        };
      } catch {
        return { text: "读取剪贴板失败，浏览器可能不支持或需用户授权", status: "error" };
      }
    }
    case "clear-clip": {
      try {
        await navigator.clipboard.writeText("");
        return { text: "已清空剪贴板", status: "success", executed: true };
      } catch {
        return { text: "清空剪贴板失败", status: "error" };
      }
    }

    // ===== 信息查询 =====
    case "sysinfo": {
      const ua = navigator.userAgent;
      const platform = navigator.platform;
      const lang = navigator.language;
      return {
        text: `系统信息：\n平台: ${platform}\n语言: ${lang}\nUser-Agent: ${ua}\n\n（桌面应用中可获取更详细的硬件信息）`,
        status: "success",
        executed: true,
      };
    }
    case "battery": {
      try {
        const bat = await (navigator as Navigator & {
          getBattery?: () => Promise<{ level: number; charging: boolean }>;
        }).getBattery?.();
        if (bat) {
          return {
            text: `电池状态：\n电量: ${Math.round(bat.level * 100)}%\n状态: ${bat.charging ? "充电中" : "使用电池"}`,
            status: "success",
            executed: true,
          };
        }
      } catch { /* ignore */ }
      return { text: "浏览器不支持电池 API", status: "info" };
    }
    case "screen": {
      return {
        text: `屏幕信息：\n分辨率: ${screen.width} × ${screen.height}\n设备像素比: ${window.devicePixelRatio}\n色深: ${screen.colorDepth} 位`,
        status: "success",
        executed: true,
      };
    }
    case "network-info": {
      const conn = (navigator as Navigator & { connection?: { downlink?: number; rtt?: number; effectiveType?: string } }).connection;
      if (conn) {
        return {
          text: `网络状态：\n在线: ${navigator.onLine ? "是" : "否"}\n类型: ${conn.effectiveType ?? "未知"}\n下行: ${conn.downlink ?? "未知"} Mbps\n延迟: ${conn.rtt ?? "未知"} ms`,
          status: "success",
          executed: true,
        };
      }
      return { text: `网络状态：\n在线: ${navigator.onLine ? "是" : "否"}`, status: "success", executed: true };
    }
    case "help": {
      const groups = commandCategories.map((cat) => {
        const cmds = aiCommands.filter((c) => c.category === cat.id);
        return `${cat.name}：\n${cmds.map((c) => `  · ${c.title}（${c.keywords[0]}）`).join("\n")}`;
      });
      return {
        text: `我是小林 AI 助手，可以帮你执行各种系统操作和工具命令。\n\n可用功能：\n\n${groups.join("\n\n")}\n\n直接输入命令名称或关键词即可，例如：\n· "关机"\n· "ping baidu.com"\n· "base64 hello"\n· "当前时间"`,
        status: "info",
      };
    }

    default:
      return { text: `命令 ${cmd.title} 暂未实现`, status: "warning" };
  }
}

// 封装 shell 执行
async function execShell(
  command: string,
  args: string[],
  successMsg: string
): Promise<AIResponse> {
  const res = await runShell(command, args);
  if (res === null) {
    return browserFallback(`${command} ${args.join(" ")}`, "浏览器环境无法执行系统命令，请在桌面应用中使用此功能");
  }
  if (res.success) {
    return { text: successMsg, status: "success", executed: true };
  }
  return { text: `执行失败：${res.stderr || "未知错误"}`, status: "error", executed: true };
}

// 浏览器降级提示
function browserFallback(command: string, msg: string): AIResponse {
  return {
    text: `${msg}\n\n待执行命令：${command}`,
    status: "warning",
  };
}

// 提取命令后的参数
function extractArg(input: string, keywords: string[]): string {
  const lower = input.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx >= 0) {
      const after = input.slice(idx + kw.length).trim();
      if (after) return after;
    }
  }
  return "";
}

// 简易 MD5 实现（浏览器原生无，用纯 JS 实现）
async function calcMD5(text: string): Promise<string> {
  // 使用 SubtleCrypto 计算 SHA-256 作为近似（浏览器原生无 MD5）
  // 标注为 SHA-256 避免误导
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

// ---------- 智能闲聊回复 ----------

export function chatReply(input: string): AIResponse {
  const lower = input.toLowerCase().trim();

  // 问候
  if (/^(你好|hi|hello|嗨|哈喽|在吗)/.test(lower)) {
    return {
      text: "你好！我是小林 AI 助手。输入「帮助」查看我能为你做什么，或直接告诉我你想执行的操作。",
      status: "info",
    };
  }

  // 感谢
  if (/(谢谢|感谢|thanks|thank you|多谢)/.test(lower)) {
    return { text: "不客气！有其他需要随时告诉我。", status: "info" };
  }

  // 退出
  if (/(再见|拜拜|bye|exit|quit)/.test(lower)) {
    return { text: "再见！随时回来找我。", status: "info" };
  }

  // 你是谁
  if (/(你是谁|你叫什么|你的名字|who are you)/.test(lower)) {
    return {
      text: "我是小林 AI，一个对话型 AI 助手。我可以帮你执行系统操作、快捷启动程序、处理文本、查询信息等。输入「帮助」查看完整功能列表。",
      status: "info",
    };
  }

  // 默认
  return {
    text: `我不太理解「${input}」的意思。\n\n你可以：\n· 输入「帮助」查看所有可用命令\n· 直接输入命令关键词，如「关机」「计算器」「当前时间」「base64 编码」`,
    status: "warning",
  };
}
