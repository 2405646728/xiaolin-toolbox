// 设置页：主题、玻璃强度、专家模式、设备模式手动切换、关于
import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Settings as SettingsIcon, Monitor, Smartphone, Info } from "lucide-react";
import { useDeviceStore } from "@/store/useDeviceStore";
import { GlassCard } from "@/components/glass/GlassCard";
import { LiquidButton } from "@/components/liquid/LiquidButton";
import { cn } from "@/lib/utils";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-11 rounded-full glass-tile glass-tile-edge transition-colors",
        on && "glass-tile-strong"
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full shadow-glow",
          on ? "right-0.5 bg-titanium-500" : "left-0.5 bg-argent-300"
        )}
      />
    </button>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { mode, setMode, autoDetect, manualOverride } = useDeviceStore();
  const [expert, setExpert] = useState(false);
  const [glassStrength, setGlassStrength] = useState(60);

  const groups = [
    {
      title: "设备模式",
      desc: "手动切换设备类型，覆盖自动识别",
      items: [
        {
          type: "mode" as const,
          label: "当前设备",
          value: mode,
        },
      ],
    },
    {
      title: "个性化",
      desc: "主题、玻璃强度、专家模式",
      items: [
        { type: "toggle" as const, label: "专家模式", desc: "解锁高风险项与命令行工具", value: expert, onChange: setExpert },
        { type: "slider" as const, label: "玻璃强度", value: glassStrength, onChange: setGlassStrength },
      ],
    },
  ];

  return (
    <div className="relative flex h-full flex-col gap-3 overflow-hidden sm:gap-4">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex shrink-0 items-center gap-3"
      >
        <LiquidButton size="sm" variant="ghost" onClick={() => navigate("/")} className="px-2.5">
          <ArrowLeft className="h-4 w-4" />
        </LiquidButton>
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl glass-tile-strong glass-tile-edge glass-shine text-titanium-500">
          <SettingsIcon className="relative z-10 h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-base font-semibold text-white">设置</h1>
          <span className="text-[11px] text-argent-400">个性化 · 设备模式</span>
        </div>
      </motion.header>

      <main className="relative flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <div className="flex flex-col gap-4">
          {groups.map((g, gi) => (
            <motion.div
              key={g.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: gi * 0.08 }}
            >
              <GlassCard hover className="glass-shine flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-sm font-medium text-white">{g.title}</h2>
                  <p className="text-[11px] text-argent-500">{g.desc}</p>
                </div>
                <div className="flex flex-col gap-3">
                  {g.items.map((item) => {
                    if (item.type === "toggle") {
                      return (
                        <div key={item.label} className="flex items-center justify-between gap-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm text-argent-100">{item.label}</span>
                            <span className="text-[11px] text-argent-500">{item.desc}</span>
                          </div>
                          <Toggle on={item.value} onChange={item.onChange} />
                        </div>
                      );
                    }
                    if (item.type === "slider") {
                      return (
                        <div key={item.label} className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-argent-100">{item.label}</span>
                            <span className="font-mono text-xs text-titanium-400">
                              {item.value}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={20}
                            max={100}
                            value={item.value}
                            onChange={(e) => item.onChange(Number(e.target.value))}
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-full glass-track accent-titanium-500"
                          />
                        </div>
                      );
                    }
                    if (item.type === "mode") {
                      return (
                        <div key={item.label} className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-argent-100">{item.label}</span>
                            {manualOverride && (
                              <button
                                onClick={autoDetect}
                                className="text-[11px] text-titanium-400 hover:underline"
                              >
                                恢复自动识别
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              { v: "desktop", label: "电脑", icon: Monitor },
                              { v: "mobile", label: "手机", icon: Smartphone },
                            ] as const).map((opt) => (
                              <button
                                key={opt.v}
                                onClick={() => setMode(opt.v)}
                                onMouseMove={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
                                  e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
                                }}
                                className={cn(
                                  "relative flex items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 text-sm transition-colors",
                                  mode === opt.v
                                    ? "glass-tile-strong glass-tile-edge glass-shine text-white"
                                    : "glass-tile glass-tile-edge glass-tile-hover text-argent-300 hover:text-white"
                                )}
                              >
                                <opt.icon className="relative z-10 h-4 w-4" />
                                <span className="relative z-10">{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </GlassCard>
            </motion.div>
          ))}

          {/* 关于 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.24 }}
          >
            <GlassCard hover className="glass-shine flex items-center gap-4 p-4">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl glass-tile-strong glass-tile-edge shadow-glow">
                <Info className="relative z-10 h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-white">小林的工具箱 v1.0.0</span>
                <span className="text-[11px] text-argent-500">
                  React + Tauri 2.0 · iOS 26 液态玻璃设计
                </span>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
