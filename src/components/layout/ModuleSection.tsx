// 模块分区容器：含标题、模块数量、展开/收起开关；默认展开或折叠由父级控制
import { type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleSectionProps {
  title: string;
  count: number;
  accent?: "titanium" | "argent"; // 本机用钛金橙，跨设备用钛金属银
  expanded: boolean;
  onToggle?: () => void;
  collapsible?: boolean;
  children: ReactNode;
}

export function ModuleSection({
  title,
  count,
  accent = "titanium",
  expanded,
  onToggle,
  collapsible = false,
  children,
}: ModuleSectionProps) {
  const dotColor = accent === "titanium" ? "bg-titanium-500" : "bg-argent-400";
  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={collapsible ? onToggle : undefined}
        disabled={!collapsible}
        className={cn(
          "flex items-center gap-3 px-1",
          collapsible && "cursor-pointer hover:opacity-80"
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", dotColor)} />
        <h2 className="text-sm font-medium tracking-wide text-white">{title}</h2>
        <span className="relative rounded-full glass-tile glass-tile-edge px-2 py-0.5 text-[10px] text-argent-300">
          {count} 项
        </span>
        {collapsible && (
          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 text-argent-400 transition-transform duration-300",
              expanded && "rotate-180"
            )}
          />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
