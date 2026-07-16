// 小林 AI · 对话型 AI 助手主应用
import CommandAI from "@/pages/CommandAI";
import { LiquidFilter } from "@/components/liquid/LiquidFilter";

export default function App() {
  return (
    <>
      {/* 液态 gooey 滤镜定义（全局复用） */}
      <LiquidFilter />
      {/* 背景氛围光斑 */}
      <div className="app-aurora" />
      <div className="relative z-10 h-full p-3 sm:p-4">
        <CommandAI />
      </div>
    </>
  );
}
