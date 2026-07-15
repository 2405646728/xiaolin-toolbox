// 系统状态 Store：使用真实采集数据（Tauri 优先，浏览器 API 降级）
import { create } from "zustand";
import { collectSystemInfo, type RealSystemInfo } from "@/lib/systemInfo";

interface SystemState {
  info: RealSystemInfo | null;
  loading: boolean;
  history: {
    cpu: number[];
    memory: number[];
    network: number[];
  };
  refresh: () => Promise<void>;
  tick: () => void; // 高频轻量更新历史曲线
}

const MAX_HISTORY = 30;

function initialHistory() {
  return {
    cpu: Array.from({ length: MAX_HISTORY }, () => 0),
    memory: Array.from({ length: MAX_HISTORY }, () => 0),
    network: Array.from({ length: MAX_HISTORY }, () => 0),
  };
}

export const useSystemStore = create<SystemState>((set, get) => ({
  info: null,
  loading: true,
  history: initialHistory(),
  refresh: async () => {
    try {
      const info = await collectSystemInfo();
      const h = get().history;
      const push = (arr: number[], v: number) => [...arr.slice(1), v];
      set({
        info,
        loading: false,
        history: {
          cpu: push(h.cpu, info.cpu.usage),
          memory: push(h.memory, info.memory.percent),
          network: push(h.network, info.network.download),
        },
      });
    } catch (e) {
      console.error("[systemStore] 采集失败", e);
      set({ loading: false });
    }
  },
  tick: () => {
    const info = get().info;
    if (!info) return;
    // 轻量增量更新历史，避免每次都全量采集
    const h = get().history;
    const push = (arr: number[], v: number) => [...arr.slice(1), v];
    set({
      history: {
        cpu: push(h.cpu, info.cpu.usage),
        memory: push(h.memory, info.memory.percent),
        network: push(h.network, info.network.download),
      },
    });
  },
}));
