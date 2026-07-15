// 模块元数据：含设备归属字段，用于设备识别后的分区渲染

export type DeviceType = "desktop" | "mobile" | "universal";
export type ModuleCategory = "optimize" | "monitor" | "privacy" | "system";
export type RiskLevel = "safe" | "caution" | "advanced";

export interface ModuleMeta {
  id: string;
  name: string;
  subtitle: string;
  icon: string; // lucide 图标名（在组件内映射）
  category: ModuleCategory;
  device: DeviceType;
  keywords: string[];
  riskLevel: RiskLevel;
  estimatedSize?: string;
  priority: number; // 越大越靠前
}

// 电脑专属模块（优先实现）
export const desktopModules: ModuleMeta[] = [
  {
    id: "cleaner",
    name: "垃圾清理",
    subtitle: "系统临时文件 · 缓存 · 回收站",
    icon: "Trash2",
    category: "optimize",
    device: "desktop",
    keywords: ["清理", "垃圾", "临时文件", "缓存", "回收站", "clean", "junk", "temp"],
    riskLevel: "safe",
    estimatedSize: "可清理 1.8 GB",
    priority: 100,
  },
  {
    id: "registry",
    name: "注册表清理",
    subtitle: "无效键值 · 残留项 · COM 组件",
    icon: "Database",
    category: "optimize",
    device: "desktop",
    keywords: ["注册表", "registry", "无效", "残留", "COM"],
    riskLevel: "caution",
    estimatedSize: "发现 326 项",
    priority: 90,
  },
  {
    id: "startup",
    name: "启动项管理",
    subtitle: "开机启动项 · 服务 · 计划任务",
    icon: "Rocket",
    category: "system",
    device: "desktop",
    keywords: ["启动", "开机", "自启", "服务", "计划任务", "startup", "boot"],
    riskLevel: "caution",
    estimatedSize: "23 项可优化",
    priority: 88,
  },
  {
    id: "disk",
    name: "磁盘优化",
    subtitle: "碎片整理 · SSD TRIM · 磁盘健康",
    icon: "HardDrive",
    category: "optimize",
    device: "desktop",
    keywords: ["磁盘", "碎片", "整理", "TRIM", "SSD", "硬盘", "disk", "defrag"],
    riskLevel: "safe",
    estimatedSize: "C 盘碎片 12%",
    priority: 82,
  },
  {
    id: "driver",
    name: "驱动管理",
    subtitle: "驱动检测 · 备份 · 回滚",
    icon: "Cpu",
    category: "system",
    device: "desktop",
    keywords: ["驱动", "driver", "更新", "备份", "回滚"],
    riskLevel: "caution",
    estimatedSize: "4 个驱动待更新",
    priority: 80,
  },
  {
    id: "software",
    name: "软件管理",
    subtitle: "软件卸载 · 更新检测 · 安装包清理",
    icon: "Package",
    category: "system",
    device: "desktop",
    keywords: ["软件", "卸载", "安装", "更新", "uninstall", "software"],
    riskLevel: "safe",
    estimatedSize: "已安装 86 款",
    priority: 78,
  },
  {
    id: "sysinfo",
    name: "系统信息",
    subtitle: "硬件配置 · 系统版本 · 运行时长",
    icon: "Info",
    category: "monitor",
    device: "desktop",
    keywords: ["系统", "信息", "硬件", "配置", "CPU", "内存", "sysinfo"],
    riskLevel: "safe",
    priority: 70,
  },
  {
    id: "cmdtools",
    name: "小林 AI 助手",
    subtitle: "智能命令执行 · 系统控制 · 工具集成",
    icon: "Terminal",
    category: "system",
    device: "desktop",
    keywords: ["命令", "命令行", "CMD", "PowerShell", "终端", "terminal", "cli", "ai", "助手", "小林"],
    riskLevel: "advanced",
    estimatedSize: "40+ 命令",
    priority: 95,
  },
];

