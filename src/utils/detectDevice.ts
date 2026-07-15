// 设备识别工具：综合 UA、触摸点、视口宽度判断当前设备类型

export type DeviceMode = "desktop" | "mobile";
export type DeviceOS =
  | "windows"
  | "macos"
  | "linux"
  | "android"
  | "ios"
  | "unknown";
export type Viewport = "sm" | "md" | "lg";

export interface DeviceInfo {
  mode: DeviceMode;
  os: DeviceOS;
  label: string; // 中文设备标签
  isTouch: boolean;
  viewport: Viewport;
}

function parseOS(ua: string): DeviceOS {
  const lower = ua.toLowerCase();
  if (lower.includes("win")) return "windows";
  if (lower.includes("mac os") || lower.includes("macintosh")) return "macos";
  if (lower.includes("android")) return "android";
  if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios"))
    return "ios";
  if (lower.includes("linux")) return "linux";
  return "unknown";
}

function getViewport(width: number): Viewport {
  if (width < 640) return "sm";
  if (width < 1024) return "md";
  return "lg";
}

function getLabel(mode: DeviceMode, os: DeviceOS): string {
  if (mode === "desktop") {
    if (os === "windows") return "Windows 设备";
    if (os === "macos") return "macOS 设备";
    if (os === "linux") return "Linux 设备";
    return "桌面设备";
  }
  if (os === "android") return "安卓设备";
  if (os === "ios") return "iOS 设备";
  return "移动设备";
}

export function detectDevice(): DeviceInfo {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return {
      mode: "desktop",
      os: "unknown",
      label: "桌面设备",
      isTouch: false,
      viewport: "lg",
    };
  }

  const ua = navigator.userAgent || "";
  const os = parseOS(ua);
  const isTouch =
    (navigator.maxTouchPoints ?? 0) > 0 || /android|iphone|ipad/i.test(ua);
  const width = window.innerWidth;
  const viewport = getViewport(width);

  // 判定规则：
  // - UA 含 android/iphone/ipad → 移动
  // - UA 含 windows/mac/linux 且 maxTouchPoints === 0 → 桌面
  // - 否则按视口宽度 ≥ 1024 判定为桌面
  let mode: DeviceMode;
  if (os === "android" || os === "ios") {
    mode = "mobile";
  } else if (os === "windows" || os === "macos" || os === "linux") {
    mode = isTouch && width < 1024 ? "mobile" : "desktop";
  } else {
    mode = width < 1024 && isTouch ? "mobile" : "desktop";
  }

  return {
    mode,
    os,
    label: getLabel(mode, os),
    isTouch,
    viewport,
  };
}
