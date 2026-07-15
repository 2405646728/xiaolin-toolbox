// OPPO Find X8s 专属工作室：通过 ADB 桥接实现 6 大定制功能模块
// 设备检测 → 设备信息 → 性能调度 / 哈苏影像 / 快充电池 / ColorOS 优化 / 120Hz 屏幕
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Smartphone,
  Cpu,
  Camera,
  BatteryCharging,
  Sparkles,
  MonitorSmartphone,
  RefreshCw,
  Loader2,
  Usb,
  CheckCircle2,
  AlertCircle,
  Power,
  Sun,
  Moon,
  Eye,
  Zap,
  Trash2,
  Download,
  Settings2,
  Snowflake,
  Gauge,
} from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { GlassButton } from "@/components/glass/GlassButton";
import {
  oppoCheckAdb,
  oppoDeviceInfo,
  oppoPerformanceMode,
  oppoCameraBackup,
  oppoBatteryHealth,
  oppoColorosClean,
  oppoScreenControl,
  OPPO_BLOATWARE,
  type OppoDeviceStatus,
  type OppoDeviceInfo,
  type PerformanceStatus,
  type CameraBackupResult,
  type BatteryHealthResult,
  type ColorOSCleanResult,
  type ScreenControlResult,
} from "@/lib/oppo";

type Tab = "device" | "performance" | "camera" | "battery" | "coloros" | "screen";

const TABS: { id: Tab; label: string; icon: typeof Cpu; desc: string }[] = [
  { id: "device", label: "设备信息", icon: Smartphone, desc: "型号 · 规格 · 系统" },
  { id: "performance", label: "性能调度", icon: Cpu, desc: "天玑 9400 · 温度" },
  { id: "camera", label: "哈苏影像", icon: Camera, desc: "RAW · 设置备份" },
  { id: "battery", label: "快充电池", icon: BatteryCharging, desc: "100W · 健康度" },
  { id: "coloros", label: "ColorOS", icon: Sparkles, desc: "缓存 · 预装" },
  { id: "screen", label: "120Hz 屏幕", icon: MonitorSmartphone, desc: "刷新率 · 护眼" },
];

