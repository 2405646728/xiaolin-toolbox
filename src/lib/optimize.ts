// 优化操作层：封装 Tauri Rust 命令调用 + 浏览器环境降级
// 非 Tauri 环境：隐私清理可真实执行（浏览器 API），其余返回 null 提示需桌面环境

export interface JunkItem {
  path: string;
  size: number; // 字节
  category: string; // temp / cache / recycle / logs
}

export interface ScanJunkResult {
  items: JunkItem[];
  totalSize: number;
  count: number;
}

export interface StartupItem {
  name: string;
  command: string;
  location: string; // registry / startup_folder
  enabled: boolean;
}

export interface SoftwareItem {
  name: string;
  version: string;
  publisher: string;
  installDate: string;
  size: number; // MB，0 表示未知
}

export interface DiskUsageItem {
  name: string;
  total: number; // GB
  used: number; // GB
  available: number; // GB
  percent: number;
  type: string; // SSD / HDD / 未知
}

export interface KillResult {
  killed: string[];
  freedMb: number;
}

// ---------- 网络优化 ----------

export interface DnsServer {
  name: string;
  address: string;
  latencyMs: number; // 0 表示未测试或失败
  status: string; // ok / normal / slow / timeout
}

export interface NetworkDnsResult {
  currentDns: string;
  servers: DnsServer[];
  fastest: string | null; // 最快 DNS 地址
}

// ---------- 安全扫描 ----------

export interface SecurityThreat {
  name: string;
  severity: string; // critical / high / medium / low
  category: string; // malware / pup / suspicious / vulnerability
  path: string;
  detail: string;
}

export interface SecurityScanResult {
  threats: SecurityThreat[];
  total: number;
  critical: number;
  high: number;
  scannedDirs: number;
  scannedFiles: number;
  defenderStatus: string; // enabled / disabled / unknown
  firewallStatus: string;
  lastScan: string;
}

// Tauri 环境检测
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

// ---------- 垃圾清理 ----------

export async function scanJunk(): Promise<ScanJunkResult | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("scan_junk")) as ScanJunkResult;
  } catch (e) {
    console.warn("[scanJunk] 调用失败", e);
    return null;
  }
}

export async function cleanJunk(paths: string[]): Promise<number | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("clean_junk", { paths })) as number;
  } catch (e) {
    console.warn("[cleanJunk] 调用失败", e);
    return null;
  }
}

// ---------- 启动项 ----------

export async function listStartup(): Promise<StartupItem[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("list_startup")) as StartupItem[];
  } catch (e) {
    console.warn("[listStartup] 调用失败", e);
    return null;
  }
}

// ---------- 已安装软件 ----------

export async function listSoftware(): Promise<SoftwareItem[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("list_software")) as SoftwareItem[];
  } catch (e) {
    console.warn("[listSoftware] 调用失败", e);
    return null;
  }
}

// ---------- 磁盘分析 ----------

export async function analyzeDisk(): Promise<DiskUsageItem[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("analyze_disk")) as DiskUsageItem[];
  } catch (e) {
    console.warn("[analyzeDisk] 调用失败", e);
    return null;
  }
}

// ---------- 一键加速（结束进程） ----------

export async function killProcesses(pids: number[]): Promise<KillResult | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("kill_processes", { pids })) as KillResult;
  } catch (e) {
    console.warn("[killProcesses] 调用失败", e);
    return null;
  }
}

// ---------- 网络优化（DNS 优选 / 测速 / 重置） ----------

export async function scanNetwork(): Promise<NetworkDnsResult | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("scan_network")) as NetworkDnsResult;
  } catch (e) {
    console.warn("[scanNetwork] 调用失败", e);
    return null;
  }
}

export async function setDns(address: string): Promise<string | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("set_dns", { address })) as string;
  } catch (e) {
    console.warn("[setDns] 调用失败", e);
    return null;
  }
}

export async function resetNetwork(): Promise<string | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("reset_network")) as string;
  } catch (e) {
    console.warn("[resetNetwork] 调用失败", e);
    return null;
  }
}

// ---------- 安全扫描（恶意软件 + 漏洞检测） ----------

