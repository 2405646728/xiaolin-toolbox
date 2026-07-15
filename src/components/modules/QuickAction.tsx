// 快捷操作区：一键加速主按钮 + 最近使用模块快捷胶囊
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Zap, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { LiquidButton } from "@/components/liquid/LiquidButton";
import { useModuleStore } from "@/store/useModuleStore";
import { allModules } from "@/data/modules";

export function QuickAction() {
  const navigate = useNavigate();
  const recentIds = useModuleStore((s) => s.recentUsed);
  const pushRecent = useModuleStore((s) => s.pushRecent);

  const recent = recentIds
    .map((id) => allModules.find((m) => m.id === id))
    .filter(Boolean)
    .slice(0, 3);

  const handleBoost = () => {
    pushRecent("boost");
    navigate("/optimize/boost");
  };

  return (
    <GlassCard hover className="glass-shine flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-center gap-4">
        <motion.button
          type="button"
          onClick={handleBoost}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full glass-tile-strong glass-tile-edge glass-shine shadow-glow"
          aria-label="一键加速"
        >
          <span className="absolute inset-0 rounded-full bg-titanium-500/40 blur-md animate-pulse-slow" />
          <Zap className="relative z-10 h-8 w-8 text-white" />
        </motion.button>
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold text-white">一键加速</span>
          <span className="text-xs text-argent-400">
            释放内存 · 清理后台 · 优化启动
          </span>
          <span className="font-mono text-[11px] text-titanium-400">
            预计可释放 1.2 GB
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:items-end">
        <span className="text-[11px] text-argent-500">最近使用</span>
        <div className="flex flex-wrap gap-2">
          {recent.map((m) => (
            <LiquidButton
              key={m!.id}
              size="sm"
              variant="secondary"
              onClick={() => {
                pushRecent(m!.id);
                navigate(`/optimize/${m!.id}`);
              }}
              className="px-3"
            >
              {m!.name}
              <ChevronRight className="h-3 w-3" />
            </LiquidButton>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
