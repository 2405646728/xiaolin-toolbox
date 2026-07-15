// 硬件信息 Hook：首次挂载采集一次，可手动刷新
import { useEffect } from "react";
import { useHardwareStore } from "@/store/useHardwareStore";

export function useHardwareInfo() {
  const info = useHardwareStore((s) => s.info);
  const loading = useHardwareStore((s) => s.loading);
  const refresh = useHardwareStore((s) => s.refresh);

  useEffect(() => {
    if (!info && loading) refresh();
  }, [info, loading, refresh]);

  return { info, loading, refresh };
}
