// 硬件信息卡片：展示设备硬件各种详细信息（CPU/显卡/内存/主板/磁盘/电池/网络/屏幕/系统）
import { motion } from "framer-motion";
import {
  Cpu,
  Monitor as GpuIcon,
  MemoryStick,
  HardDrive,
  BatteryCharging,
  Wifi,
  Monitor,
  Server,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { LiquidButton } from "@/components/liquid/LiquidButton";
import { useHardwareInfo } from "@/hooks/useHardwareInfo";
import type { HardwareInfo } from "@/lib/systemInfo";

interface InfoRow {
  label: string;
  value: string;
}

function Section({
  icon: Icon,
  title,
  rows,
  delay,
}: {
  icon: typeof Cpu;
  title: string;
  rows: InfoRow[];
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <GlassCard hover className="glass-shine flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg glass-tile-strong glass-tile-edge text-titanium-500">
            <Icon className="relative z-10 h-4 w-4" />
          </div>
          <h3 className="text-sm font-medium text-white">{title}</h3>
        </div>
        <div className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <div key={r.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-argent-500">{r.label}</span>
                <span className="truncate text-right font-mono text-[11px] text-argent-100">
                  {r.value || "—"}
                </span>
              </div>
              {i < rows.length - 1 && <hr className="glass-divider opacity-60" />}
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}

function buildRows(hw: HardwareInfo) {
  return {
    system: [
      { label: "主机名", value: hw.hostname },
      { label: "操作系统", value: `${hw.platform} ${hw.osVersion}`.trim() },
      { label: "架构", value: hw.arch },
      { label: "数据来源", value: hw.source === "tauri" ? "Tauri 真实采集" : "浏览器 API" },
    ] as InfoRow[],
    cpu: [
      { label: "型号", value: hw.cpu.brand },
      { label: "物理核心", value: `${hw.cpu.cores} 核` },
      { label: "逻辑核心", value: `${hw.cpu.logicalCores} 线程` },
      {
        label: "主频",
        value: hw.cpu.frequency > 0 ? `${(hw.cpu.frequency / 1000).toFixed(2)} GHz` : "—",
      },
    ] as InfoRow[],
    gpu: [
      { label: "显卡", value: hw.gpu.name },
      { label: "厂商", value: hw.gpu.vendor },
    ] as InfoRow[],
    memory: [
      { label: "总容量", value: `${hw.memory.total} GB` },
      { label: "类型", value: hw.memory.type },
    ] as InfoRow[],
    motherboard: [
      { label: "厂商", value: hw.motherboard.manufacturer },
      { label: "型号", value: hw.motherboard.product },
    ] as InfoRow[],
    disks:
      hw.disks.length > 0
        ? hw.disks.flatMap((d) => [
            { label: `${d.name} 类型`, value: d.type || "—" },
            { label: `${d.name} 容量`, value: `${d.capacity} GB` },
          ])
        : [{ label: "磁盘", value: "需 Tauri 环境读取详情" }],
    battery: [
      { label: "厂商", value: hw.battery.vendor },
      { label: "型号", value: hw.battery.model },
      { label: "循环次数", value: hw.battery.cycles > 0 ? `${hw.battery.cycles} 次` : "—" },
      {
        label: "健康度",
        value: hw.battery.health > 0 ? `${hw.battery.health}%` : "—",
      },
    ] as InfoRow[],
    network:
      hw.network.length > 0
        ? hw.network.flatMap((n) => [
            { label: `${n.iface} IP`, value: n.ip },
            { label: `${n.iface} MAC`, value: n.mac },
          ])
        : [{ label: "网络接口", value: "需 Tauri 环境读取详情" }],
    screen: [
      { label: "分辨率", value: `${hw.screen.width} × ${hw.screen.height}` },
      { label: "宽高比", value: hw.screen.aspectRatio },
      { label: "像素比", value: `${hw.screen.dpr}x` },
      { label: "色深", value: `${hw.screen.colorDepth} 位` },
    ] as InfoRow[],
    browser: hw.browser
      ? ([
          { label: "浏览器", value: `${hw.browser.name} ${hw.browser.version}`.trim() },
          { label: "语言", value: hw.browser.language },
          { label: "在线状态", value: hw.browser.online ? "在线" : "离线" },
        ] as InfoRow[])
      : null,
  };
}

export function HardwareInfo() {
  const { info, loading, refresh } = useHardwareInfo();

  if (loading && !info) {
    return (
      <GlassCard className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-titanium-500" />
      </GlassCard>
    );
  }

  if (!info) return null;

  const rows = buildRows(info);
  const sections = [
    { icon: Server, title: "系统信息", rows: rows.system, delay: 0 },
    { icon: Cpu, title: "处理器", rows: rows.cpu, delay: 0.05 },
    { icon: GpuIcon, title: "显卡", rows: rows.gpu, delay: 0.1 },
    { icon: MemoryStick, title: "内存", rows: rows.memory, delay: 0.15 },
    { icon: Server, title: "主板", rows: rows.motherboard, delay: 0.2 },
    { icon: HardDrive, title: "磁盘", rows: rows.disks, delay: 0.25 },
    { icon: BatteryCharging, title: "电池", rows: rows.battery, delay: 0.3 },
    { icon: Wifi, title: "网络", rows: rows.network, delay: 0.35 },
    { icon: Monitor, title: "屏幕", rows: rows.screen, delay: 0.4 },
    ...(rows.browser ? [{ icon: Monitor, title: "浏览器", rows: rows.browser, delay: 0.45 }] : []),
  ];

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-white">设备硬件信息</h2>
          <span className="text-[11px] text-argent-500">
            {info.source === "tauri"
              ? "通过 Tauri 真实读取系统硬件"
              : "浏览器环境（部分项需 Tauri 才能读取）"}
            {info.collectedAt
              ? ` · 更新于 ${new Date(info.collectedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </span>
        </div>
        <LiquidButton
          size="sm"
          variant="secondary"
          onClick={refresh}
          disabled={loading}
          className="px-3"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          刷新
        </LiquidButton>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {sections.map((s) => (
          <Section key={s.title} {...s} />
        ))}
      </div>
    </motion.section>
  );
}