export default function OppoStudio() {
  const [tab, setTab] = useState<Tab>("device");
  const [status, setStatus] = useState<OppoDeviceStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const refreshStatus = useCallback(async () => {
    setChecking(true);
    const s = await oppoCheckAdb();
    setStatus(s);
    setChecking(false);
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const connected = status?.deviceConnected && status.isOppoFindx8s;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Hero：设备连接状态 */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <GlassCard hover className="glass-shine overflow-hidden p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-titanium-500/40 to-titanium-700/30 glass-tile-edge shadow-glow">
                <span className="absolute inset-0 rounded-2xl bg-titanium-500/20 blur-md animate-pulse-slow" />
                <Smartphone className="relative z-10 h-7 w-7 text-titanium-300" />
              </div>
              <div className="flex flex-col">
                <h1 className="font-display text-lg font-bold tracking-wide text-white">
                  OPPO Find X8s 工作室
                </h1>
                <span className="text-xs text-argent-400">
                  天玑 9400 · 哈苏影像 · 100W SUPERVOOC · 专属定制
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ConnectionBadge status={status} checking={checking} />
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={refreshStatus}
                disabled={checking}
              >
                {checking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                重新检测
              </GlassButton>
            </div>
          </div>
          {!connected && status && (
            <div className="mt-4 rounded-xl glass-tile p-3 text-xs text-argent-300">
              <AlertCircle className="mr-1.5 inline h-3.5 w-3.5 text-titanium-400" />
              {status.message}
              {!status.adbAvailable && (
                <span className="mt-1 block text-argent-500">
                  下载 ADB：https://developer.android.com/tools/releases/platform-tools
                </span>
              )}
              {status.adbAvailable && !status.deviceConnected && (
                <span className="mt-1 block text-argent-500">
                  请在手机「设置 → 关于手机 → 版本信息」连续点击版本号开启开发者选项，
                  再到「设置 → 系统 → 开发者选项」开启 USB 调试，并用数据线连接电脑。
                </span>
              )}
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Tab 切换条 */}
      <div className="flex shrink-0 flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`group relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs transition-all ${
                active
                  ? "glass-tile-strong glass-tile-edge glass-shine text-white shadow-glow"
                  : "glass-tile glass-tile-edge glass-tile-hover text-argent-300 hover:text-white"
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 ${active ? "text-titanium-500" : "text-argent-400"}`}
              />
              <span className="font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 内容区 */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {!connected ? (
          <GlassCard className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Usb className="h-10 w-10 text-argent-500" />
            <p className="text-sm text-argent-300">
              请先连接 OPPO Find X8s 并开启 USB 调试
            </p>
            <p className="text-xs text-argent-500">
              连接后可使用 6 大专属功能模块
            </p>
          </GlassCard>
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {tab === "device" && <DevicePanel />}
            {tab === "performance" && <PerformancePanel />}
            {tab === "camera" && <CameraPanel />}
            {tab === "battery" && <BatteryPanel />}
            {tab === "coloros" && <ColorOSPanel />}
            {tab === "screen" && <ScreenPanel />}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ---------- 连接状态徽章 ----------

function ConnectionBadge({
  status,
  checking,
}: {
  status: OppoDeviceStatus | null;
  checking: boolean;
}) {
  if (checking || !status) {
    return (
      <span className="flex items-center gap-1.5 rounded-full glass-tile px-3 py-1.5 text-xs text-argent-300">
        <Loader2 className="h-3 w-3 animate-spin" />
        检测中
      </span>
    );
  }
  if (status.deviceConnected && status.isOppoFindx8s) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-titanium-500/20 px-3 py-1.5 text-xs text-titanium-200">
        <CheckCircle2 className="h-3 w-3" />
        Find X8s 已连接
      </span>
    );
  }
  if (status.deviceConnected) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1.5 text-xs text-amber-200">
        <AlertCircle className="h-3 w-3" />
        非 Find X8s
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-crimson-600/20 px-3 py-1.5 text-xs text-crimson-300">
      <AlertCircle className="h-3 w-3" />
      未连接
    </span>
  );
}

// ---------- 通用：信息行 + 模块卡片 ----------

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-argent-500">{label}</span>
      <span
        className={`truncate text-right font-mono text-xs ${
          accent ? "text-titanium-300" : "text-argent-100"
        }`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function ModuleCard({
  icon: Icon,
  title,
  subtitle,
  children,
  delay = 0,
}: {
  icon: typeof Cpu;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <GlassCard hover className="glass-shine flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg glass-tile-strong glass-tile-edge text-titanium-500">
            <Icon className="relative z-10 h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <span className="text-[11px] text-argent-500">{subtitle}</span>
          </div>
        </div>
        {children}
      </GlassCard>
    </motion.div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-xs text-argent-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      正在读取...
    </div>
  );
}

// ---------- 1. 设备信息面板 ----------

function DevicePanel() {
  const [info, setInfo] = useState<OppoDeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await oppoDeviceInfo();
    setInfo(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingRow />;
  if (!info)
    return (
      <GlassCard className="p-6 text-center text-sm text-argent-300">
        设备信息读取失败
      </GlassCard>
    );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ModuleCard icon={Smartphone} title="设备标识" subtitle="型号 · 品牌 · 系统" delay={0}>
        <div className="flex flex-col divide-y divide-white/5">
          <InfoRow label="型号" value={info.model} accent />
          <InfoRow label="品牌" value={info.brand} />
          <InfoRow label="设备代号" value={info.device} />
          <InfoRow label="Android 版本" value={info.androidVersion} />
          <InfoRow label="ColorOS 版本" value={info.colorosVersion} />
          <InfoRow label="安全补丁" value={info.securityPatch} />
          <InfoRow label="Bootloader" value={info.bootloader} />
        </div>
      </ModuleCard>

      <ModuleCard icon={Cpu} title="硬件规格" subtitle="天玑 9400 · G925 · 哈苏" delay={0.05}>
        <div className="flex flex-col divide-y divide-white/5">
          <InfoRow label="处理器" value={info.socName} accent />
          <InfoRow label="GPU" value={info.gpuName} />
          <InfoRow label="CPU 架构" value={info.cpuAbi} />
          <InfoRow label="CPU 核心" value={info.cpuCores} />
          <InfoRow label="运行内存" value={info.totalRam} />
          <InfoRow label="存储空间" value={info.totalStorage} />
          <InfoRow label="影像系统" value={info.cameraInfo} />
          <InfoRow label="快充规格" value={info.fastCharge} />
        </div>
      </ModuleCard>

      <ModuleCard icon={MonitorSmartphone} title="屏幕与电池" subtitle="分辨率 · 电量" delay={0.1}>
        <div className="flex flex-col divide-y divide-white/5">
          <InfoRow label="屏幕分辨率" value={info.screenResolution} accent />
          <InfoRow label="屏幕密度" value={info.screenDensity} />
          <InfoRow label="当前电量" value={info.batteryLevel} />
          <InfoRow label="电池温度" value={info.batteryTemp} />
        </div>
        <GlassButton variant="secondary" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
          刷新信息
        </GlassButton>
      </ModuleCard>
    </div>
  );
}

// ---------- 2. 性能调度面板（天玑 9400） ----------

function PerformancePanel() {
  const [data, setData] = useState<PerformanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const d = await oppoPerformanceMode("get");
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setMode = async (mode: "balanced" | "performance" | "powersave" | "super_powersave") => {
    setBusy(true);
    setMsg("");
    const d = await oppoPerformanceMode("set", mode);
    if (d) {
      setData(d);
      setMsg(`已切换为 ${d.currentMode}`);
    } else {
      setMsg("切换失败");
    }
    setBusy(false);
  };

  const modeBtns: {
    mode: "balanced" | "performance" | "powersave" | "super_powersave";
    label: string;
    icon: typeof Gauge;
  }[] = [
    { mode: "balanced", label: "均衡", icon: Gauge },
    { mode: "performance", label: "性能", icon: Zap },
    { mode: "powersave", label: "省电", icon: Snowflake },
    { mode: "super_powersave", label: "超级省电", icon: Power },
  ];

  if (loading) return <LoadingRow />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ModuleCard icon={Gauge} title="当前模式" subtitle="ColorOS 性能调度" delay={0}>
        <div className="rounded-xl glass-tile p-4 text-center">
          <div className="text-2xl font-bold text-titanium-300">
            {data?.currentMode || "未知"}
          </div>
          <div className="mt-1 text-[11px] text-argent-500">点击下方切换模式</div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {modeBtns.map((b) => {
            const Icon = b.icon;
            const active = data?.currentMode.includes(b.label);
            return (
              <GlassButton
                key={b.mode}
                variant={active ? "primary" : "secondary"}
                size="sm"
                onClick={() => setMode(b.mode)}
                disabled={busy}
              >
                <Icon className="h-3.5 w-3.5" />
                {b.label}
              </GlassButton>
            );
          })}
        </div>
        {msg && <p className="text-center text-xs text-titanium-300">{msg}</p>}
      </ModuleCard>

      <ModuleCard icon={Cpu} title="CPU 频率" subtitle="天玑 9400 · 8 核" delay={0.05}>
        <div className="flex flex-col gap-1.5">
          {data?.cpuFreq.length ? (
            data.cpuFreq.map((f) => (
              <div
                key={f}
                className="flex items-center justify-between rounded-lg glass-tile px-3 py-1.5"
              >
                <span className="font-mono text-xs text-argent-400">
                  {f.split(":")[0]}
                </span>
                <span className="font-mono text-xs text-titanium-300">
                  {f.split(":")[1]?.trim()}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-argent-500">未读取到 CPU 频率（可能需要 root）</p>
          )}
          <InfoRow label="GPU 频率" value={data?.gpuFreq || "—"} accent />
        </div>
      </ModuleCard>

      <ModuleCard icon={Sparkles} title="温度传感器" subtitle="Top 8 热区" delay={0.1}>
        <div className="flex flex-col gap-1.5">
          {data?.thermal.length ? (
            data.thermal.map((t) => (
              <div
                key={t.zone}
                className="flex items-center justify-between rounded-lg glass-tile px-3 py-1.5"
              >
                <span className="truncate font-mono text-[11px] text-argent-400">
                  {t.typeName || t.zone}
                </span>
                <span
                  className={`font-mono text-xs ${
                    t.temp > 60 ? "text-crimson-400" : "text-titanium-300"
                  }`}
                >
                  {t.temp.toFixed(1)}°C
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-argent-500">未读取到温度数据</p>
          )}
        </div>
        <GlassButton variant="secondary" size="sm" onClick={load} disabled={busy}>
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </GlassButton>
      </ModuleCard>
    </div>
  );
}

// ---------- 3. 哈苏影像面板 ----------

function CameraPanel() {
  const [result, setResult] = useState<CameraBackupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState("");

  const scan = useCallback(async () => {
    setLoading(true);
    const r = await oppoCameraBackup("scan");
    setResult(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    scan();
  }, [scan]);

  const run = async (action: "backup_settings" | "clean_raw" | "enable_hasselblad") => {
    if (action === "clean_raw" && !window.confirm("确认清理所有 RAW (.dng) 文件？此操作不可恢复。")) return;
    setBusy(true);
    setBusyAction(action);
    const r = await oppoCameraBackup(action);
    if (r) {
      setResult(r);
    }
    setBusy(false);
    setBusyAction("");
  };

  if (loading) return <LoadingRow />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ModuleCard icon={Camera} title="相机目录扫描" subtitle="DCIM/Camera 文件统计" delay={0}>
        <div className="rounded-xl glass-tile p-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold text-titanium-300">
                {result?.backedUp ?? 0}
              </div>
              <div className="text-[11px] text-argent-500">照片/视频</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-titanium-300">
                {result?.rawCount ?? 0}
              </div>
              <div className="text-[11px] text-argent-500">RAW 文件</div>
            </div>
          </div>
        </div>
        <p className="text-xs text-argent-300">{result?.message}</p>
        <GlassButton variant="secondary" size="sm" onClick={scan}>
          <RefreshCw className="h-3.5 w-3.5" />
          重新扫描
        </GlassButton>
      </ModuleCard>

      <ModuleCard icon={Sparkles} title="哈苏专业模式" subtitle="RAW 拍摄 · 设置备份" delay={0.05}>
        <div className="flex flex-col gap-2">
          <GlassButton
            variant="primary"
            size="md"
            onClick={() => run("enable_hasselblad")}
            disabled={busy}
          >
            {busy && busyAction === "enable_hasselblad" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            启用哈苏专业模式
          </GlassButton>
          <GlassButton
            variant="secondary"
            size="md"
            onClick={() => run("backup_settings")}
            disabled={busy}
          >
            {busy && busyAction === "backup_settings" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            备份相机设置
          </GlassButton>
          <GlassButton
            variant="danger"
            size="md"
            onClick={() => run("clean_raw")}
            disabled={busy}
          >
            {busy && busyAction === "clean_raw" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            清理 RAW 文件
          </GlassButton>
        </div>
      </ModuleCard>
    </div>
  );
}

// ---------- 4. 快充电池面板 ----------

function BatteryPanel() {
  const [data, setData] = useState<BatteryHealthResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await oppoBatteryHealth();
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingRow />;
  if (!data) return <GlassCard className="p-6 text-center text-sm text-argent-300">读取失败</GlassCard>;

  const healthLabel =
    data.health === "good"
      ? "良好"
      : data.health === "overheat"
      ? "过热"
      : data.health === "dead"
      ? "损坏"
      : data.health;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ModuleCard icon={BatteryCharging} title="电池状态" subtitle={data.message} delay={0}>
        <div className="rounded-xl glass-tile p-5 text-center">
          <div className="text-4xl font-bold text-titanium-300">{data.level}%</div>
          <div className="mt-1 text-[11px] text-argent-500">当前电量</div>
          {data.fastChargeEnabled && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-titanium-500/20 px-2.5 py-1 text-[11px] text-titanium-200">
              <Zap className="h-3 w-3" />
              SUPERVOOC 100W 快充中
            </div>
          )}
        </div>
        <div className="flex flex-col divide-y divide-white/5">
          <InfoRow label="状态" value={data.status} />
          <InfoRow label="健康度" value={healthLabel} accent />
          <InfoRow label="温度" value={`${data.temperature.toFixed(1)}°C`} />
          <InfoRow label="电压" value={`${data.voltage.toFixed(2)} V`} />
          <InfoRow label="电池技术" value={data.technology} />
        </div>
      </ModuleCard>

      <ModuleCard icon={Gauge} title="电池健康" subtitle="设计容量 · 循环次数" delay={0.05}>
        <div className="flex flex-col divide-y divide-white/5">
          <InfoRow label="设计容量" value={data.designCapacity} accent />
          <InfoRow label="充电计数器" value={data.chargeCounter} />
          <InfoRow label="循环次数" value={data.cycleCount} />
          <InfoRow
            label="智能充电保护"
            value={data.smartChargeEnabled ? "已开启" : "未开启"}
            accent={data.smartChargeEnabled}
          />
          <InfoRow
            label="SUPERVOOC 快充"
            value={data.fastChargeEnabled ? "已激活" : "未激活"}
            accent={data.fastChargeEnabled}
          />
        </div>
        <GlassButton variant="secondary" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
          刷新电池
        </GlassButton>
      </ModuleCard>
    </div>
  );
}

// ---------- 5. ColorOS 优化面板 ----------

function ColorOSPanel() {
  const [result, setResult] = useState<ColorOSCleanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState("");

  const scan = useCallback(async () => {
    setLoading(true);
    const r = await oppoColorosClean("scan_cache");
    setResult(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    scan();
  }, [scan]);

  const cleanCache = async () => {
    if (!window.confirm("确认清理所有 ColorOS 应用缓存？")) return;
    setBusy(true);
    setBusyAction("clean");
    const r = await oppoColorosClean("clean_cache");
    if (r) setResult(r);
    setBusy(false);
    setBusyAction("");
  };

  const toggleBloatware = async (pkg: string, enable: boolean) => {
    setBusy(true);
    setBusyAction(pkg);
    const r = enable
      ? await oppoColorosClean("enable_bloatware", [pkg])
      : await oppoColorosClean("disable_bloatware", [pkg]);
    if (r) setResult(r);
    setBusy(false);
    setBusyAction("");
  };

  if (loading) return <LoadingRow />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ModuleCard icon={Sparkles} title="缓存扫描" subtitle="ColorOS 应用缓存目录" delay={0}>
        {result?.details.length ? (
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {result.details.map((d) => (
              <div
                key={d}
                className="flex items-center justify-between rounded-lg glass-tile px-3 py-1.5"
              >
                <span className="truncate font-mono text-[11px] text-argent-400">{d}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-argent-500">无缓存数据</p>
        )}
        <div className="flex items-center justify-between rounded-xl glass-tile px-3 py-2">
          <span className="text-xs text-argent-300">预计可释放</span>
          <span className="font-mono text-sm text-titanium-300">
            {result?.freedMb ?? 0} MB
          </span>
        </div>
        <div className="flex gap-2">
          <GlassButton variant="secondary" size="sm" onClick={scan}>
            <RefreshCw className="h-3.5 w-3.5" />
            重新扫描
          </GlassButton>
          <GlassButton variant="danger" size="sm" onClick={cleanCache} disabled={busy}>
            {busy && busyAction === "clean" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            清理缓存
          </GlassButton>
        </div>
      </ModuleCard>

      <ModuleCard icon={Settings2} title="预装应用管理" subtitle="禁用/恢复 OPPO 预装" delay={0.05}>
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {OPPO_BLOATWARE.map((b) => {
            const isBusy = busyAction === b.pkg;
            return (
              <div
                key={b.pkg}
                className="flex items-center justify-between rounded-lg glass-tile px-3 py-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xs text-argent-100">{b.name}</span>
                  <span className="truncate font-mono text-[10px] text-argent-500">
                    {b.pkg}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <GlassButton
                    variant="danger"
                    size="sm"
                    onClick={() => toggleBloatware(b.pkg, false)}
                    disabled={busy}
                  >
                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : "禁用"}
                  </GlassButton>
                  <GlassButton
                    variant="secondary"
                    size="sm"
                    onClick={() => toggleBloatware(b.pkg, true)}
                    disabled={busy}
                  >
                    恢复
                  </GlassButton>
                </div>
              </div>
            );
          })}
        </div>
        {result?.message && (
          <p className="text-xs text-titanium-300">{result.message}</p>
        )}
      </ModuleCard>
    </div>
  );
}

// ---------- 6. 120Hz 屏幕面板 ----------

function ScreenPanel() {
  const [data, setData] = useState<ScreenControlResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [brightness, setBrightness] = useState(128);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await oppoScreenControl("status");
    setData(d);
    if (d) setBrightness(d.brightness);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const exec = async (
    action: "set_refresh" | "toggle_eye_care" | "toggle_dark" | "set_brightness",
    value: string
  ) => {
    setBusy(true);
    const r = await oppoScreenControl(action, value);
    if (r) {
      setData((prev) => ({ ...prev, ...r, refreshRate: r.refreshRate || prev?.refreshRate || "" }));
    }
    setBusy(false);
  };

  if (loading) return <LoadingRow />;
  if (!data) return <GlassCard className="p-6 text-center text-sm text-argent-300">读取失败</GlassCard>;

  const refreshBtns = [
    { label: "自适应", value: "auto", icon: Gauge },
    { label: "60Hz", value: "60", icon: Sun },
    { label: "120Hz", value: "120", icon: Zap },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ModuleCard icon={MonitorSmartphone} title="屏幕状态" subtitle="刷新率 · 亮度 · 模式" delay={0}>
        <div className="rounded-xl glass-tile p-4 text-center">
          <div className="text-xl font-bold text-titanium-300">{data.refreshRate}</div>
          <div className="mt-1 text-[11px] text-argent-500">当前刷新率</div>
        </div>
        <div className="flex flex-col divide-y divide-white/5">
          <InfoRow label="亮度" value={`${Math.round((brightness / 255) * 100)}%`} accent />
          <InfoRow label="护眼模式" value={data.eyeCare ? "已开启" : "已关闭"} />
          <InfoRow label="暗色模式" value={data.darkMode ? "已开启" : "已关闭"} />
          <InfoRow label="色彩模式" value={data.colorMode} />
        </div>
      </ModuleCard>

      <ModuleCard icon={Gauge} title="刷新率切换" subtitle="120Hz LTPO 屏幕" delay={0.05}>
        <div className="grid grid-cols-3 gap-2">
          {refreshBtns.map((b) => {
            const Icon = b.icon;
            const active = data.refreshRate.includes(b.label);
            return (
              <GlassButton
                key={b.value}
                variant={active ? "primary" : "secondary"}
                size="sm"
                onClick={() => exec("set_refresh", b.value)}
                disabled={busy}
              >
                <Icon className="h-3.5 w-3.5" />
                {b.label}
              </GlassButton>
            );
          })}
        </div>
      </ModuleCard>

      <ModuleCard icon={Eye} title="护眼与暗色" subtitle="一键切换" delay={0.1}>
        <div className="grid grid-cols-2 gap-2">
          <GlassButton
            variant={data.eyeCare ? "primary" : "secondary"}
            size="md"
            onClick={() => exec("toggle_eye_care", data.eyeCare ? "0" : "1")}
            disabled={busy}
          >
            <Eye className="h-4 w-4" />
            {data.eyeCare ? "关闭护眼" : "开启护眼"}
          </GlassButton>
          <GlassButton
            variant={data.darkMode ? "primary" : "secondary"}
            size="md"
            onClick={() => exec("toggle_dark", data.darkMode ? "0" : "1")}
            disabled={busy}
          >
            {data.darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {data.darkMode ? "日间模式" : "夜间模式"}
          </GlassButton>
        </div>
      </ModuleCard>

      <ModuleCard icon={Sun} title="亮度调节" subtitle="0 - 255" delay={0.15}>
        <div className="flex flex-col gap-3">
          <input
            type="range"
            min={0}
            max={255}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            onMouseUp={() => exec("set_brightness", String(brightness))}
            onTouchEnd={() => exec("set_brightness", String(brightness))}
            className="w-full accent-titanium-500"
          />
          <div className="flex items-center justify-between text-xs text-argent-400">
            <span>最暗</span>
            <span className="font-mono text-titanium-300">
              {Math.round((brightness / 255) * 100)}%
            </span>
            <span>最亮</span>
          </div>
        </div>
        <GlassButton variant="secondary" size="sm" onClick={load} disabled={busy}>
          <RefreshCw className="h-3.5 w-3.5" />
          刷新状态
        </GlassButton>
      </ModuleCard>
    </div>
  );
}
