// 底部状态栏：iOS 26 连续玻璃条带 + 可拖拽 Q弹回弹 + 泪水放大镜跟随
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Monitor, Smartphone, Wifi, Clock } from "lucide-react";
import { useDeviceStore } from "@/store/useDeviceStore";
import { useSystemStore } from "@/store/useSystemStore";
import { GlassBar } from "@/components/glass/GlassBar";
import { Magnifier } from "@/components/liquid/Magnifier";

function formatUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}天 ${h}时`;
  if (h > 0) return `${h}时 ${m}分`;
  return `${m}分`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function BottomStatusBar() {
  const { mode, label } = useDeviceStore();
  const info = useSystemStore((s) => s.info);
  const ping = info?.network.ping ?? 0;
  const uptime = info?.uptime ?? 0;
  const [now, setNow] = useState(new Date());
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // 拖拽 Q弹：dragX 弹簧回弹到 0
  const dragX = useMotionValue(0);
  const springX = useSpring(dragX, { stiffness: 280, damping: 14, mass: 0.8 });
  // 拖拽时轻微倾斜 + 拉伸（液态变形）
  const rotate = useTransform(springX, [-120, 120], [-2.5, 2.5]);
  const scaleX = useTransform(springX, [-120, 0, 120], [1.02, 1, 1.02]);

  const DeviceIcon = mode === "desktop" ? Monitor : Smartphone;
  const timeStr = formatTime(now);

  return (
    <>
      <motion.div
        style={{ x: springX, rotate, scaleX }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={() => dragX.set(0)}
        whileDrag={{ scale: 1.01 }}
      >
        <div ref={barRef}>
          <GlassBar flow className="flex items-center justify-between gap-4 px-4 py-2 sm:px-5">
            {/* 左：设备信息 */}
            <div className="flex min-w-0 items-center gap-2">
              <DeviceIcon className="h-4 w-4 shrink-0 text-titanium-500" />
              <span className="truncate text-xs text-argent-200">{label}</span>
              <span className="hidden text-[10px] text-argent-500 sm:inline">
                · 运行 {formatUptime(uptime)}
              </span>
            </div>

            {/* 中：连接状态 */}
            <div className="hidden items-center gap-2 md:flex">
              <Wifi className="h-4 w-4 text-titanium-500" />
              <span className="text-xs text-argent-200">已连接</span>
              <span className="text-[10px] text-argent-500">· {ping}ms</span>
            </div>

            {/* 右：时间 */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-argent-400" />
              <span className="font-mono text-xs text-white tabular-nums">
                {timeStr}
              </span>
            </div>
          </GlassBar>
        </div>
      </motion.div>

      {/* 泪水放大镜：跟随状态栏上的指针，放大显示时间 */}
      <Magnifier containerRef={barRef} size={110} zoom={1.8}>
        <div className="flex flex-col items-center gap-1 text-titanium-500">
          <Clock className="h-5 w-5" />
          <span className="font-mono text-xs text-white">{timeStr}</span>
        </div>
      </Magnifier>
    </>
  );
}
