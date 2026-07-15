// 设备识别胶囊：显示当前设备类型与识别状态，点击可手动切换设备模式
import { Monitor, Smartphone, Repeat } from "lucide-react";
import { useDeviceStore } from "@/store/useDeviceStore";
import { GlassCard } from "@/components/glass/GlassCard";
import { cn } from "@/lib/utils";

export function DeviceBadge() {
  const { mode, label, manualOverride, setMode } = useDeviceStore();
  const Icon = mode === "desktop" ? Monitor : Smartphone;
  const nextMode = mode === "desktop" ? "mobile" : "desktop";

  return (
    <GlassCard
      hover
      edge
      variant="strong"
      onClick={() => setMode(nextMode)}
      className="glass-flow glass-shine flex cursor-pointer items-center gap-2 px-3 py-1.5"
      title="点击切换设备模式"
    >
      <Icon className="h-4 w-4 text-titanium-500" />
      <span className="text-xs font-medium text-white">{label}</span>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          manualOverride ? "bg-argent-400" : "bg-titanium-500"
        )}
        title={manualOverride ? "手动模式" : "自动识别"}
      />
      <Repeat className="h-3 w-3 text-argent-500" />
    </GlassCard>
  );
}
