/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 深炭黑底色
        base: {
          900: "#0D0F12", // 主背景
          800: "#14171C", // 次背景
          700: "#1A1D24", // 卡片底
          600: "#22262E", // 抬升层
        },
        // 清新蓝主色（取代钛金橙，对齐上传图标蓝紫调）
        titanium: {
          50: "#EFF4FF",
          100: "#DCE7FF",
          200: "#BFD2FF",
          300: "#93B4FF",
          400: "#6090FF",
          500: "#3B6EF5", // 主强调色
          600: "#2450D6",
          700: "#1E40AE",
          800: "#1E3376",
          900: "#1B2A5C",
        },
        // 钛金属银次色
        argent: {
          50: "#F4F6F8",
          100: "#E2E6EB",
          200: "#C9D0D8",
          300: "#ADB6C2",
          400: "#94A3B8", // 次强调色
          500: "#7A8696",
          600: "#5F6975",
          700: "#475058",
          800: "#2E343A",
          900: "#1C2025",
        },
        // 深朱红危险色
        crimson: {
          400: "#F87171",
          500: "#EF4444",
          600: "#DC2626", // 危险/警告主色
          700: "#B91C1C",
          800: "#7F1D1D",
        },
      },
      fontFamily: {
        display: ['"Orbitron"', "system-ui", "sans-serif"],
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      backdropBlur: {
        glass: "20px",
        "glass-lg": "32px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0,0,0,0.36), inset 0 1px 0 0 rgba(255,255,255,0.12)",
        "glass-sm": "0 4px 16px 0 rgba(0,0,0,0.28), inset 0 1px 0 0 rgba(255,255,255,0.08)",
        glow: "0 0 24px 0 rgba(59,110,245,0.45)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "flow": "flow 20s linear infinite",
        "shimmer": "shimmer 2.5s linear infinite",
      },
      keyframes: {
        flow: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};
