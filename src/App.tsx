// 小林 AI · 对话型 AI 助手主应用
// 使用 useState 管理页面切换（不引入 react-router-dom）
// 全局挂载 ConfirmDialog 实例：mount 时通过 confirmDialogManager.setRenderer
// 注册渲染回调，业务侧即可通过 confirmAction() 命令式触发确认弹窗

import { useState } from "react";
import CommandAI from "@/pages/CommandAI";
import Settings from "@/pages/Settings";
import { LiquidFilter } from "@/components/liquid/LiquidFilter";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { UpdateChecker } from "@/components/UpdateChecker";
import { TitleBar } from "@/components/TitleBar";

export default function App() {
  const [page, setPage] = useState<"chat" | "settings">("chat");

  return (
    <>
      {/* 液态 gooey 滤镜定义（全局复用） */}
      <LiquidFilter />
      {/* 背景氛围光斑 */}
      <div className="app-aurora" />
      {/* 自定义窗口标题栏（替代系统标题栏） */}
      <TitleBar />
      {/* 主内容区：顶部留出标题栏高度（h-9 = 36px） */}
      <div className="relative z-10 h-full pt-9">
        <div className="h-full p-3 sm:p-4 pt-2">
          {page === "chat" && (
            <CommandAI onOpenSettings={() => setPage("settings")} />
          )}
          {page === "settings" && <Settings onBack={() => setPage("chat")} />}
        </div>
      </div>
      {/* 全局确认弹窗：占位 props，实际状态由 confirmDialogManager 单例驱动 */}
      <ConfirmDialog
        open={false}
        title=""
        toolName=""
        args={{}}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
      {/* 启动时自动检查更新，发现新版本弹出更新介绍 */}
      <UpdateChecker />
    </>
  );
}
