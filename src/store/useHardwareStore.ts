// 硬件信息 Store：一次性采集详细硬件信息，无需高频刷新
import { create } from "zustand";
import { collectHardwareInfo, type HardwareInfo } from "@/lib/systemInfo";

interface HardwareState {
  info: HardwareInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useHardwareStore = create<HardwareState>((set) => ({
  info: null,
  loading: true,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const info = await collectHardwareInfo();
      set({ info, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },
}));
