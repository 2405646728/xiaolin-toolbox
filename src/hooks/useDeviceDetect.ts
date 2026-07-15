// 设备识别 Hook：监听视口变化，跨越 1024 阈值时重新判定（非手动覆盖时）
import { useEffect } from "react";
import { useDeviceStore } from "@/store/useDeviceStore";

export function useDeviceDetect() {
  const autoDetect = useDeviceStore((s) => s.autoDetect);
  const manualOverride = useDeviceStore((s) => s.manualOverride);

  useEffect(() => {
    let prevWidth = window.innerWidth;
    const handler = () => {
      const width = window.innerWidth;
      // 跨越 1024 阈值才重新判定
      if ((prevWidth < 1024) !== (width < 1024)) {
        if (!manualOverride) autoDetect();
      }
      prevWidth = width;
    };
    const debounced = debounce(handler, 300);
    window.addEventListener("resize", debounced);
    return () => window.removeEventListener("resize", debounced);
  }, [autoDetect, manualOverride]);
}

function debounce<T extends (...args: never[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
