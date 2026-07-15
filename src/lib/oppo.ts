// OPPO Find X8s 专属功能：封装 7 个 Tauri Rust 命令调用
// 通过 ADB 桥接读写手机系统信息，非 Tauri 环境返回提示性空值

// ---------- 类型定义（与 Rust 端 serde camelCase 对齐） ----------

export interface OppoDeviceStatus {
  adbAvailable: boolean;
  adbPath: string;
  deviceConnected: boolean;
  deviceSerial: string;
  isOppoFindx8s: boolean;
  message: string;
}

export interface OppoDeviceInfo {
  model: string;
  brand: string;
  device: string;
  androidVersion: string;
  colorosVersion: string;
  securityPatch: string;
  bootloader: string;
  screenResolution: string;
  screenDensity: string;
  cpuAbi: string;
  cpuCores: string;
  totalRam: string;
  totalStorage: string;
  batteryLevel: string;
  batteryTemp: string;
  // Find X8s 硬件规格（固定）
  socName: string;
  gpuName: string;
  cameraInfo: string;
  fastCharge: string;
}

export interface ThermalZone {
  zone: string;
  temp: number;
  typeName: string;
}

export interface PerformanceStatus {
  currentMode: string;
  cpuFreq: string[];
  gpuFreq: string;
  thermal: ThermalZone[];
  availableModes: string[];
}

export interface CameraBackupResult {
  success: boolean;
  backedUp: number;
  totalSize: string;
  rawCount: number;
  message: string;
}

export interface BatteryHealthResult {
  level: number;
  temperature: number;
  voltage: number;
  health: string;
  status: string;
  technology: string;
  chargeCounter: string;
  cycleCount: string;
  designCapacity: string;
  fastChargeEnabled: boolean;
  smartChargeEnabled: boolean;
  message: string;
}

export interface ColorOSCleanResult {
  cleaned: number;
  freedMb: number;
  details: string[];
  message: string;
}

export interface ScreenControlResult {
  success: boolean;
  refreshRate: string;
  brightness: number;
  eyeCare: boolean;
  darkMode: boolean;
  colorMode: string;
  message: string;
}

// ---------- Tauri 调用工具 ----------

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

// ---------- 封装函数 ----------

/**
 * 检测 ADB 与 OPPO Find X8s 连接状态
 * 非桌面环境返回 adbAvailable=false 提示
 */
export async function oppoCheckAdb(): Promise<OppoDeviceStatus> {
  const invoke = await getInvoke();
  if (!invoke) {
    return {
      adbAvailable: false,
      adbPath: "",
      deviceConnected: false,
      deviceSerial: "",
      isOppoFindx8s: false,
      message: "需 Tauri 桌面环境运行，且需安装 ADB 并连接 OPPO Find X8s",
    };
  }
  try {
    return (await invoke("oppo_check_adb")) as OppoDeviceStatus;
  } catch (e) {
    console.warn("[oppoCheckAdb] 调用失败", e);
    return {
      adbAvailable: false,
      adbPath: "",
      deviceConnected: false,
      deviceSerial: "",
      isOppoFindx8s: false,
      message: `检测失败：${e}`,
    };
  }
}

/**
 * 读取 OPPO Find X8s 完整设备信息（getprop + 固定规格）
 */
export async function oppoDeviceInfo(): Promise<OppoDeviceInfo | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("oppo_device_info")) as OppoDeviceInfo;
  } catch (e) {
    console.warn("[oppoDeviceInfo] 调用失败", e);
    return null;
  }
}

/**
 * 天玑 9400 性能调度：读取状态 / 切换模式
 * @param action "get" 读取 | "set" 切换
 * @param mode balanced/performance/powersave/super_powersave
 */
export async function oppoPerformanceMode(
  action: "get" | "set",
  mode: "balanced" | "performance" | "powersave" | "super_powersave" = "balanced"
): Promise<PerformanceStatus | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("oppo_performance_mode", { action, mode })) as PerformanceStatus;
  } catch (e) {
    console.warn("[oppoPerformanceMode] 调用失败", e);
    return null;
  }
}

/**
 * 哈苏影像管理
 * @param action scan 扫描 | backup_settings 备份设置 | clean_raw 清理RAW | enable_hasselblad 启用哈苏
 */
export async function oppoCameraBackup(
  action: "scan" | "backup_settings" | "clean_raw" | "enable_hasselblad"
): Promise<CameraBackupResult | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("oppo_camera_backup", { action })) as CameraBackupResult;
  } catch (e) {
    console.warn("[oppoCameraBackup] 调用失败", e);
    return null;
  }
}

/**
 * 100W 快充与电池健康检测
 */
export async function oppoBatteryHealth(): Promise<BatteryHealthResult | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("oppo_battery_health")) as BatteryHealthResult;
  } catch (e) {
    console.warn("[oppoBatteryHealth] 调用失败", e);
    return null;
  }
}

/**
 * ColorOS 系统优化
 * @param action scan_cache 扫描缓存 | clean_cache 清理缓存 | disable_bloatware 禁用预装 | enable_bloatware 恢复预装
 * @param packages 预装应用包名列表（disable/enable 时使用，空则使用内置列表）
 */
export async function oppoColorosClean(
  action: "scan_cache" | "clean_cache" | "disable_bloatware" | "enable_bloatware",
  packages: string[] = []
): Promise<ColorOSCleanResult | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("oppo_coloros_clean", { action, packages })) as ColorOSCleanResult;
  } catch (e) {
    console.warn("[oppoColorosClean] 调用失败", e);
    return null;
  }
}

/**
 * 120Hz 屏幕管理
 * @param action status 读取 | set_refresh 刷新率 | toggle_eye_care 护眼 | toggle_dark 暗色 | set_brightness 亮度
 * @param value auto/60/120（set_refresh）| 0/1（toggle_*）| 0-255（set_brightness）
 */
export async function oppoScreenControl(
  action: "status" | "set_refresh" | "toggle_eye_care" | "toggle_dark" | "set_brightness",
  value: string = ""
): Promise<ScreenControlResult | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("oppo_screen_control", { action, value })) as ScreenControlResult;
  } catch (e) {
    console.warn("[oppoScreenControl] 调用失败", e);
    return null;
  }
}

// ---------- 预装应用包名常量（供 UI 复用） ----------

export const OPPO_BLOATWARE: { pkg: string; name: string }[] = [
  { pkg: "com.coloros.gamespaceui", name: "游戏空间" },
  { pkg: "com.heytap.market", name: "软件商店" },
  { pkg: "com.heytap.cloud", name: "云服务" },
  { pkg: "com.coloros.video", name: "视频" },
  { pkg: "com.coloros.music", name: "音乐" },
  { pkg: "com.android.bookmarkprovider", name: "书签" },
  { pkg: "com.coloros.compass2", name: "指南针" },
  { pkg: "com.coloros.healthcheck", name: "健康检查" },
];
