// 搜索 Hook：根据关键词过滤模块，并联动跨设备分区展开
import { useMemo } from "react";
import { allModules, type ModuleMeta } from "@/data/modules";
import { useModuleStore } from "@/store/useModuleStore";
import { useDeviceStore } from "@/store/useDeviceStore";
import { useEffect } from "react";

export interface SearchResult {
  native: ModuleMeta[];
  cross: ModuleMeta[];
  hasCrossMatch: boolean;
}

export function useSearch(): SearchResult {
  const query = useModuleStore((s) => s.searchQuery);
  const mode = useDeviceStore((s) => s.mode);
  const setCrossExpanded = useModuleStore((s) => s.setCrossExpanded);
  const manualExpanded = useModuleStore((s) => s.crossExpanded);

  // 搜索命中跨设备分区时，自动展开
  useEffect(() => {
    if (!query.trim()) return;
    const q = query.toLowerCase();
    const hasCross = allModules.some(
      (m) =>
        m.device !== mode &&
        m.device !== "universal" &&
        (m.name.toLowerCase().includes(q) ||
          m.keywords.some((k) => k.toLowerCase().includes(q)))
    );
    if (hasCross && !manualExpanded) setCrossExpanded(true);
  }, [query, mode, manualExpanded, setCrossExpanded]);

  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const native = allModules
        .filter((m) => m.device === mode || m.device === "universal")
        .sort((a, b) => b.priority - a.priority);
      const cross = allModules
        .filter((m) => m.device !== mode && m.device !== "universal")
        .sort((a, b) => b.priority - a.priority);
      return { native, cross, hasCrossMatch: false };
    }
    const match = (m: ModuleMeta) =>
      m.name.toLowerCase().includes(q) ||
      m.subtitle.toLowerCase().includes(q) ||
      m.keywords.some((k) => k.toLowerCase().includes(q));

    const native = allModules
      .filter((m) => (m.device === mode || m.device === "universal") && match(m))
      .sort((a, b) => b.priority - a.priority);
    const cross = allModules
      .filter((m) => m.device !== mode && m.device !== "universal" && match(m))
      .sort((a, b) => b.priority - a.priority);
    return { native, cross, hasCrossMatch: cross.length > 0 };
  }, [query, mode]);
}
