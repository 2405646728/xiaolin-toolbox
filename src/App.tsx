import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import OptimizeDetail from "@/pages/OptimizeDetail";
import Monitor from "@/pages/Monitor";
import Settings from "@/pages/Settings";
import CommandAI from "@/pages/CommandAI";
import OppoStudio from "@/pages/OppoStudio";
import { LiquidFilter } from "@/components/liquid/LiquidFilter";
import { SideNav } from "@/components/layout/SideNav";
import { BottomStatusBar } from "@/components/layout/BottomStatusBar";
import { useDeviceStore } from "@/store/useDeviceStore";

function Shell() {
  const { mode } = useDeviceStore();
  const isDesktop = mode === "desktop";

  return (
    <div className="flex h-full gap-3 p-3 sm:gap-4 sm:p-4">
      {/* 桌面模式：左侧固定侧边栏 */}
      {isDesktop && <SideNav />}

      {/* 主区域：页面内容 + 底部状态栏 */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/optimize/:moduleId" element={<OptimizeDetail />} />
            <Route path="/cmd-ai" element={<CommandAI />} />
            <Route path="/oppo" element={<OppoStudio />} />
            <Route path="/monitor" element={<Monitor />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
        <div className="shrink-0">
          <BottomStatusBar />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      {/* 液态 gooey 滤镜定义（全局复用） */}
      <LiquidFilter />
      {/* 背景氛围光斑 */}
      <div className="app-aurora" />
      <div className="relative z-10 h-full">
        <Shell />
      </div>
    </Router>
  );
}