// 移动专属模块（随后实现）
export const mobileModules: ModuleMeta[] = [
  {
    id: "app-cleaner",
    name: "应用清理",
    subtitle: "浏览器/应用缓存目录扫描清理",
    icon: "Smartphone",
    category: "optimize",
    device: "mobile",
    keywords: ["应用", "清理", "缓存", "残留", "app", "clean"],
    riskLevel: "safe",
    estimatedSize: "扫描缓存目录",
    priority: 100,
  },
  {
    id: "battery",
    name: "电池优化",
    subtitle: "高 CPU 进程排行 · 后台冻结",
    icon: "BatteryCharging",
    category: "optimize",
    device: "mobile",
    keywords: ["电池", "耗电", "省电", "后台", "冻结", "battery"],
    riskLevel: "safe",
    estimatedSize: "Top 10 进程",
    priority: 92,
  },
  {
    id: "traffic",
    name: "流量监控",
    subtitle: "网络连接统计 · 进程连接数",
    icon: "Activity",
    category: "monitor",
    device: "mobile",
    keywords: ["流量", "网络", "限流", "预警", "traffic", "data"],
    riskLevel: "safe",
    estimatedSize: "netstat 统计",
    priority: 88,
  },
  {
    id: "app-startup",
    name: "自启管理",
    subtitle: "注册表启动项 · 禁用自启",
    icon: "Power",
    category: "system",
    device: "mobile",
    keywords: ["自启", "开机", "关联", "启动", "autostart"],
    riskLevel: "caution",
    estimatedSize: "注册表 Run 项",
    priority: 84,
  },
  {
    id: "app-lock",
    name: "应用锁",
    subtitle: "文件加密 · XOR 密码保护",
    icon: "Lock",
    category: "privacy",
    device: "mobile",
    keywords: ["应用锁", "加密", "锁定", "隐私", "lock"],
    riskLevel: "safe",
    estimatedSize: ".xiaolin_enc",
    priority: 78,
  },
  {
    id: "blocker",
    name: "骚扰拦截",
    subtitle: "hosts 域名屏蔽 · 广告/恶意拦截",
    icon: "ShieldAlert",
    category: "privacy",
    device: "mobile",
    keywords: ["骚扰", "拦截", "来电", "短信", "黑名单", "block"],
    riskLevel: "safe",
    estimatedSize: "hosts 文件",
    priority: 74,
  },
  {
    id: "permission",
    name: "权限管理",
    subtitle: "防火墙规则 · 网络访问控制",
    icon: "KeyRound",
    category: "privacy",
    device: "mobile",
    keywords: ["权限", "管理", "回收", "permission", "隐私"],
    riskLevel: "caution",
    estimatedSize: "netsh 规则",
    priority: 70,
  },
  {
    id: "file-clean",
    name: "文件清理",
    subtitle: "大文件 · 重复文件 · 安装包残留",
    icon: "Files",
    category: "optimize",
    device: "mobile",
    keywords: ["文件", "大文件", "重复", "APK", "残留", "file"],
    riskLevel: "caution",
    estimatedSize: "扫描文档/下载",
    priority: 66,
  },
];

// 通用模块（两端共用）
export const universalModules: ModuleMeta[] = [
  {
    id: "boost",
    name: "一键加速",
    subtitle: "内存释放 · 后台清理",
    icon: "Zap",
    category: "optimize",
    device: "universal",
    keywords: ["加速", "一键", "内存", "释放", "boost", "加速球"],
    riskLevel: "safe",
    estimatedSize: "可释放 1.2 GB",
    priority: 120,
  },
  {
    id: "privacy",
    name: "隐私清理",
    subtitle: "浏览记录 · 剪贴板 · 最近文档",
    icon: "EyeOff",
    category: "privacy",
    device: "universal",
    keywords: ["隐私", "清理", "浏览", "记录", "剪贴板", "privacy"],
    riskLevel: "safe",
    estimatedSize: "186 条记录",
    priority: 86,
  },
  {
    id: "network",
    name: "网络优化",
    subtitle: "DNS 优选 · 网络测速 · 连接重置",
    icon: "Wifi",
    category: "optimize",
    device: "universal",
    keywords: ["网络", "DNS", "测速", "重置", "wifi", "network"],
    riskLevel: "caution",
    estimatedSize: "5 个 DNS 节点",
    priority: 76,
  },
  {
    id: "security",
    name: "安全扫描",
    subtitle: "恶意软件扫描 · 漏洞检测",
    icon: "ShieldCheck",
    category: "privacy",
    device: "universal",
    keywords: ["安全", "扫描", "病毒", "恶意", "漏洞", "security", "scan"],
    riskLevel: "safe",
    estimatedSize: "深度扫描",
    priority: 72,
  },
];

export const allModules: ModuleMeta[] = [
  ...universalModules,
  ...desktopModules,
  ...mobileModules,
];

// 根据当前设备模式拆分本机/跨设备模块
export function partitionModules(
  mode: "desktop" | "mobile"
): { native: ModuleMeta[]; cross: ModuleMeta[] } {
  const native = allModules
    .filter((m) => m.device === mode || m.device === "universal")
    .sort((a, b) => b.priority - a.priority);
  const cross = allModules
    .filter((m) => m.device !== mode && m.device !== "universal")
    .sort((a, b) => b.priority - a.priority);
  return { native, cross };
}
