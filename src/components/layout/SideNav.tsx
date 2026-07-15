// 侧边导航栏：桌面模式左侧固定竖向导航，移动模式隐藏（移动端用顶部栏）
// iOS 26 液态玻璃：品牌胶囊、AI 助手强调入口、导航项、硬件摘要卡
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Activity,
  Settings as SettingsIcon,
  Cpu,
  Sparkles,
  Smartphone,
} from "lucide-react";
import { useDeviceStore } from "@/store/useDeviceStore";
import { useHardwareStore } from "@/store/useHardwareStore";
import { GlassCard } from "@/components/glass/GlassCard";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "首页", icon: LayoutDashboard, end: true },
  { to: "/monitor", label: "监控中心", icon: Activity, end: false },
  { to: "/settings", label: "设置", icon: SettingsIcon, end: false },
];

export function SideNav() {
  const { mode, label } = useDeviceStore();
  const hw = useHardwareStore((s) => s.info);
  const location = useLocation();
  const aiActive = location.pathname.startsWith("/cmd-ai");
  const oppoActive = location.pathname.startsWith("/oppo");

  return (
    <aside className="hidden h-full w-56 shrink-0 flex-col gap-3 lg:flex xl:w-64">
      {/* 品牌 + 设备识别（玻璃胶囊 + 动态光泽） */}
      <GlassCard className="glass-shine flex items-center gap-3 p-4">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl glass-tile-strong glass-tile-edge text-titanium-500">
          <Cpu className="h-5 w-5" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="font-display text-sm font-bold tracking-wide text-white">
            小林的工具箱
          </span>
          <span className="truncate text-[10px] text-argent-500">{label}</span>
        </div>
      </GlassCard>

      {/* AI 助手强调入口（钛金橙玻璃 + 流光 + 呼吸光晕） */}
      <NavLink to="/cmd-ai">
        <motion.div
          whileHover={{ y: -2, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
            e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
          }}
          className={cn(
            "relative flex items-center gap-3 overflow-hidden rounded-2xl p-3 transition-all",
            aiActive
              ? "bg-gradient-to-br from-titanium-500/40 to-titanium-700/30 glass-tile-edge glass-shine shadow-glow"
              : "bg-gradient-to-br from-titanium-500/25 to-titanium-700/15 glass-tile-edge glass-tile-hover"
          )}
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-titanium-500/30 shadow-glow">
            <span className="absolute inset-0 rounded-xl bg-titanium-500/30 blur-md animate-pulse-slow" />
            <Sparkles className="relative z-10 h-5 w-5 text-titanium-300" />
          </div>
          <div className="relative z-10 flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-white">小林 AI 助手</span>
            <span className="text-[10px] text-titanium-200/80">智能命令 · 60+ 功能</span>
          </div>
          {!aiActive && (
            <span className="relative z-10 ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-titanium-400 shadow-glow" />
          )}
        </motion.div>
      </NavLink>

      {/* OPPO Find X8s 专属入口（翡翠绿玻璃 + 呼吸光晕） */}
      <NavLink to="/oppo">
        <motion.div
          whileHover={{ y: -2, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
            e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
          }}
          className={cn(
            "relative flex items-center gap-3 overflow-hidden rounded-2xl p-3 transition-all",
            oppoActive
              ? "bg-gradient-to-br from-emerald-500/40 to-emerald-700/30 glass-tile-edge glass-shine shadow-glow"
              : "bg-gradient-to-br from-emerald-500/25 to-emerald-700/15 glass-tile-edge glass-tile-hover"
          )}
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/30">
            <span className="absolute inset-0 rounded-xl bg-emerald-500/30 blur-md animate-pulse-slow" />
            <Smartphone className="relative z-10 h-5 w-5 text-emerald-300" />
          </div>
          <div className="relative z-10 flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-white">Find X8s 工作室</span>
            <span className="text-[10px] text-emerald-200/80">ADB 桥接 · 专属定制</span>
          </div>
          {!oppoActive && (
            <span className="relative z-10 ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          )}
        </motion.div>
      </NavLink>

      {/* 导航项：玻璃胶囊 */}
      <nav className="flex flex-col gap-1.5">
        {navItems.map((item) => {
          const active = item.end
            ? location.pathname === "/"
            : location.pathname.startsWith(item.to);
          return (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <motion.div
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.98 }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty(
                    "--mx",
                    `${e.clientX - rect.left}px`
                  );
                  e.currentTarget.style.setProperty(
                    "--my",
                    `${e.clientY - rect.top}px`
                  );
                }}
                className={cn(
                  "relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-2.5 text-sm transition-colors",
                  active
                    ? "glass-tile-strong glass-tile-edge glass-shine text-white"
                    : "glass-tile glass-tile-edge glass-tile-hover text-argent-300 hover:text-white"
                )}
              >
                <item.icon
                  className={cn(
                    "relative z-10 h-4 w-4",
                    active ? "text-titanium-500" : "text-argent-400"
                  )}
                />
                <span className="relative z-10">{item.label}</span>
                {active && (
                  <span className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-titanium-500 shadow-glow" />
                )}
              </motion.div>
            </NavLink>
          );
        })}
      </nav>

      {/* 硬件摘要（底部玻璃卡 + 动态光泽） */}
      {hw && (
        <GlassCard className="glass-shine mt-auto flex flex-col gap-2 p-3">
          <span className="text-[10px] uppercase tracking-wider text-argent-500">
            硬件摘要
          </span>
          <div className="flex flex-col gap-1 text-[11px]">
            <Row label="系统" value={`${hw.platform} ${hw.osVersion}`} />
            <Row label="CPU 核心" value={`${hw.cpu.logicalCores} 核`} />
            <Row label="内存" value={`${hw.memory.total} GB`} />
            {hw.disks[0] && (
              <Row label="主盘" value={`${hw.disks[0].capacity} GB`} />
            )}
          </div>
        </GlassCard>
      )}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-argent-500">{label}</span>
      <span className="truncate font-mono text-argent-200">{value}</span>
    </div>
  );
}
