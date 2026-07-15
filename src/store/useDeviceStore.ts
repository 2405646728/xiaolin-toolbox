// 设备识别状态：管理当前设备模式与手动切换
import { create } from "zustand";
import {
  detectDevice,
  type DeviceInfo,
  type DeviceMode,
} from "@/utils/detectDevice";

interface DeviceState extends DeviceInfo {
  manualOverride: boolean; // 是否用户手动切换
  autoDetect: () => void;
  setMode: (mode: DeviceMode) => void;
}

const initial = detectDevice();

export const useDeviceStore = create<DeviceState>((set) => ({
  ...initial,
  manualOverride: false,
  autoDetect: () => set({ ...detectDevice(), manualOverride: false }),
  setMode: (mode) =>
    set((state) => ({
      mode,
      label:
        mode === "desktop"
          ? state.os === "macos"
            ? "macOS 设备"
            : state.os === "linux"
              ? "Linux 设备"
              : "Windows 设备"
          : state.os === "ios"
            ? "iOS 设备"
            : "安卓设备",
      manualOverride: true,
    })),
}));