export async function scanSecurity(): Promise<SecurityScanResult | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("scan_security")) as SecurityScanResult;
  } catch (e) {
    console.warn("[scanSecurity] 调用失败", e);
    return null;
  }
}

export async function quarantineThreat(paths: string[]): Promise<number | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("quarantine_threat", { paths })) as number;
  } catch (e) {
    console.warn("[quarantineThreat] 调用失败", e);
    return null;
  }
}

export async function enableDefender(): Promise<string | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("enable_defender")) as string;
  } catch (e) {
    console.warn("[enableDefender] 调用失败", e);
    return null;
  }
}

export async function enableFirewall(): Promise<string | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("enable_firewall")) as string;
  } catch (e) {
    console.warn("[enableFirewall] 调用失败", e);
    return null;
  }
}

// ---------- 隐私清理（浏览器端真实执行） ----------

export interface PrivacyAction {
  key: string;
  label: string;
  available: boolean;
}

export function getPrivacyActions(): PrivacyAction[] {
  return [
    {
      key: "caches",
      label: "Cache Storage（离线缓存）",
      available: typeof caches !== "undefined",
    },
    {
      key: "localStorage",
      label: "localStorage 本地存储",
      available: typeof localStorage !== "undefined",
    },
    {
      key: "sessionStorage",
      label: "sessionStorage 会话存储",
      available: typeof sessionStorage !== "undefined",
    },
    {
      key: "indexedDB",
      label: "IndexedDB 数据库",
      available: typeof indexedDB !== "undefined",
    },
    {
      key: "cookies",
      label: "Cookies（当前域名）",
      available: typeof document !== "undefined" && "cookie" in document,
    },
  ];
}

export async function executePrivacy(
  indices: number[]
): Promise<{ cleared: string[]; failed: string[] }> {
  const actions = getPrivacyActions();
  const cleared: string[] = [];
  const failed: string[] = [];

  for (const i of indices) {
    const action = actions[i];
    if (!action) continue;
    try {
      switch (action.key) {
        case "caches":
          if (typeof caches !== "undefined") {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
            cleared.push(action.label);
          }
          break;
        case "localStorage":
          if (typeof localStorage !== "undefined") {
            localStorage.clear();
            cleared.push(action.label);
          }
          break;
        case "sessionStorage":
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.clear();
            cleared.push(action.label);
          }
          break;
        case "indexedDB":
          if (typeof indexedDB !== "undefined") {
            // IndexedDB 无法直接列举所有数据库，只能清空已知库
            // 这里删除名为空的数据库（降级处理）
            await new Promise<void>((resolve) => {
              try {
                indexedDB.databases?.().then(async (dbs) => {
                  await Promise.all(
                    dbs.map((db) => {
                      if (db.name) return indexedDB.deleteDatabase(db.name);
                      return Promise.resolve();
                    })
                  );
                  resolve();
                }) ?? resolve();
              } catch {
                resolve();
              }
            });
            cleared.push(action.label);
          }
          break;
        case "cookies":
          if (typeof document !== "undefined" && "cookie" in document) {
            // 清空当前域名所有 cookie
            const cookies = document.cookie.split(";");
            for (const c of cookies) {
              const eq = c.indexOf("=");
              const name = eq > -1 ? c.substring(0, eq).trim() : c.trim();
              if (name) {
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
              }
            }
            cleared.push(action.label);
          }
          break;
      }
    } catch (e) {
      console.warn(`[executePrivacy] ${action.key} 清理失败`, e);
      failed.push(action.label);
    }
  }

  return { cleared, failed };
}

// ---------- 工具函数 ----------

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ====================================================================
// 移动端模块（桌面端等价真实实现）
// 在桌面环境提供与移动端等价的实用功能
// ====================================================================

// ---------- 移动模块通用类型 ----------

export interface MobileAppItem {
  name: string;
  packageName: string; // 桌面端：进程名/可执行文件名
  size: number; // MB
  cacheSize: number; // MB
  trafficMb: number;
  batteryPercent: number; // 桌面端：CPU 占比
  riskLevel: "safe" | "caution" | "advanced";
}

