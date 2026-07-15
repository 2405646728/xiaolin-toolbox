// 首页：搜索栏 + 状态概览 + 设备硬件信息 + 一键加速 + 本机/跨设备工具分区
import { motion } from "framer-motion";
import { Settings as SettingsIcon, LayoutDashboard, Eye, Activity, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useDeviceDetect } from "@/hooks/useDeviceDetect";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { useHardwareInfo } from "@/hooks/useHardwareInfo";
import { useSearch } from "@/hooks/useSearch";
import { useDeviceStore } from "@/store/useDeviceStore";
import { useModuleStore } from "@/store/useModuleStore";
import { TopSearchBar } from "@/components/layout/TopSearchBar";
import { ModuleSection } from "@/components/layout/ModuleSection";
import { ModuleGrid } from "@/components/layout/ModuleGrid";
import { DeviceBadge } from "@/components/modules/DeviceBadge";
import { StatusOverview } from "@/components/modules/StatusOverview";
import { QuickAction } from "@/components/modules/QuickAction";
import { HardwareInfo } from "@/components/modules/HardwareInfo";
import { LiquidButton } from "@/components/liquid/LiquidButton";

export default function Home() {
  useDeviceDetect();
  useSystemStatus();
  useHardwareInfo();
  const { mode } = useDeviceStore();
  const { native, cross, hasCrossMatch } = useSearch();
  const crossExpanded = useModuleStore((s) => s.crossExpanded);
  const setCrossExpanded = useModuleStore((s) => s.setCrossExpanded);
  const showAll = useModuleStore((s) => s.showAll);
  const setShowAll = useModuleStore((s) => s.setShowAll);
  const query = useModuleStore((s) => s.searchQuery);

  const isDesktop = mode === "desktop";
  const crossTitle = isDesktop ? "移动工具箱" : "桌面工具箱";
  const isSearching = query.trim().length > 0;
  const expanded = isSearching || showAll || crossExpanded;

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden sm:gap-4">
      {/* 顶部栏：移动端显示标题+导航，桌面端仅搜索栏 + 设备胶囊 + 显示全部 */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-1"
      >
        {/* 移动端：品牌 + 导航（桌面端导航已在侧边栏） */}
        {!isDesktop && (
          <div className="flex items-center gap-2">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl glass-tile-strong glass-tile-edge glass-shine shadow-glow">
              <LayoutDashboard className="relative z-10 h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="font-display text-sm font-bold tracking-wide text-white">
                小林的工具箱
              </h1>
              <span className="text-[10px] text-argent-500">系统优化集成</span>
            </div>
          </div>
        )}

        <div className={`flex items-center gap-2 ${isDesktop ? "ml-auto" : "ml-auto"}`}>
          <DeviceBadge />
          <LiquidButton
            size="sm"
            variant={showAll ? "primary" : "secondary"}
            onClick={() => setShowAll(!showAll)}
            className="px-3"
          >
            <Eye className="h-3.5 w-3.5" />
            {showAll ? "仅本机" : "显示全部"}
          </LiquidButton>
          {/* 移动端：监控/设置入口（桌面端在侧边栏） */}
          {!isDesktop && (
            <>
              <Link to="/cmd-ai">
                <LiquidButton size="sm" variant="primary" shimmer className="px-3">
                  <Sparkles className="h-3.5 w-3.5" />
                </LiquidButton>
              </Link>
              <Link to="/monitor">
                <LiquidButton size="sm" variant="secondary" className="px-3">
                  <Activity className="h-3.5 w-3.5" />
                </LiquidButton>
              </Link>
              <Link to="/settings">
                <LiquidButton size="sm" variant="ghost" className="px-2.5">
                  <SettingsIcon className="h-4 w-4" />
                </LiquidButton>
              </Link>
            </>
          )}
        </div>
      </motion.header>

      {/* 搜索栏 */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="shrink-0 px-1"
      >
        <TopSearchBar />
      </motion.div>

      {/* 主内容区：可滚动 */}
      <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 pb-1">
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* 状态概览 */}
          <StatusOverview />

          {/* 设备硬件信息 */}
          <HardwareInfo />

          {/* 一键加速 */}
          <QuickAction />

          {/* 本机工具分区 */}
          <ModuleSection
            title="本机工具"
            count={native.length}
            accent="titanium"
            expanded
          >
            <ModuleGrid
              modules={native}
              emptyHint={isSearching ? "本机分区无匹配模块" : "暂无模块"}
            />
          </ModuleSection>

          {/* 跨设备工具分区（可折叠） */}
          {cross.length > 0 && (
            <ModuleSection
              title={crossTitle}
              count={cross.length}
              accent="argent"
              expanded={expanded}
              collapsible
              onToggle={() => setCrossExpanded(!crossExpanded)}
            >
              <ModuleGrid
                modules={cross}
                emptyHint={
                  isSearching
                    ? hasCrossMatch
                      ? ""
                      : "跨设备分区无匹配模块"
                    : "暂无模块"
                }
              />
            </ModuleSection>
          )}

          <div className="h-2" />
        </div>
      </main>
    </div>
  );
}
