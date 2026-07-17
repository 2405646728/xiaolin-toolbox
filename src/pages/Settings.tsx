// 小林 AI · 设置页面
// 五个分区：API 配置 / 模型选择 / 安全策略 / 用量统计 / 关于
// iOS 26 液态玻璃风格 + Framer Motion Tab 切换动画

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Eye, EyeOff, Save, Plug, Shield, BarChart3, Info,
  Check, X, Loader2, Trash2, Download, RefreshCw, CheckCircle2,
} from "lucide-react";
import { GlassButton } from "@/components/glass/GlassButton";
import { UsagePanel } from "@/components/UsagePanel";
import { loadLLMConfig, saveLLMConfig, chatCompletion, type LLMConfig } from "@/lib/llm";
import { exportUsageCsv, resetUsage, MODEL_PRICING } from "@/lib/usage";
import { cn } from "@/lib/utils";

export interface SettingsProps {
  onBack?: () => void;          // 返回主界面回调
  onConfigChange?: () => void;  // 配置变更通知（让主界面刷新 LLMConfig）
}

// ---------- 常量 ----------

const DEFAULT_CONFIG: LLMConfig = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  visionModel: "gpt-4o",
  temperature: 0.7,
  maxTokens: 8000,
};

const SECURITY_KEY = "xiaolin-ai-security";

interface SecurityConfig {
  confirmDangerous: boolean;
  dailyCostLimit: number;
}
const DEFAULT_SECURITY: SecurityConfig = { confirmDangerous: true, dailyCostLimit: 10 };

// 命令黑名单（只读展示）
const COMMAND_BLOCKLIST = ["format", "del", "rd", "rmdir", "mkfs", "dd"];

// 预置模型卡片
const PRESET_MODELS = [
  { key: "ollama", name: "Ollama 本地", desc: "Qwen2.5 7B + LLaVA（4060 8GB 推荐）",
    baseUrl: "http://localhost:11434/v1", model: "qwen2.5:7b-instruct-q4_K_M", visionModel: "llava:7b" },
  { key: "openai", name: "OpenAI", desc: "GPT-4o 系列",
    baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", visionModel: "gpt-4o" },
  { key: "deepseek", name: "DeepSeek", desc: "DeepSeek Chat",
    baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", visionModel: "deepseek-chat" },
  { key: "zhipu", name: "智谱 AI", desc: "GLM-4 系列",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash", visionModel: "glm-4v" },
  { key: "qwen", name: "通义千问", desc: "Qwen Turbo/VL",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-turbo", visionModel: "qwen-vl-max" },
  { key: "custom", name: "自定义", desc: "手动填写配置",
    baseUrl: "", model: "", visionModel: "" },
] as const;

const TABS = [
  { key: "api", label: "API 配置", icon: Plug },
  { key: "model", label: "模型选择", icon: BarChart3 },
  { key: "security", label: "安全策略", icon: Shield },
  { key: "usage", label: "用量统计", icon: BarChart3 },
  { key: "about", label: "关于", icon: Info },
] as const;

type TabKey = (typeof TABS)[number]["key"];
type Preset = (typeof PRESET_MODELS)[number];
type PricingEntry = typeof MODEL_PRICING[string];

// 通用样式
const inputCls =
  "w-full rounded-xl bg-base-900/40 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-titanium-500/50 focus:ring-2 focus:ring-titanium-500/20 transition-colors";
const labelCls = "text-xs text-argent-300 font-medium";

// 安全配置读写
function loadSecurity(): SecurityConfig {
  try {
    const raw = localStorage.getItem(SECURITY_KEY);
    if (!raw) return DEFAULT_SECURITY;
    return { ...DEFAULT_SECURITY, ...JSON.parse(raw) };
  } catch { return DEFAULT_SECURITY; }
}
function saveSecurity(s: SecurityConfig): void {
  try { localStorage.setItem(SECURITY_KEY, JSON.stringify(s)); } catch { /* 静默 */ }
}

// 玻璃开关
function GlassToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full border transition-colors",
        checked
          ? "bg-gradient-to-br from-titanium-500 to-titanium-700 border-titanium-500/50"
          : "bg-base-900/60 border-white/15"
      )}>
      <motion.span layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute rounded-full bg-white shadow"
        style={{ height: 18, width: 18, top: 2, left: checked ? 22 : 2 }} />
    </button>
  );
}

// ---------- 主组件 ----------

