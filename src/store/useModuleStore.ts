// 模块状态：搜索关键词、最近使用、跨设备分区展开
import { create } from "zustand";

interface ModuleState {
  searchQuery: string;
  recentUsed: string[]; // 模块 id 列表
  crossExpanded: boolean; // 跨设备分区是否展开（用户手动控制）
  showAll: boolean; // "显示全部"快捷切换
  setSearchQuery: (q: string) => void;
  pushRecent: (id: string) => void;
  setCrossExpanded: (v: boolean) => void;
  setShowAll: (v: boolean) => void;
}

export const useModuleStore = create<ModuleState>((set) => ({
  searchQuery: "",
  recentUsed: ["cleaner", "boost", "privacy"],
  crossExpanded: false,
  showAll: false,
  setSearchQuery: (q) => set({ searchQuery: q }),
  pushRecent: (id) =>
    set((state) => ({
      recentUsed: [id, ...state.recentUsed.filter((r) => r !== id)].slice(0, 6),
    })),
  setCrossExpanded: (v) => set({ crossExpanded: v }),
  setShowAll: (v) => set({ showAll: v, crossExpanded: v }),
}));
