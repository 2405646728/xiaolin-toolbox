// 系统状态概览：三张玻璃卡片 CPU / 内存 / 存储，含圆环进度与趋势（真实采集数据）
import { motion } from "framer-motion";
import { Cpu, MemoryStick, HardDrive, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { useSystemStore } from "@/store/useSystemStore";
import { cn } from "@/lib/utils";

function Ring({ percent, color }: { percent: number; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="4"
      />
      <motion.circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </svg>
  );
}

export function StatusOverview() {
  const info = useSystemStore((s) => s.info);
  const loading = useSystemStore((s) => s.loading);
  const cpuHistory = useSystemStore((s) => s.history.cpu);
  const memHistory = useSystemStore((s) => s.history.memory);

  const cpuUsage = info?.cpu.usage ?? 0;
  const memPercent = info?.memory.percent ?? 0;
  const storagePercent = info?.storage.percent ?? 0;

  const prevCpu = cpuHistory[cpuHistory.length - 6] ?? cpuUsage;
  const prevMem = memHistory[memHistory.length - 6] ?? memPercent;

  const metrics = [
    {
      key: "cpu",
      label: "CPU 占用",
      icon: Cpu,
      percent: Math.round(cpuUsage),
      value: `${Math.round(cpuUsage)}%`,
      sub: info
        ? `${info.cpu.cores} 核${info.cpu.temp > 0 ? ` · ${info.cpu.temp}°C` : ""}`
        : "读取中",
      prev: prevCpu,
    },
    {
      key: "mem",
      label: "内存占用",
      icon: MemoryStick,
      percent: Math.round(memPercent),
      value: `${Math.round(memPercent)}%`,
      sub: info ? `${info.memory.used} / ${info.memory.total} GB` : "读取中",
      prev: prevMem,
    },
    {
      key: "storage",
      label: "存储占用",
      icon: HardDrive,
      percent: Math.round(storagePercent),
      value: `${Math.round(storagePercent)}%`,
      sub: info ? `${info.storage.used} / ${info.storage.total} GB` : "读取中",
      prev: storagePercent,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      {metrics.map((m, i) => {
        const up = m.percent >= m.prev;
        const TrendIcon = up ? TrendingUp : TrendingDown;
        const ringColor =
          m.percent > 80 ? "#DC2626" : m.percent > 60 ? "#FF6E40" : "#94A3B8";
        return (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <GlassCard hover className="glass-shine flex items-center gap-4 p-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full glass-tile glass-tile-edge">
                {loading && !info ? (
                  <Loader2 className="h-6 w-6 animate-spin text-argent-400" />
                ) : (
                  <>
                    <Ring percent={m.percent} color={ringColor} />
                    <m.icon className="absolute h-5 w-5 text-white" />
                  </>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs text-argent-400">{m.label}</span>
                <span className="font-mono text-2xl font-semibold text-white">
                  {m.value}
                </span>
                <div className="flex items-center gap-1.5">
                  <TrendIcon
                    className={cn(
                      "h-3 w-3",
                      up ? "text-titanium-500" : "text-argent-400"
                    )}
                  />
                  <span className="text-[11px] text-argent-500">{m.sub}</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        );
      })}
    </div>
  );
}