export interface MobileFileItem {
  name: string;
  path: string;
  size: number; // MB
  category: "large" | "duplicate" | "apk" | "cache" | "log";
}

export interface MobilePermissionItem {
  appName: string;
  packageName: string;
  permissions: string[];
  riskCount: number;
}

export interface MobileBlockItem {
  type: "call" | "sms"; // 桌面端：call=域名 sms=URL
  number: string;
  content: string;
  time: string;
  tag: string;
}

// ---------- 应用清理（浏览器/应用缓存目录扫描） ----------

export async function scanAppCleaner(): Promise<{ apps: MobileAppItem[]; totalCache: number }> {
  const invoke = await getInvoke();
  if (!invoke) {
    return { apps: [{
      name: "需 Tauri 桌面环境",
      packageName: "",
      size: 0, cacheSize: 0, trafficMb: 0, batteryPercent: 0, riskLevel: "safe",
    }], totalCache: 0 };
  }
  try {
    return (await invoke("scan_app_cache")) as { apps: MobileAppItem[]; totalCache: number };
  } catch (e) {
    console.warn("[scanAppCleaner] 调用失败", e);
    return { apps: [], totalCache: 0 };
  }
}

export async function cleanAppCache(packageNames: string[]): Promise<{ cleaned: number; freedMb: number } | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("clean_app_cache", { packageNames })) as { cleaned: number; freedMb: number };
  } catch (e) {
    console.warn("[cleanAppCache] 调用失败", e);
    return null;
  }
}

// ---------- 电池优化（电池状态 + 高 CPU 进程） ----------

export async function scanBattery(): Promise<{ apps: MobileAppItem[]; totalUsage: number }> {
  const invoke = await getInvoke();
  if (!invoke) {
    return { apps: [{
      name: "需 Tauri 桌面环境",
      packageName: "",
      size: 0, cacheSize: 0, trafficMb: 0, batteryPercent: 0, riskLevel: "safe",
    }], totalUsage: 0 };
  }
  try {
    return (await invoke("scan_power_processes")) as { apps: MobileAppItem[]; totalUsage: number };
  } catch (e) {
    console.warn("[scanBattery] 调用失败", e);
    return { apps: [], totalUsage: 0 };
  }
}

// ---------- 流量监控（netstat 网络连接 + 占用进程） ----------

export async function scanTraffic(): Promise<{ apps: MobileAppItem[]; totalMb: number; warning: string }> {
  const invoke = await getInvoke();
  if (!invoke) {
    return {
      apps: [{
        name: "需 Tauri 桌面环境",
        packageName: "",
        size: 0, cacheSize: 0, trafficMb: 0, batteryPercent: 0, riskLevel: "safe",
      }],
      totalMb: 0,
      warning: "需桌面环境",
    };
  }
  try {
    return (await invoke("scan_network_connections")) as { apps: MobileAppItem[]; totalMb: number; warning: string };
  } catch (e) {
    console.warn("[scanTraffic] 调用失败", e);
    return { apps: [], totalMb: 0, warning: "扫描失败" };
  }
}

// ---------- 自启管理（注册表启动项禁用） ----------

export async function scanAppStartup(): Promise<{ apps: MobileAppItem[]; relatedCount: number }> {
  const items = await listStartup();
  if (!items) {
    return { apps: [{
      name: "需 Tauri 桌面环境",
      packageName: "",
      size: 0, cacheSize: 0, trafficMb: 0, batteryPercent: 0, riskLevel: "safe",
    }], relatedCount: 0 };
  }
  const apps: MobileAppItem[] = items.map((it) => ({
    name: it.name,
    packageName: it.command,
    size: 0, cacheSize: 0, trafficMb: 0, batteryPercent: 0,
    riskLevel: "caution" as "safe" | "caution" | "advanced",
  }));
  return { apps, relatedCount: apps.length };
}

export async function disableStartup(name: string, location: string): Promise<boolean | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    await invoke("disable_startup", { name, location });
    return true;
  } catch (e) {
    console.warn("[disableStartup] 调用失败", e);
    return null;
  }
}

// ---------- 应用锁（AES-256 文件加密） ----------

