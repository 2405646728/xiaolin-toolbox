// 优化详情页：根据模块 id 调用真实命令执行扫描 → 报告 → 优化
// Tauri 环境真实执行；浏览器环境隐私清理可执行，其余提示需桌面环境
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles, AlertTriangle, ShieldCheck, ShieldAlert, Flame, Wifi } from "lucide-react";
import { allModules } from "@/data/modules";
import { ModuleIcon } from "@/components/modules/ModuleIcon";
import { GlassCard } from "@/components/glass/GlassCard";
import { LiquidButton } from "@/components/liquid/LiquidButton";
import { cn } from "@/lib/utils";
import {
  scanJunk, cleanJunk, formatBytes,
  listStartup, listSoftware, analyzeDisk,
  getPrivacyActions, executePrivacy,
  scanNetwork, setDns, resetNetwork,
  scanSecurity, quarantineThreat, enableDefender, enableFirewall,
  scanAppCleaner, cleanAppCache, scanBattery, scanTraffic, scanAppStartup, disableStartup,
  scanAppLock, encryptFile, scanBlocker, addHostsBlock, scanPermission, addFirewallBlock, scanFileClean, deleteFiles,
  type JunkItem, type StartupItem, type SoftwareItem, type DiskUsageItem,
  type DnsServer, type SecurityThreat,
  type MobileAppItem, type MobileFileItem, type MobilePermissionItem, type MobileBlockItem,
} from "@/lib/optimize";

type Stage = "idle" | "scanning" | "report" | "cleaning" | "done";

// 扫描结果项（统一格式）
interface ScanRow {
  key: string;
  label: string;
  detail: string;
  size?: number; // 字节
  rawPath?: string; // 用于清理时传回
  severity?: string; // critical / high / medium / low（安全扫描）
  badge?: string; // 角标文本，如 "8ms" "critical"
  action?: "clean" | "set-dns" | "quarantine" | "enable-defender" | "enable-firewall" | "reset-network" | "clean-app" | "freeze" | "block" | "lock" | "revoke" | "disable-startup" | "delete-file"; // 执行类型
}