export default function Settings({ onBack, onConfigChange }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("api");
  const [config, setConfig] = useState<LLMConfig>(() => loadLLMConfig() ?? DEFAULT_CONFIG);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [security, setSecurity] = useState<SecurityConfig>(loadSecurity);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [usageTrigger, setUsageTrigger] = useState(0);

  // 字段更新辅助
  const update = <K extends keyof LLMConfig>(key: K, value: LLMConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  };

  // 保存配置到 localStorage
  const handleSave = () => {
    setSaving(true);
    saveLLMConfig(config);
    window.setTimeout(() => { setSaving(false); onConfigChange?.(); }, 300);
  };

  // 测试连接：发送 ping 消息验证 API Key，使用当前表单值
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (!config.apiKey) throw new Error("未配置 API Key");
      await chatCompletion({ config, messages: [{ role: "user", content: "ping" }] });
      setTestResult({ success: true, message: "连接成功" });
      setUsageTrigger((n) => n + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "连接失败";
      setTestResult({ success: false, message: msg });
    } finally {
      setTesting(false);
    }
  };

  // 应用预置模型（不立即保存，仅填充表单）
  const applyPreset = (preset: Preset) => {
    setConfig((c) => ({
      ...c,
      baseUrl: preset.baseUrl,
      model: preset.model,
      visionModel: preset.visionModel,
      // Ollama 不校验 API Key，自动填充占位符方便用户直接使用
      apiKey: preset.key === "ollama" ? (c.apiKey || "ollama") : c.apiKey,
    }));
  };

  // 重置用量数据
  const handleResetUsage = () => {
    resetUsage();
    setResetConfirmOpen(false);
    setResetDone(true);
    setUsageTrigger((n) => n + 1);
    window.setTimeout(() => setResetDone(false), 2000);
  };

  // 导出 CSV：优先 Tauri save dialog，失败降级浏览器 Blob 下载
  const handleExportCsv = async () => {
    const csv = exportUsageCsv();
    let saved = false;
    // 用变量拼接模块名，绕过 Vite/Rollup 静态分析（插件未安装为依赖）
    const dialogModule = "@tauri-apps/plugin-dialog";
    const fsModule = "@tauri-apps/plugin-fs";
    try {
      const dialog = await import(/* @vite-ignore */ dialogModule);
      const filePath = await dialog.save({
        defaultPath: "xiaolin-ai-usage.csv",
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (filePath) {
        try {
          const fs = await import(/* @vite-ignore */ fsModule);
          await fs.writeTextFile(filePath, csv);
          saved = true;
        } catch { /* fs 模块不可用，走浏览器降级 */ }
      }
    } catch { /* dialog 模块未安装或非 Tauri 环境，走浏览器降级 */ }
    if (!saved) {
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "xiaolin-ai-usage.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setExportDone(true);
    window.setTimeout(() => setExportDone(false), 2000);
  };

  // 安全配置变更时持久化
  useEffect(() => { saveSecurity(security); }, [security]);

  // 当前模型单价（用量 Tab 顶部展示）
  const currentPricing = useMemo(() => ({
    textP: MODEL_PRICING[config.model],
    visionP: MODEL_PRICING[config.visionModel],
  }), [config.model, config.visionModel]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 顶部栏：返回按钮 + 标题 */}
      <header className="glass-strong glass-edge flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl">
        <GlassButton variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>返回</span>
        </GlassButton>
        <h1 className="text-base font-medium text-white">设置</h1>
      </header>

      {/* Tab 栏（横向可滚动） */}
      <nav className="glass glass-edge flex gap-1 overflow-x-auto rounded-2xl p-1.5 shadow-xl">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition-colors",
                active ? "text-white" : "text-argent-300 hover:text-white"
              )}>
              {active && (
                <motion.span layoutId="settings-tab-pill"
                  className="absolute inset-0 rounded-xl border border-titanium-500/40 bg-gradient-to-br from-titanium-500/30 to-titanium-700/20"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }} />
              )}
              <Icon size={14} className="relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 内容区（Tab 切换淡入淡出） */}
      <div className="flex-1 overflow-y-auto pr-1">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeOut" }}>
            {activeTab === "api" && (
              <ApiTab config={config} update={update} showKey={showKey} setShowKey={setShowKey}
                saving={saving} testing={testing} testResult={testResult}
                onSave={handleSave} onTest={handleTest} />
            )}
            {activeTab === "model" && <ModelTab config={config} onApply={applyPreset} />}
            {activeTab === "security" && (
              <SecurityTab security={security} setSecurity={setSecurity}
                resetConfirmOpen={resetConfirmOpen} setResetConfirmOpen={setResetConfirmOpen}
                resetDone={resetDone} exportDone={exportDone}
                onResetUsage={handleResetUsage} onExportCsv={handleExportCsv} />
            )}
            {activeTab === "usage" && (
              <UsageTab config={config} pricing={currentPricing} trigger={usageTrigger} />
            )}
            {activeTab === "about" && <AboutTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------- Tab 1: API 配置 ----------

function ApiTab({
  config, update, showKey, setShowKey,
  saving, testing, testResult, onSave, onTest,
}: {
  config: LLMConfig;
  update: <K extends keyof LLMConfig>(key: K, value: LLMConfig[K]) => void;
  showKey: boolean; setShowKey: (v: boolean) => void;
  saving: boolean; testing: boolean;
  testResult: { success: boolean; message: string } | null;
  onSave: () => void; onTest: () => void;
}) {
  return (
    <div className="glass glass-edge rounded-2xl p-6 shadow-xl">
      <h2 className="mb-4 text-sm font-medium text-white">API 配置</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Base URL</label>
          <input className={inputCls} value={config.baseUrl}
            onChange={(e) => update("baseUrl", e.target.value)}
            placeholder="https://api.openai.com/v1" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>API Key</label>
          <div className="relative">
            <input className={cn(inputCls, "pr-10")} type={showKey ? "text" : "password"}
              value={config.apiKey}
              onChange={(e) => update("apiKey", e.target.value)} placeholder="sk-..." />
            <button type="button" onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-argent-300 hover:text-white">
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>文本模型</label>
          <input className={inputCls} value={config.model}
            onChange={(e) => update("model", e.target.value)} placeholder="gpt-4o-mini" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>视觉模型</label>
          <input className={inputCls} value={config.visionModel}
            onChange={(e) => update("visionModel", e.target.value)} placeholder="gpt-4o" />
        </div>
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <div className="flex items-center justify-between">
            <label className={labelCls}>Temperature</label>
            <span className="font-mono text-xs text-titanium-300">
              {config.temperature.toFixed(2)}
            </span>
          </div>
          <input type="range" min={0} max={2} step={0.05} value={config.temperature}
            onChange={(e) => update("temperature", parseFloat(e.target.value))}
            className="w-full accent-titanium-500" />
        </div>
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className={labelCls}>Max Tokens</label>
          <input type="number" min={1} className={inputCls} value={config.maxTokens}
            onChange={(e) => update("maxTokens", parseInt(e.target.value) || 0)} />
        </div>
      </div>

      {/* 操作按钮 + 测试结果 */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <GlassButton variant="primary" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>{saving ? "保存中..." : "保存配置"}</span>
        </GlassButton>
        <GlassButton variant="secondary" onClick={onTest} disabled={testing}>
          {testing ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
          <span>{testing ? "测试中..." : "测试连接"}</span>
        </GlassButton>
        <AnimatePresence>
          {testResult && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs",
                testResult.success
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "bg-crimson-600/15 text-crimson-400 border border-crimson-600/30"
              )}>
              {testResult.success ? <Check size={12} /> : <X size={12} />}
              <span>{testResult.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------- Tab 2: 模型快速选择 ----------

function ModelTab({ config, onApply }: { config: LLMConfig; onApply: (preset: Preset) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-edge rounded-2xl p-4 shadow-xl">
        <h2 className="text-sm font-medium text-white">模型快速选择</h2>
        <p className="mt-1 text-xs text-argent-300">
          点击卡片自动填充 API 配置字段（不会立即保存，请到「API 配置」Tab 点击保存）。
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRESET_MODELS.map((preset) => {
          const active = preset.key !== "custom" &&
            preset.baseUrl === config.baseUrl &&
            preset.model === config.model &&
            preset.visionModel === config.visionModel;
          return (
            <button key={preset.key} onClick={() => onApply(preset)}
              className={cn(
                "glass-tile glass-tile-edge glass-tile-hover rounded-2xl p-4 text-left shadow-xl transition-all",
                active && "glass-tile-strong"
              )}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{preset.name}</span>
                {active && <Check size={14} className="text-titanium-400" />}
              </div>
              <p className="mt-1 text-xs text-argent-300">{preset.desc}</p>
              {preset.key !== "custom" && (
                <div className="mt-3 space-y-0.5 text-[11px] text-argent-400">
                  <div className="font-mono truncate">{preset.baseUrl}</div>
                  <div className="font-mono">{preset.model} · {preset.visionModel}</div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Tab 3: 安全策略 ----------

function SecurityTab({
  security, setSecurity, resetConfirmOpen, setResetConfirmOpen,
  resetDone, exportDone, onResetUsage, onExportCsv,
}: {
  security: SecurityConfig;
  setSecurity: Dispatch<SetStateAction<SecurityConfig>>;
  resetConfirmOpen: boolean; setResetConfirmOpen: (v: boolean) => void;
  resetDone: boolean; exportDone: boolean;
  onResetUsage: () => void; onExportCsv: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* 危险操作二次确认 */}
      <div className="glass glass-edge rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-white">危险操作二次确认</span>
            <span className="text-xs text-argent-300">
              AI 调用 delete_file / kill_process 等危险工具时弹窗确认
            </span>
          </div>
          <GlassToggle checked={security.confirmDangerous}
            onChange={(v) => setSecurity((s) => ({ ...s, confirmDangerous: v }))} />
        </div>
      </div>

      {/* 每日费用上限 */}
      <div className="glass glass-edge rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-white">每日费用上限</span>
          <span className="text-xs text-argent-300">
            当日累计费用超过此值时主界面状态栏将红色高亮提醒
          </span>
          <div className="flex items-center gap-2">
            <span className="text-argent-300 text-sm">¥</span>
            <input type="number" min={0} step={1}
              className={cn(inputCls, "max-w-[140px]")} value={security.dailyCostLimit}
              onChange={(e) => setSecurity((s) => ({
                ...s, dailyCostLimit: parseFloat(e.target.value) || 0,
              }))} />
            <span className="text-xs text-argent-400">元 / 天</span>
          </div>
        </div>
      </div>

      {/* 命令黑名单 */}
      <div className="glass glass-edge rounded-2xl p-5 shadow-xl">
        <span className="text-sm font-medium text-white">命令黑名单（只读）</span>
        <p className="mt-1 text-xs text-argent-300">以下命令在 run_shell 中将被拒绝执行</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {COMMAND_BLOCKLIST.map((cmd) => (
            <span key={cmd}
              className="rounded-lg border border-crimson-600/30 bg-crimson-600/10 px-2.5 py-1 font-mono text-xs text-crimson-400">
              {cmd}
            </span>
          ))}
        </div>
      </div>

      {/* 数据操作 */}
      <div className="glass glass-edge rounded-2xl p-5 shadow-xl">
        <span className="text-sm font-medium text-white">用量数据</span>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <GlassButton variant="secondary" onClick={onExportCsv}>
            {exportDone ? <Check size={16} /> : <Download size={16} />}
            <span>{exportDone ? "已导出" : "导出 CSV"}</span>
          </GlassButton>
          <GlassButton variant="danger" onClick={() => setResetConfirmOpen(true)}>
            <Trash2 size={16} />
            <span>重置用量数据</span>
          </GlassButton>
          {resetDone && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-300">
              <Check size={12} /> 已重置
            </span>
          )}
        </div>
      </div>

      {/* 重置二次确认弹窗 */}
      <AnimatePresence>
        {resetConfirmOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
            onClick={() => setResetConfirmOpen(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="glass-strong glass-edge relative w-full max-w-sm rounded-2xl p-5"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}>
              <h3 className="text-sm font-medium text-white">确认重置用量数据？</h3>
              <p className="mt-2 text-xs text-argent-300">
                此操作将清空所有历史用量记录（包括 tokens、费用、调用次数），不可恢复。
              </p>
              <div className="mt-4 flex gap-3">
                <GlassButton variant="secondary" className="flex-1"
                  onClick={() => setResetConfirmOpen(false)}>
                  <X size={16} /><span>取消</span>
                </GlassButton>
                <GlassButton variant="danger" className="flex-1" onClick={onResetUsage}>
                  <Trash2 size={16} /><span>确认重置</span>
                </GlassButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Tab 4: 用量统计（嵌入 UsagePanel） ----------

function UsageTab({
  config, pricing, trigger,
}: {
  config: LLMConfig;
  pricing: { textP?: PricingEntry; visionP?: PricingEntry };
  trigger: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-edge rounded-2xl p-5 shadow-xl">
        <h2 className="text-sm font-medium text-white">当前配置</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="glass-tile glass-tile-edge rounded-xl p-3">
            <div className="text-xs text-argent-300">文本模型</div>
            <div className="mt-1 font-mono text-sm text-white">{config.model || "未配置"}</div>
            {pricing.textP && (
              <div className="mt-1 text-[11px] text-argent-400">
                输入 ¥{pricing.textP.input}/1K · 输出 ¥{pricing.textP.output}/1K
              </div>
            )}
          </div>
          <div className="glass-tile glass-tile-edge rounded-xl p-3">
            <div className="text-xs text-argent-300">视觉模型</div>
            <div className="mt-1 font-mono text-sm text-white">{config.visionModel || "未配置"}</div>
            {pricing.visionP && (
              <div className="mt-1 text-[11px] text-argent-400">
                输入 ¥{pricing.visionP.input}/1K · 输出 ¥{pricing.visionP.output}/1K
              </div>
            )}
          </div>
        </div>
      </div>
      <UsagePanel refreshTrigger={trigger} />
    </div>
  );
}

// ---------- Tab 5: 关于 ----------

function AboutTab() {
  const techStack = ["Tauri 2.0", "React 18", "Rust", "TypeScript"];
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ available: boolean; version?: string; message: string } | null>(null);

  // 检查更新：通过 Tauri updater 插件查询最新版本
  const handleCheckUpdate = async () => {
    setChecking(true);
    setUpdateInfo(null);
    try {
      // 动态加载 Tauri 插件（浏览器环境会失败并降级提示）
      const updaterModule = "@tauri-apps/plugin-updater";
      const processModule = "@tauri-apps/plugin-process";
      let updater: any;
      let processApi: any;
      try {
        updater = await import(/* @vite-ignore */ updaterModule);
        processApi = await import(/* @vite-ignore */ processModule);
      } catch {
        // 浏览器环境或插件未安装
        setUpdateInfo({
          available: false,
          message: "更新功能仅在桌面应用中可用（需安装版小林 AI）",
        });
        return;
      }
      const update = await updater.check();
      if (update?.available) {
        setUpdateInfo({
          available: true,
          version: update.version,
          message: `发现新版本 v${update.version}，正在下载...`,
        });
        // 下载并安装
        await update.downloadAndInstall();
        // 安装完成后重启应用
        await processApi.relaunch();
      } else {
        setUpdateInfo({
          available: false,
          message: "当前已是最新版本 v1.1.0",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "检查更新失败";
      setUpdateInfo({ available: false, message: msg });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-edge rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="glass-tile glass-tile-strong flex h-14 w-14 items-center justify-center rounded-2xl text-2xl">
            🦊
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">小林 AI</h2>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="rounded-full bg-titanium-500/15 border border-titanium-500/30 px-2 py-0.5 text-[11px] text-titanium-300">
                v1.1.0
              </span>
              <span className="text-xs text-argent-400">桌面 AI 助手</span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-argent-100">
          基于 Tauri 2.0 构建的对话型 AI 助手，能通过工具调用自主操控电脑完成任务。
        </p>
        {/* 检查更新 */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
          <GlassButton variant="primary" onClick={handleCheckUpdate} disabled={checking}>
            {checking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span>{checking ? "检查中..." : "检查更新"}</span>
          </GlassButton>
          {updateInfo && (
            <div className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs",
              updateInfo.available
                ? "bg-titanium-500/15 border border-titanium-500/30 text-titanium-200"
                : "bg-base-900/40 border border-white/10 text-argent-200"
            )}>
              {updateInfo.available ? <CheckCircle2 size={12} /> : <Info size={12} />}
              <span>{updateInfo.message}</span>
            </div>
          )}
        </div>
      </div>

      <div className="glass glass-edge rounded-2xl p-5 shadow-xl">
        <h3 className="text-sm font-medium text-white">技术栈</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {techStack.map((t) => (
            <span key={t}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-xs text-argent-100">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="glass glass-edge rounded-2xl p-5 shadow-xl">
        <h3 className="text-sm font-medium text-white">源代码</h3>
        <a href="https://github.com/2405646728/xiaolin-toolbox" target="_blank" rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-titanium-300 hover:text-titanium-200 underline-offset-2 hover:underline">
          github.com/2405646728/xiaolin-toolbox
        </a>
      </div>

      <div className="glass glass-edge rounded-2xl p-5 shadow-xl">
        <div className="flex items-start gap-2">
          <Shield size={16} className="mt-0.5 shrink-0 text-crimson-400" />
          <div>
            <h3 className="text-sm font-medium text-white">免责声明</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-argent-300">
              本应用可通过 AI 操控电脑执行操作，请谨慎授权危险操作。使用本应用产生的任何后果由用户自行承担。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
