// 模块卡片：图标 + 名称 + 副标题 + 状态点 + 风险标记，点击进入详情
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { type ModuleMeta } from "@/data/modules";
import { ModuleIcon } from "@/components/modules/ModuleIcon";
import { GlassCard } from "@/components/glass/GlassCard";
import { useModuleStore } from "@/store/useModuleStore";
import { cn } from "@/lib/utils";

interface ModuleCardProps {
  module: ModuleMeta;
  index: number;
}

const riskLabel: Record<string, { text: string; cls: string }> = {
  safe: { text: "安全", cls: "text-titanium-400" },
  caution: { text: "注意", cls: "text-argent-300" },
  advanced: { text: "高级", cls: "text-crimson-500" },
};

export function ModuleCard({ module, index }: ModuleCardProps) {
  const navigate = useNavigate();
  const pushRecent = useModuleStore((s) => s.pushRecent);
  const risk = riskLabel[module.riskLevel];

  const handleClick = () => {
    pushRecent(module.id);
    // 命令行工具模块跳转到 AI 助手页面
    if (module.id === "cmdtools") {
      navigate("/cmd-ai");
      return;
    }
    navigate(`/optimize/${module.id}`);
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="block w-full text-left focus:outline-none"
    >
      <GlassCard
        hover
        className="glass-shine flex h-full min-h-[132px] flex-col gap-3 p-4"
      >
        <div className="flex items-start justify-between">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl glass-tile-strong glass-tile-edge text-titanium-500">
            <ModuleIcon name={module.icon} className="relative z-10 h-5 w-5" />
          </div>
          <span
            className={cn(
              "relative rounded-full glass-tile glass-tile-edge px-2 py-0.5 text-[10px]",
              risk.cls
            )}
          >
            {risk.text}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <h3 className="text-sm font-medium text-white">{module.name}</h3>
          <p className="text-xs leading-relaxed text-argent-400 line-clamp-2">
            {module.subtitle}
          </p>
        </div>

        {module.estimatedSize && (
          <>
            <hr className="glass-divider opacity-60" />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-titanium-400">
                {module.estimatedSize}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-argent-400 transition-colors group-hover:text-titanium-500" />
            </div>
          </>
        )}
      </GlassCard>
    </motion.button>
  );
}