export default function OptimizeDetail() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const module = allModules.find((m) => m.id === moduleId);

  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [resultMsg, setResultMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleScan = async () => {
    setStage("scanning");
    setProgress(0);
    setErrorMsg("");
    setRows([]);

    // 进度模拟（真实扫描时推进）
    const timer = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 20, 90));
    }, 200);

    try {
      const result = await runScan(moduleId);
      clearInterval(timer);
      setProgress(100);
      setRows(result);
      // 默认选中：有 action 或有 size 的行（跳过纯信息行）
      const defaultChecked = new Set<number>();
      result.forEach((row, i) => {
        if (row.action || (row.size !== undefined && row.size > 0)) {
          defaultChecked.add(i);
        }
      });
      // 网络模块：仅默认选中最快的 DNS（第一个 set-dns 行）
      if (moduleId === "network") {
        const firstDnsIdx = result.findIndex((r) => r.action === "set-dns");
        if (firstDnsIdx >= 0) {
          defaultChecked.clear();
          defaultChecked.add(firstDnsIdx);
        }
      }
      setChecked(defaultChecked);
      setTimeout(() => setStage("report"), 300);
    } catch (e) {
      clearInterval(timer);
      setErrorMsg(String(e));
      setStage("idle");
    }
  };

  const handleExecute = async () => {
    setStage("cleaning");
    setProgress(0);
    setErrorMsg("");

    const timer = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 25, 90));
    }, 180);

    try {
      const msg = await runExecute(moduleId, rows, checked);
      clearInterval(timer);
      setProgress(100);
      setResultMsg(msg);
      setTimeout(() => setStage("done"), 300);
    } catch (e) {
      clearInterval(timer);
      setErrorMsg(String(e));
      setStage("report");
    }
  };

  if (!module) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <GlassCard className="p-6 text-center">
          <p className="text-sm text-argent-300">未找到该模块</p>
          <LiquidButton className="mt-4" onClick={() => navigate("/")}>
            返回首页
          </LiquidButton>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col gap-3 overflow-hidden sm:gap-4">
      {/* 顶部：返回 + 模块标题 */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex shrink-0 items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <LiquidButton size="sm" variant="ghost" onClick={() => navigate("/")} className="px-2.5">
            <ArrowLeft className="h-4 w-4" />
          </LiquidButton>
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl glass-tile-strong glass-tile-edge glass-shine text-titanium-500">
            <ModuleIcon name={module.icon} className="relative z-10 h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-semibold text-white">{module.name}</h1>
            <span className="text-[11px] text-argent-400">{module.subtitle}</span>
          </div>
        </div>
        {module.estimatedSize && stage === "idle" && (
          <span className="hidden font-mono text-xs text-titanium-400 sm:inline">
            {module.estimatedSize}
          </span>
        )}
      </motion.header>

      {/* 主面板 */}
      <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <GlassCard hover className="glass-shine flex min-h-[420px] flex-col p-6 sm:p-8">
            {/* 状态：待开始 */}
            {stage === "idle" && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                <div className="relative flex h-24 w-24 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-titanium-500/20 blur-xl animate-pulse-slow" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full glass-tile-strong glass-tile-edge glass-shine shadow-glow">
                    <ModuleIcon name={module.icon} className="relative z-10 h-9 w-9 text-white" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold text-white">{module.name}</h2>
                  <p className="text-sm text-argent-400">{module.subtitle}</p>
                  {module.estimatedSize && (
                    <p className="font-mono text-xs text-titanium-400">
                      {module.estimatedSize}
                    </p>
                  )}
                </div>
                {errorMsg && (
                  <div className="flex max-w-md items-center gap-2 rounded-xl glass-tile glass-tile-edge px-4 py-3 text-left text-xs text-crimson-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                <LiquidButton
                  size="lg"
                  variant="primary"
                  shimmer
                  onClick={handleScan}
                >
                  <Sparkles className="h-4 w-4" />
                  开始扫描
                </LiquidButton>
              </div>
            )}

            {/* 状态：扫描中 */}
            {stage === "scanning" && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-titanium-500" />
                <div className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold text-white">正在扫描…</h2>
                  <p className="text-xs text-argent-400">
                    深度检测 {module.name} 相关项目
                  </p>
                </div>
                <div className="relative h-2 w-full max-w-md overflow-hidden rounded-full glass-track">
                  <motion.div
                    className="relative h-full rounded-full glass-fill"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-titanium-400">
                  {Math.min(Math.round(progress), 100)}%
                </span>
              </div>
            )}

            {/* 状态：结果报告 */}
            {stage === "report" && (
              <div className="flex flex-1 flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">扫描完成</h2>
                    <p className="text-xs text-argent-400">
                      发现 {rows.length} 项，请选择处理项
                    </p>
                  </div>
                  {rows.length > 0 && (
                    <span className="font-mono text-sm text-titanium-400">
                      {rows.reduce((s, r) => s + (r.size ?? 0), 0) > 0
                        ? formatBytes(rows.reduce((s, r) => s + (r.size ?? 0), 0))
                        : `${rows.length} 项`}
                    </span>
                  )}
                </div>
                {errorMsg && (
                  <div className="flex items-center gap-2 rounded-xl glass-tile glass-tile-edge px-4 py-3 text-xs text-crimson-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {rows.length === 0 ? (
                    <div className="rounded-xl glass-tile glass-tile-edge px-4 py-6 text-center text-sm text-argent-400">
                      未发现可处理项
                    </div>
                  ) : (
                    rows.map((row, i) => {
                      const isChecked = checked.has(i);
                      const isInfoRow = !row.action && row.size === undefined;
                      const severityColor =
                        row.severity === "critical" ? "text-crimson-400" :
                        row.severity === "high" ? "text-orange-400" :
                        row.severity === "medium" ? "text-amber-400" :
                        row.severity === "low" ? "text-argent-400" : "text-titanium-400";
                      return (
                        <button
                          key={row.key}
                          onClick={() =>
                            isInfoRow ? undefined :
                            setChecked((prev) => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i);
                              else next.add(i);
                              return next;
                            })
                          }
                          onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
                            e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
                          }}
                          className={cn(
                            "relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3 text-left transition-colors",
                            isInfoRow && "cursor-default opacity-90",
                            !isInfoRow && isChecked
                              ? "glass-tile-strong glass-tile-edge text-white"
                              : "glass-tile glass-tile-edge glass-tile-hover text-argent-100 hover:text-white"
                          )}
                        >
                          {!isInfoRow && (
                            <span
                              className={cn(
                                "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md glass-tile glass-tile-edge",
                                isChecked && "glass-tile-strong"
                              )}
                            >
                              {isChecked && <CheckCircle2 className="relative z-10 h-4 w-4 text-titanium-500" />}
                            </span>
                          )}
                          {row.severity && (
                            <span className={cn("relative z-10 shrink-0", severityColor)}>
                              {row.severity === "critical" ? <Flame className="h-4 w-4" /> :
                               row.severity === "high" ? <ShieldAlert className="h-4 w-4" /> :
                               <ShieldCheck className="h-4 w-4" />}
                            </span>
                          )}
                          <div className="relative z-10 flex flex-1 flex-col gap-0.5 min-w-0">
                            <span className="truncate text-sm">{row.label}</span>
                            {row.detail && (
                              <span className="truncate text-[11px] text-argent-500">{row.detail}</span>
                            )}
                          </div>
                          {row.size !== undefined && row.size > 0 && (
                            <span className="relative z-10 shrink-0 font-mono text-[11px] text-titanium-400">
                              {formatBytes(row.size)}
                            </span>
                          )}
                          {row.badge && (
                            <span className={cn(
                              "relative z-10 shrink-0 rounded-full glass-tile glass-tile-edge px-2 py-0.5 font-mono text-[10px]",
                              severityColor
                            )}>
                              {row.badge}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <LiquidButton variant="ghost" onClick={handleScan}>
                    重新扫描
                  </LiquidButton>
                  <LiquidButton
                    variant="primary"
                    shimmer
                    disabled={checked.size === 0}
                    onClick={handleExecute}
                  >
                    执行优化（{checked.size}）
                  </LiquidButton>
                </div>
              </div>
            )}

            {/* 状态：执行中 */}
            {stage === "cleaning" && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-titanium-500" />
                <div className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold text-white">正在执行优化…</h2>
                  <p className="text-xs text-argent-400">请勿关闭窗口</p>
                </div>
                <div className="relative h-2 w-full max-w-md overflow-hidden rounded-full glass-track">
                  <motion.div
                    className="relative h-full rounded-full glass-fill"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-titanium-400">
                  {Math.min(Math.round(progress), 100)}%
                </span>
              </div>
            )}

            {/* 状态：完成 */}
            {stage === "done" && (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="relative flex h-20 w-20 items-center justify-center rounded-full glass-tile-strong glass-tile-edge glass-shine shadow-glow"
                >
                  <CheckCircle2 className="relative z-10 h-10 w-10 text-white" />
                </motion.div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold text-white">优化完成</h2>
                  <p className="text-sm text-argent-400">{resultMsg}</p>
                </div>
                <LiquidButton variant="primary" onClick={() => navigate("/")}>
                  返回首页
                </LiquidButton>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </main>
    </div>
  );
}

// ---------- 扫描逻辑分发 ----------

async function runScan(moduleId: string | undefined): Promise<ScanRow[]> {
  if (!moduleId) return [];

  switch (moduleId) {
    case "cleaner": {
      const res = await scanJunk();
      if (!res) {
        return [{
          key: "env",
          label: "需 Tauri 桌面环境",
          detail: "垃圾清理需读取系统临时目录，请在桌面应用中运行",
        }];
      }
      return res.items.map((j: JunkItem, i: number) => ({
        key: `junk-${i}`,
        label: j.path.split(/[\\/]/).pop() || j.path,
        detail: j.path,
        size: j.size,
        rawPath: j.path,
      }));
    }

    case "startup": {
      const res = await listStartup();
      if (!res) {
        return [{
          key: "env",
          label: "需 Tauri 桌面环境",
          detail: "启动项管理需读取注册表，请在桌面应用中运行",
        }];
      }
      return res.map((s: StartupItem, i: number) => ({
        key: `startup-${i}`,
        label: s.name,
        detail: `${s.location === "registry" ? "注册表" : "启动文件夹"} · ${s.command}`,
      }));
    }

    case "software": {
      const res = await listSoftware();
      if (!res) {
        return [{
          key: "env",
          label: "需 Tauri 桌面环境",
          detail: "软件管理需读取系统注册表，请在桌面应用中运行",
        }];
      }
      return res.map((s: SoftwareItem, i: number) => ({
        key: `sw-${i}`,
        label: s.name,
        detail: `${s.version} · ${s.publisher}${s.size > 0 ? ` · ${s.size} MB` : ""}`,
        size: s.size > 0 ? s.size * 1024 * 1024 : undefined,
      }));
    }

    case "disk": {
      const res = await analyzeDisk();
      if (!res) {
        return [{
          key: "env",
          label: "需 Tauri 桌面环境",
          detail: "磁盘分析需读取系统磁盘，请在桌面应用中运行",
        }];
      }
      return res.map((d: DiskUsageItem, i: number) => ({
        key: `disk-${i}`,
        label: `${d.name} (${d.type})`,
        detail: `已用 ${d.used.toFixed(1)} / ${d.total.toFixed(1)} GB · 可用 ${d.available.toFixed(1)} GB`,
        size: 0,
      }));
    }

    case "privacy": {
      const actions = getPrivacyActions();
      return actions.map((a, i) => ({
        key: `privacy-${i}`,
        label: a.label,
        detail: a.available ? "可清理" : "需桌面环境",
      }));
    }

    case "boost": {
      // 加速：扫描结果显示当前内存占用 Top（从系统 store 获取）
      return [{
        key: "boost-info",
        label: "一键内存加速",
        detail: "将结束非必要后台进程释放内存（需桌面环境真实执行）",
      }];
    }

    case "network": {
      const res = await scanNetwork();
      if (!res) {
        return [
          {
            key: "env",
            label: "需 Tauri 桌面环境",
            detail: "网络优化需执行系统命令（ping/ipconfig/netsh），请在桌面应用中运行",
          },
          {
            key: "reset-hint",
            label: "网络重置（重启后生效）",
            detail: "点击下方执行可重置 DNS 缓存 / Winsock / TCP-IP 栈",
            action: "reset-network" as const,
          },
        ];
      }
      const rows: ScanRow[] = [];
      // 当前 DNS 信息
      rows.push({
        key: "current-dns",
        label: `当前 DNS：${res.currentDns}`,
        detail: res.fastest ? `检测到最快 DNS：${res.fastest}` : "未检测到可用 DNS",
      });
      // DNS 候选列表（可选择设置为该 DNS）
      res.servers.forEach((s: DnsServer, i: number) => {
        const latencyText = s.latencyMs > 0 ? `${s.latencyMs} ms` : "超时";
        const statusText =
          s.status === "ok" ? "优秀" :
          s.status === "normal" ? "正常" :
          s.status === "slow" ? "较慢" : "不可达";
        rows.push({
          key: `dns-${i}`,
          label: `${s.name}（${s.address}）`,
          detail: `${statusText} · 点击选中设为系统 DNS`,
          badge: latencyText,
          action: "set-dns",
          rawPath: s.address,
        });
      });
      // 网络重置选项
      rows.push({
        key: "reset-network",
        label: "重置网络（DNS 缓存 + Winsock + TCP/IP）",
        detail: "刷新 DNS 缓存、重置 Winsock 目录与 TCP/IP 栈（重启后生效）",
        action: "reset-network",
      });
      // 默认选中：最快的 DNS（如果有）
      return rows;
    }

    case "security": {
      const res = await scanSecurity();
      if (!res) {
        return [{
          key: "env",
          label: "需 Tauri 桌面环境",
          detail: "安全扫描需读取系统文件与配置，请在桌面应用中运行",
        }];
      }
      const rows: ScanRow[] = [];
      // 扫描摘要
      rows.push({
        key: "summary",
        label: `扫描完成：已扫描 ${res.scannedFiles} 个文件 / ${res.scannedDirs} 个目录`,
        detail: `Defender: ${statusText(res.defenderStatus)} · 防火墙: ${statusText(res.firewallStatus)} · 上次更新: ${res.lastScan}`,
      });
      // 威胁列表
      res.threats.forEach((t: SecurityThreat, i: number) => {
        const isVuln = t.category === "vulnerability";
        const action: ScanRow["action"] = isVuln
          ? (t.name.includes("Defender") ? "enable-defender" : "enable-firewall")
          : "quarantine";
        rows.push({
          key: `threat-${i}`,
          label: t.name,
          detail: `${severityLabel(t.severity)} · ${t.detail}`,
          severity: t.severity,
          badge: t.severity.toUpperCase(),
          action,
          rawPath: t.path,
        });
      });
      return rows;
    }

    // ========== 移动端模块 ==========

    case "app-cleaner": {
      const { apps, totalCache } = await scanAppCleaner();
      const rows: ScanRow[] = [{
        key: "summary",
        label: `扫描完成：发现 ${apps.length} 个应用，可清理缓存 ${(totalCache / 1024).toFixed(2)} GB`,
        detail: "勾选要清理的应用，点击执行清理缓存",
      }];
      apps.forEach((a: MobileAppItem, i: number) => {
        rows.push({
          key: `app-${i}`,
          label: `${a.name}（${a.packageName}）`,
          detail: `应用大小 ${(a.size / 1024).toFixed(1)} GB · 缓存 ${(a.cacheSize / 1024).toFixed(2)} GB`,
          size: a.cacheSize * 1024 * 1024,
          badge: `${a.cacheSize} MB`,
          action: "clean-app",
          rawPath: a.packageName,
        });
      });
      return rows;
    }

    case "battery": {
      const { apps, totalUsage } = await scanBattery();
      const rows: ScanRow[] = [{
        key: "summary",
        label: `耗电应用排行 · Top ${apps.length} 共占用 ${totalUsage.toFixed(1)}% 电量`,
        detail: "勾选高耗电应用进行后台冻结，延长续航",
      }];
      apps.forEach((a: MobileAppItem, i: number) => {
        const sev = a.batteryPercent > 15 ? "critical" : a.batteryPercent > 10 ? "high" : a.batteryPercent > 6 ? "medium" : "low";
        rows.push({
          key: `bat-${i}`,
          label: `${a.name}（${a.packageName}）`,
          detail: `耗电占比 ${a.batteryPercent}% · 点击冻结后台`,
          severity: sev,
          badge: `${a.batteryPercent}%`,
          action: "freeze",
          rawPath: a.packageName,
        });
      });
      return rows;
    }

    case "traffic": {
      const { apps, totalMb, warning } = await scanTraffic();
      const rows: ScanRow[] = [{
        key: "summary",
        label: `本月已用 ${(totalMb / 1024).toFixed(2)} GB · ${warning}`,
        detail: "勾选高流量应用进行限流，防止超额",
      }];
      apps.forEach((a: MobileAppItem, i: number) => {
        const sev = a.trafficMb > 1000 ? "high" : a.trafficMb > 500 ? "medium" : "low";
        rows.push({
          key: `traf-${i}`,
          label: `${a.name}（${a.packageName}）`,
          detail: `本月流量 ${a.trafficMb} MB · 点击限制后台流量`,
          severity: sev,
          badge: `${(a.trafficMb / 1024).toFixed(2)} GB`,
          action: "block",
          rawPath: a.packageName,
        });
      });
      return rows;
    }

    case "app-startup": {
      const { apps, relatedCount } = await scanAppStartup();
      const rows: ScanRow[] = [{
        key: "summary",
        label: `发现 ${apps.length} 个开机自启应用 · ${relatedCount} 个关联启动行为`,
        detail: "勾选要禁用自启的应用，加快开机速度",
      }];
      apps.forEach((a: MobileAppItem, i: number) => {
        const sev = a.riskLevel === "advanced" ? "high" : a.riskLevel === "caution" ? "medium" : "low";
        rows.push({
          key: `startup-${i}`,
          label: `${a.name}（${a.packageName}）`,
          detail: `风险等级：${riskLabel(a.riskLevel)} · 点击禁用自启`,
          severity: sev,
          badge: riskLabel(a.riskLevel),
          action: "disable-startup",
          rawPath: a.packageName,
        });
      });
      return rows;
    }

    case "app-lock": {
      const { apps, lockedCount } = await scanAppLock();
      const rows: ScanRow[] = [{
        key: "summary",
        label: `已锁定 ${lockedCount} 个应用 · 推荐 ${apps.length} 个应用加锁`,
        detail: "勾选要加锁的应用，保护隐私安全",
      }];
      apps.forEach((a: MobileAppItem, i: number) => {
        const sev = a.riskLevel === "advanced" ? "high" : "medium";
        rows.push({
          key: `lock-${i}`,
          label: `${a.name}（${a.packageName}）`,
          detail: `隐私等级：${riskLabel(a.riskLevel)} · 点击启用应用锁`,
          severity: sev,
          badge: riskLabel(a.riskLevel),
          action: "lock",
          rawPath: a.packageName,
        });
      });
      return rows;
    }

    case "blocker": {
      const { items, blockedCount } = await scanBlocker();
      const rows: ScanRow[] = [{
        key: "summary",
        label: `拦截记录 ${items.length} 条 · 本月累计拦截 ${blockedCount} 次`,
        detail: "勾选号码加入黑名单，永久拦截骚扰",
      }];
      items.forEach((it: MobileBlockItem, i: number) => {
        const sev = it.tag === "诈骗" ? "critical" : it.tag === "营销" || it.tag === "中介" ? "medium" : "low";
        rows.push({
          key: `block-${i}`,
          label: `${it.type === "call" ? "📞" : "💬"} ${it.number} · ${it.content}`,
          detail: `${it.time} · 标记：${it.tag}`,
          severity: sev,
          badge: it.tag,
          action: "block",
          rawPath: it.number,
        });
      });
      return rows;
    }

    case "permission": {
      const { apps, totalRisk } = await scanPermission();
      const rows: ScanRow[] = [{
        key: "summary",
        label: `权限审计 · ${apps.length} 个应用 · 发现 ${totalRisk} 个高风险权限`,
        detail: "勾选要回收权限的应用，批量撤销越权授权",
      }];
      apps.forEach((a: MobilePermissionItem, i: number) => {
        const sev = a.riskCount >= 4 ? "critical" : a.riskCount >= 3 ? "high" : a.riskCount >= 2 ? "medium" : "low";
        rows.push({
          key: `perm-${i}`,
          label: `${a.appName}（${a.packageName}）`,
          detail: `已授权 ${a.permissions.length} 项：${a.permissions.join(" / ")}`,
          severity: sev,
          badge: `${a.riskCount} 项高危`,
          action: "revoke",
          rawPath: a.packageName,
        });
      });
      return rows;
    }

    case "file-clean": {
      const { files, totalSize } = await scanFileClean();
      const rows: ScanRow[] = [{
        key: "summary",
        label: `扫描完成：发现 ${files.length} 个可清理文件，共 ${(totalSize / 1024).toFixed(2)} GB`,
        detail: "大文件 / 重复文件 / APK 残留 / 缓存 / 日志",
      }];
      files.forEach((f: MobileFileItem, i: number) => {
        const sev = f.category === "large" && f.size > 500 ? "high" : f.category === "apk" ? "medium" : "low";
        rows.push({
          key: `file-${i}`,
          label: `${f.name}`,
          detail: `${f.path} · ${fileCategoryLabel(f.category)}`,
          size: f.size * 1024 * 1024,
          severity: sev,
          badge: `${f.size} MB`,
          action: "delete-file",
          rawPath: f.path + f.name,
        });
      });
      return rows;
    }

    default:
      return [{
        key: "todo",
        label: "该模块正在开发中",
        detail: `${moduleId} 模块的真实执行逻辑尚未实现`,
      }];
  }
}

// ---------- 执行逻辑分发 ----------

async function runExecute(
  moduleId: string | undefined,
  rows: ScanRow[],
  checked: Set<number>
): Promise<string> {
  if (!moduleId) return "无操作";

  switch (moduleId) {
    case "cleaner": {
      const paths = Array.from(checked).map((i) => rows[i]?.rawPath).filter(Boolean) as string[];
      if (paths.length === 0) return "未选择文件";
      const freed = await cleanJunk(paths);
      if (freed === null) return "需桌面环境执行";
      return `已清理 ${paths.length} 项，释放 ${formatBytes(freed)}`;
    }

    case "privacy": {
      const indices = Array.from(checked);
      const result = await executePrivacy(indices);
      const parts: string[] = [];
      if (result.cleared.length > 0) parts.push(`已清理 ${result.cleared.length} 项`);
      if (result.failed.length > 0) parts.push(`${result.failed.length} 项失败`);
      return parts.length > 0 ? parts.join(" · ") : "无操作";
    }

    case "boost": {
      return "加速功能需在桌面环境中执行（结束后台进程释放内存）";
    }

    case "startup": {
      return "启动项禁用功能开发中（当前仅支持查看）";
    }

    case "software": {
      return "软件卸载功能开发中（当前仅支持查看列表）";
    }

    case "disk": {
      return "磁盘优化功能开发中（当前仅支持查看占用）";
    }

    case "network": {
      // 根据选中项的 action 类型分别执行
      const logs: string[] = [];
      let dnsSet = false;
      let resetDone = false;
      for (const i of checked) {
        const row = rows[i];
        if (!row) continue;
        if (row.action === "set-dns" && row.rawPath && !dnsSet) {
          // 仅设置一次 DNS（避免重复）
          const r = await setDns(row.rawPath);
          if (r) {
            logs.push(`DNS 已设置为 ${row.rawPath}`);
            dnsSet = true;
          } else {
            logs.push(`设置 DNS ${row.rawPath} 失败（需管理员权限）`);
          }
        } else if (row.action === "reset-network" && !resetDone) {
          const r = await resetNetwork();
          if (r) {
            logs.push(r);
            resetDone = true;
          } else {
            logs.push("网络重置失败（需管理员权限）");
          }
        }
      }
      return logs.length > 0 ? logs.join(" · ") : "未选择操作";
    }

    case "security": {
      // 分类处理：威胁文件隔离 + Defender/防火墙启用
      const pathsToQuarantine: string[] = [];
      let needDefender = false;
      let needFirewall = false;
      for (const i of checked) {
        const row = rows[i];
        if (!row) continue;
        if (row.action === "quarantine" && row.rawPath) {
          pathsToQuarantine.push(row.rawPath);
        } else if (row.action === "enable-defender") {
          needDefender = true;
        } else if (row.action === "enable-firewall") {
          needFirewall = true;
        }
      }
      const parts: string[] = [];
      if (pathsToQuarantine.length > 0) {
        const n = await quarantineThreat(pathsToQuarantine);
        if (n !== null) {
          parts.push(`已隔离 ${n} 个威胁文件`);
        } else {
          parts.push("隔离失败（需桌面环境）");
        }
      }
      if (needDefender) {
        const r = await enableDefender();
        parts.push(r ?? "启用 Defender 失败");
      }
      if (needFirewall) {
        const r = await enableFirewall();
        parts.push(r ?? "启用防火墙失败");
      }
      return parts.length > 0 ? parts.join(" · ") : "未选择处理项";
    }

    // ========== 移动端模块执行 ==========

    case "app-cleaner": {
      const paths: string[] = [];
      for (const i of checked) {
        const row = rows[i];
        if (row?.action === "clean-app" && row.rawPath) paths.push(row.rawPath);
      }
      if (paths.length === 0) return "未选择清理项";
      const r = await cleanAppCache(paths);
      if (r) {
        return `已清理 ${r.cleaned} 个缓存目录，释放 ${r.freedMb} MB`;
      }
      return "清理失败（需桌面环境）";
    }

    case "battery": {
      // 高 CPU 进程：调用 killProcesses 结束（需 PID，此处用进程名提示）
      const names: string[] = [];
      for (const i of checked) {
        const row = rows[i];
        if (row?.action === "freeze" && row.rawPath) names.push(row.rawPath);
      }
      if (names.length === 0) return "未选择冻结项";
      return `已标记 ${names.length} 个高耗电进程（${names.join("、")}），建议通过任务管理器结束`;
    }

    case "traffic": {
      // 网络连接占用：提示用户可通过防火墙阻止
      const names: string[] = [];
      for (const i of checked) {
        const row = rows[i];
        if (row?.action === "block" && row.rawPath) names.push(row.rawPath);
      }
      if (names.length === 0) return "未选择限流项";
      return `已识别 ${names.length} 个高连接进程（${names.join("、")}），可通过「权限管理」添加防火墙规则`;
    }

    case "app-startup": {
      const results: string[] = [];
      for (const i of checked) {
        const row = rows[i];
        if (row?.action === "disable-startup" && row.rawPath) {
          // rawPath 是命令，需要 name + location
          const name = row.label.split("（")[0];
          const r = await disableStartup(name, "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run");
          results.push(r ? `已禁用 ${name}` : `${name} 禁用失败`);
        }
      }
      return results.length > 0 ? results.join(" · ") : "未选择禁用项";
    }

    case "app-lock": {
      // 文件加密：提示用户输入密码
      const paths: string[] = [];
      for (const i of checked) {
        const row = rows[i];
        if (row?.action === "lock" && row.rawPath) paths.push(row.rawPath);
      }
      if (paths.length === 0) return "未选择加密项";
      const password = window.prompt("请输入加密密码：");
      if (!password) return "已取消加密";
      const results: string[] = [];
      for (const p of paths) {
        const r = await encryptFile(p, password);
        results.push(r ?? `${p} 加密失败`);
      }
      return results.join(" · ");
    }

    case "blocker": {
      // hosts 域名屏蔽
      const domains: string[] = [];
      for (const i of checked) {
        const row = rows[i];
        if (row?.action === "block" && row.rawPath) domains.push(row.rawPath);
      }
      if (domains.length === 0) return "未选择屏蔽项";
      const r = await addHostsBlock(domains);
      if (r !== null) {
        return `已屏蔽 ${r} 个域名（写入 hosts 文件，需管理员权限）`;
      }
      return "屏蔽失败（需管理员权限写入 hosts）";
    }

    case "permission": {
      // 防火墙规则：添加阻止规则
      const results: string[] = [];
      for (const i of checked) {
        const row = rows[i];
        if (row?.action === "revoke" && row.rawPath) {
          const r = await addFirewallBlock(row.rawPath);
          results.push(r ?? `${row.label} 阻止失败`);
        }
      }
      return results.length > 0 ? results.join(" · ") : "未选择阻止项";
    }

    case "file-clean": {
      const paths: string[] = [];
      for (const i of checked) {
        const row = rows[i];
        if (row?.action === "delete-file" && row.rawPath) paths.push(row.rawPath);
      }
      if (paths.length === 0) return "未选择删除项";
      const r = await deleteFiles(paths);
      if (r !== null) {
        return `已删除 ${r} 个文件`;
      }
      return "删除失败（需桌面环境）";
    }

    default:
      return "该模块执行逻辑开发中";
  }
}

// ---------- 安全扫描辅助函数 ----------

function statusText(status: string): string {
  switch (status) {
    case "enabled": return "已启用";
    case "disabled": return "已禁用";
    case "unknown": return "未知";
    default: return status;
  }
}

function severityLabel(severity: string): string {
  switch (severity) {
    case "critical": return "严重";
    case "high": return "高危";
    case "medium": return "中危";
    case "low": return "低危";
    default: return severity;
  }
}

function riskLabel(risk: string): string {
  switch (risk) {
    case "safe": return "安全";
    case "caution": return "注意";
    case "advanced": return "高风险";
    default: return risk;
  }
}

function fileCategoryLabel(category: string): string {
  switch (category) {
    case "large": return "大文件";
    case "duplicate": return "重复文件";
    case "apk": return "安装包残留";
    case "cache": return "缓存文件";
    case "log": return "日志文件";
    default: return category;
  }
}
