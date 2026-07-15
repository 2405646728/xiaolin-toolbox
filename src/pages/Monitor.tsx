// 监控中心：CPU/内存/网络实时折线图 + Top 进程列表
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, Cpu, MemoryStick, Wifi } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis } from "recharts";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { useSystemStore } from "@/store/useSystemStore";
import { GlassCard } from "@/components/glass/GlassCard";
import { LiquidButton } from "@/components/liquid/LiquidButton";

function toData(arr: number[]) {
  return arr.map((v, i) => ({ t: i, v: +v.toFixed(1) }));
}

export default function Monitor() {
  useSystemStatus();
  const navigate = useNavigate();
  const info = useSystemStore((s) => s.info);
  const history = useSystemStore((s) => s.history);

  const cpuUsage = info?.cpu.usage ?? 0;
  const memPercent = info?.memory.percent ?? 0;
  const netDown = info?.network.download ?? 0;

  const charts = [
    {
      title: "CPU 使用率",
      icon: Cpu,
      color: "#FF6E40",
      data: toData(history.cpu),
      value: `${Math.round(cpuUsage)}%`,
      sub: info
        ? `${info.cpu.temp > 0 ? `${info.cpu.temp}°C · ` : ""}${info.cpu.cores} 核`
        : "读取中",
    },
    {
      title: "内存占用",
      icon: MemoryStick,
      color: "#94A3B8",
      data: toData(history.memory),
      value: `${Math.round(memPercent)}%`,
      sub: info ? `${info.memory.used} / ${info.memory.total} GB` : "读取中",
    },
    {
      title: "网络下行",
      icon: Wifi,
      color: "#FF845A",
      data: toData(history.network),
      value: `${netDown.toFixed(1)} MB/s`,
      sub: info ? `延迟 ${info.network.ping}ms` : "读取中",
    },
  ];

  return (
    <div className="relative flex h-full flex-col gap-3 overflow-hidden sm:gap-4">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex shrink-0 items-center gap-3 px-1"
      >
        <LiquidButton size="sm" variant="ghost" onClick={() => navigate("/")} className="px-2.5">
          <ArrowLeft className="h-4 w-4" />
        </LiquidButton>
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl glass-tile-strong glass-tile-edge glass-shine text-titanium-500">
          <Activity className="relative z-10 h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-base font-semibold text-white">监控中心</h1>
          <span className="text-[11px] text-argent-400">实时性能 · 1 秒刷新</span>
        </div>
      </motion.header>

      <main className="relative flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <div className="flex flex-col gap-4">
          {/* 实时图表 */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
            {charts.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <GlassCard hover className="glass-shine flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <c.icon className="h-4 w-4" style={{ color: c.color }} />
                      <span className="text-xs text-argent-300">{c.title}</span>
                    </div>
                    <span className="font-mono text-lg font-semibold text-white">
                      {c.value}
                    </span>
                  </div>
                  <div className="h-24 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={c.data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                        <XAxis dataKey="t" hide />
                        <YAxis hide domain={["dataMin", "dataMax"]} />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(20,23,28,0.9)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 8,
                            fontSize: 11,
                            color: "#F5F7FA",
                          }}
                          labelStyle={{ display: "none" }}
                          formatter={(v: number) => [`${v}`, c.title]}
                        />
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke={c.color}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <span className="text-[11px] text-argent-500">{c.sub}</span>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          {/* 进程列表 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.24 }}
          >
            <GlassCard hover className="glass-shine flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-white">进程占用 Top 8</h2>
                <span className="text-[11px] text-argent-500">
                  {info?.processes ? "真实进程 · 按 CPU 排序" : "需 Tauri 环境读取真实进程"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-12 gap-2 rounded-lg glass-tile glass-tile-edge px-2 py-2 text-[10px] text-argent-400">
                  <span className="col-span-6">进程</span>
                  <span className="col-span-3 text-right">CPU</span>
                  <span className="col-span-3 text-right">内存</span>
                </div>
                {(info?.processes ?? []).map((p, idx) => (
                  <div
                    key={`${p.name}-${idx}`}
                    className="glass-row grid grid-cols-12 items-center gap-2 rounded-lg px-2 py-2 text-xs"
                  >
                    <span className="col-span-6 truncate font-mono text-argent-100">
                      {p.name}
                    </span>
                    <span className="col-span-3 text-right font-mono text-titanium-400">
                      {p.cpu.toFixed(1)}%
                    </span>
                    <span className="col-span-3 text-right font-mono text-argent-300">
                      {Math.round(p.mem)} MB
                    </span>
                  </div>
                ))}
                {!info?.processes?.length && (
                  <div className="px-2 py-6 text-center text-[11px] text-argent-500">
                    运行于 Tauri 环境时将显示真实系统进程列表
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
