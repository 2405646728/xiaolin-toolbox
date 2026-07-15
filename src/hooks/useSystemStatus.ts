// 系统状态 Hook：低频全量采集（2s）+ 高频 tick 更新历史曲线（1s）
import { useEffect } from "react";
import { useSystemStore } from "@/store/useSystemStore";

export function useSystemStatus() {
  const refresh = useSystemStore((s) => s.refresh);
  const tick = useSystemStore((s) => s.tick);

  useEffect(() => {
    // 首次立即采集
    refresh();
    // 每 2 秒全量采集真实数据
    const refreshId = setInterval(refresh, 2000);
    // 每 1 秒轻量推进历史曲线
    const tickId = setInterval(tick, 1000);
    return () => {
      clearInterval(refreshId);
      clearInterval(tickId);
    };
  }, [refresh, tick]);
}