export async function scanAppLock(): Promise<{ apps: MobileAppItem[]; lockedCount: number }> {
  const invoke = await getInvoke();
  if (!invoke) {
    return { apps: [{
      name: "需 Tauri 桌面环境",
      packageName: "",
      size: 0, cacheSize: 0, trafficMb: 0, batteryPercent: 0, riskLevel: "safe",
    }], lockedCount: 0 };
  }
  try {
    return (await invoke("scan_locked_files")) as { apps: MobileAppItem[]; lockedCount: number };
  } catch (e) {
    console.warn("[scanAppLock] 调用失败", e);
    return { apps: [], lockedCount: 0 };
  }
}

export async function encryptFile(filePath: string, password: string): Promise<string | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("encrypt_file", { filePath, password })) as string;
  } catch (e) {
    console.warn("[encryptFile] 调用失败", e);
    return null;
  }
}

export async function decryptFile(filePath: string, password: string): Promise<string | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("decrypt_file", { filePath, password })) as string;
  } catch (e) {
    console.warn("[decryptFile] 调用失败", e);
    return null;
  }
}

// ---------- 骚扰拦截（hosts 文件广告/恶意域名屏蔽） ----------

export async function scanBlocker(): Promise<{ items: MobileBlockItem[]; blockedCount: number }> {
  const invoke = await getInvoke();
  if (!invoke) {
    return { items: [{
      type: "call", number: "", content: "需 Tauri 桌面环境", time: "", tag: "",
    }], blockedCount: 0 };
  }
  try {
    return (await invoke("scan_hosts")) as { items: MobileBlockItem[]; blockedCount: number };
  } catch (e) {
    console.warn("[scanBlocker] 调用失败", e);
    return { items: [], blockedCount: 0 };
  }
}

export async function addHostsBlock(domains: string[]): Promise<number | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("add_hosts_block", { domains })) as number;
  } catch (e) {
    console.warn("[addHostsBlock] 调用失败", e);
    return null;
  }
}

export async function removeHostsBlock(domains: string[]): Promise<number | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("remove_hosts_block", { domains })) as number;
  } catch (e) {
    console.warn("[removeHostsBlock] 调用失败", e);
    return null;
  }
}

// ---------- 权限管理（防火墙规则管理） ----------

export async function scanPermission(): Promise<{ apps: MobilePermissionItem[]; totalRisk: number }> {
  const invoke = await getInvoke();
  if (!invoke) {
    return { apps: [{
      appName: "需 Tauri 桌面环境",
      packageName: "",
      permissions: [],
      riskCount: 0,
    }], totalRisk: 0 };
  }
  try {
    return (await invoke("scan_firewall_rules")) as { apps: MobilePermissionItem[]; totalRisk: number };
  } catch (e) {
    console.warn("[scanPermission] 调用失败", e);
    return { apps: [], totalRisk: 0 };
  }
}

export async function addFirewallBlock(programPath: string): Promise<string | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("add_firewall_block", { programPath })) as string;
  } catch (e) {
    console.warn("[addFirewallBlock] 调用失败", e);
    return null;
  }
}

export async function removeFirewallBlock(ruleName: string): Promise<string | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("remove_firewall_block", { ruleName })) as string;
  } catch (e) {
    console.warn("[removeFirewallBlock] 调用失败", e);
    return null;
  }
}

// ---------- 文件清理（大文件/重复文件/安装包残留） ----------

export async function scanFileClean(): Promise<{ files: MobileFileItem[]; totalSize: number }> {
  const invoke = await getInvoke();
  if (!invoke) {
    return { files: [{
      name: "需 Tauri 桌面环境",
      path: "",
      size: 0,
      category: "large",
    }], totalSize: 0 };
  }
  try {
    return (await invoke("scan_large_files")) as { files: MobileFileItem[]; totalSize: number };
  } catch (e) {
    console.warn("[scanFileClean] 调用失败", e);
    return { files: [], totalSize: 0 };
  }
}

export async function deleteFiles(paths: string[]): Promise<number | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("delete_files", { paths })) as number;
  } catch (e) {
    console.warn("[deleteFiles] 调用失败", e);
    return null;
  }
}
