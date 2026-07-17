// 小林 AI · 用量监控面板
// 今日/本周/本月汇总 + 按模型分组表 + 趋势折线图 + 文本/视觉占比饼图
// iOS 26 液态玻璃风格，SVG 全部自绘（不引入图表库）
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, PieChart, BarChart3, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAllUsage, getUsageToday, getUsageWeek, getUsageMonth,
  getUsageByModel, getUsageTrend, formatTokens, formatCost,
  type UsageRecord, type UsageSummary, type ModelUsage, type DailyUsage,
} from "@/lib/usage";

export interface UsagePanelProps {
  className?: string;
  refreshTrigger?: number; // 外部传入的刷新触发器（如每次 API 调用后 +1）
}

// 图表配色
const TEXT_COLOR = "#60a5fa";   // 文本调用 - 蓝色
const VISION_COLOR = "#c084fc"; // 视觉调用 - 紫色
const TOKEN_COLOR = "#60a5fa";   // tokens 折线 - 蓝色
const COST_COLOR = "#fb923c";    // 费用折线 - 橙色

/** YYYY-MM-DD 截断为 MM-DD */
function formatShortDate(dateStr: string): string {
  const p = dateStr.split("-");
  return p.length === 3 ? `${p[1]}-${p[2]}` : dateStr;
}

/** 极坐标转笛卡尔（0° 指向上方） */
function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** 描述一个扇形 SVG path（顺时针） */
function describeSlice(cx: number, cy: number, r: number, a0: number, a1: number): string {
  if (a1 - a0 >= 360) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
  const s = polarToCartesian(cx, cy, r, a1);
  const e = polarToCartesian(cx, cy, r, a0);
  const large = a1 - a0 <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} Z`;
}

/** 一次性从 usage 模块读取全部所需数据 */
function loadUsageData() {
  return {
    all: getAllUsage(),
    today: getUsageToday(),
    week: getUsageWeek(),
    month: getUsageMonth(),
    byModel: getUsageByModel(),
    trend: getUsageTrend(7),
  };
}

// 数字平滑过渡组件（AnimatePresence + key 切换）
function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="inline-block tabular-nums"
      >
        {format(value)}
      </motion.span>
    </AnimatePresence>
  );
}

// 三栏汇总卡片
function SummaryCard({ title, summary }: { title: string; summary: UsageSummary }) {
  return (
    <div className="glass-tile glass-tile-edge flex flex-col gap-1 rounded-2xl p-5 shadow-xl">
      <span className="text-xs text-white/60">{title}</span>
      <div className="text-3xl font-semibold text-white">
        <AnimatedNumber value={summary.totalTokens} format={formatTokens} />
      </div>
      <div className="text-sm text-argent-300">
        <AnimatedNumber value={summary.cost} format={formatCost} />
      </div>
      <span className="text-xs text-white/40">{summary.count} 次调用</span>
    </div>
  );
}

// 文本 vs 视觉调用占比饼图
function TypePieChart({ records }: { records: UsageRecord[] }) {
  const textCount = records.filter((r) => r.type === "text").length;
  const visionCount = records.filter((r) => r.type === "vision").length;
  const total = textCount + visionCount;
  const cx = 80, cy = 80, r = 60;

  // 计算扇形 path
  const slices: { color: string; d: string }[] = [];
  if (total > 0) {
    let cur = 0;
    if (textCount > 0) {
      const a = (textCount / total) * 360;
      slices.push({ color: TEXT_COLOR, d: describeSlice(cx, cy, r, cur, cur + a) });
      cur += a;
    }
    if (visionCount > 0) {
      const a = (visionCount / total) * 360;
      slices.push({ color: VISION_COLOR, d: describeSlice(cx, cy, r, cur, cur + a) });
    }
  }

  return (
    <div className="glass-tile glass-tile-edge flex flex-col gap-4 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center gap-2">
        <PieChart size={16} className="text-argent-300" />
        <span className="text-sm font-medium text-white/90">调用类型占比</span>
      </div>
      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-xs text-white/40">暂无数据</div>
      ) : (
        <div className="flex items-center gap-5">
          <div className="relative">
            <svg width={160} height={160} viewBox="0 0 160 160">
              {slices.map((s, i) => (
                <path key={i} d={s.d} fill={s.color} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold text-white">{total}</span>
              <span className="text-[10px] text-white/50">总调用</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEXT_COLOR }} />
              <span className="text-white/80">文本调用 {textCount} 次</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: VISION_COLOR }} />
              <span className="text-white/80">视觉调用 {visionCount} 次</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 近 7 天用量趋势折线图（双 Y 轴）
function TrendLineChart({ data }: { data: DailyUsage[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 480, height = 200;
  const padding = { top: 16, right: 44, bottom: 28, left: 44 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxTokens = Math.max(1, ...data.map((d) => d.totalTokens));
  const maxCost = Math.max(0.01, ...data.map((d) => d.cost));
  const xStep = data.length > 1 ? chartW / (data.length - 1) : 0;

  const tokenPts = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartH - (d.totalTokens / maxTokens) * chartH,
  }));
  const costPts = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartH - (d.cost / maxCost) * chartH,
  }));
  const tokenPath = tokenPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const costPath = costPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const hasData = data.some((d) => d.totalTokens > 0 || d.cost > 0);

  // 数据点（tokens + cost）合并渲染，便于悬停联动
  const pointRows = data.map((d, i) => ({ d, i, tp: tokenPts[i], cp: costPts[i] }));

  return (
    <div className="glass-tile glass-tile-edge flex flex-1 flex-col gap-3 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-argent-300" />
        <span className="text-sm font-medium text-white/90">近 7 天用量趋势</span>
      </div>
      {!hasData ? (
        <div className="flex flex-1 items-center justify-center py-8 text-xs text-white/40">暂无数据</div>
      ) : (
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          {/* 网格线 + 左右 Y 轴刻度 */}
          {yTicks.map((t, i) => {
            const y = padding.top + chartH - t * chartH;
            return (
              <g key={i}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y}
                  stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />
                <text x={padding.left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.5)">
                  {formatTokens(t * maxTokens)}
                </text>
                <text x={width - padding.right + 6} y={y + 3} textAnchor="start" fontSize={9} fill="rgba(255,255,255,0.5)">
                  {formatCost(t * maxCost)}
                </text>
              </g>
            );
          })}
          {/* X 轴日期 */}
          {data.map((d, i) => (
            <text key={i} x={padding.left + i * xStep} y={height - 8}
              textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.5)">
              {formatShortDate(d.date)}
            </text>
          ))}
          {/* tokens 折线 */}
          <path d={tokenPath} fill="none" stroke={TOKEN_COLOR} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round" />
          {/* cost 折线 */}
          <path d={costPath} fill="none" stroke={COST_COLOR} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round" />
          {/* 数据点（悬停联动同一索引） */}
          {pointRows.map(({ i, tp, cp }) => (
            <g key={i}>
              <circle cx={tp.x} cy={tp.y} r={hoverIdx === i ? 4 : 3} fill={TOKEN_COLOR}
                stroke="rgba(0,0,0,0.4)" strokeWidth={1} className="cursor-pointer"
                onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} />
              <circle cx={cp.x} cy={cp.y} r={hoverIdx === i ? 4 : 3} fill={COST_COLOR}
                stroke="rgba(0,0,0,0.4)" strokeWidth={1} className="cursor-pointer"
                onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} />
            </g>
          ))}
          {/* 悬停辅助线 + Tooltip */}
          {hoverIdx !== null && (() => {
            const d = data[hoverIdx];
            const tipW = 112, tipH = 50;
            const tipX = Math.max(padding.left, Math.min(tokenPts[hoverIdx].x - tipW / 2, width - padding.right - tipW));
            const tipY = padding.top + 4;
            return (
              <g>
                <line x1={tokenPts[hoverIdx].x} y1={padding.top} x2={tokenPts[hoverIdx].x}
                  y2={padding.top + chartH} stroke="rgba(255,255,255,0.2)" strokeDasharray="2 2" />
                <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={6}
                  fill="rgba(0,0,0,0.85)" stroke="rgba(255,255,255,0.15)" />
                <text x={tipX + 8} y={tipY + 14} fontSize={9} fill="rgba(255,255,255,0.6)">
                  {formatShortDate(d.date)}
                </text>
                <circle cx={tipX + 11} cy={tipY + 28} r={3} fill={TOKEN_COLOR} />
                <text x={tipX + 19} y={tipY + 31} fontSize={9} fill="rgba(255,255,255,0.9)">
                  {formatTokens(d.totalTokens)} tokens
                </text>
                <circle cx={tipX + 11} cy={tipY + 42} r={3} fill={COST_COLOR} />
                <text x={tipX + 19} y={tipY + 45} fontSize={9} fill="rgba(255,255,255,0.9)">
                  {formatCost(d.cost)}
                </text>
              </g>
            );
          })()}
        </svg>
      )}
      {/* 图例 */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-3" style={{ background: TOKEN_COLOR }} />
          <span className="text-white/60">Tokens</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-3" style={{ background: COST_COLOR }} />
          <span className="text-white/60">费用</span>
        </div>
      </div>
    </div>
  );
}

// 按模型分组表格（按总 tokens 降序，usage.ts 已排序）
function ModelTable({ models }: { models: ModelUsage[] }) {
  return (
    <div className="glass-tile glass-tile-edge overflow-hidden rounded-2xl shadow-xl">
      <div className="flex items-center gap-2 p-5 pb-3">
        <BarChart3 size={16} className="text-argent-300" />
        <span className="text-sm font-medium text-white/90">按模型分组</span>
      </div>
      {models.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-xs text-white/40">暂无数据</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white/5 text-white/60">
                <th className="px-4 py-2 text-left font-medium">模型</th>
                <th className="px-4 py-2 text-right font-medium">调用次数</th>
                <th className="px-4 py-2 text-right font-medium">输入 tokens</th>
                <th className="px-4 py-2 text-right font-medium">输出 tokens</th>
                <th className="px-4 py-2 text-right font-medium">总 tokens</th>
                <th className="px-4 py-2 text-right font-medium">费用</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m, i) => (
                <tr key={i} className="border-t border-white/5 text-white/80">
                  <td className="px-4 py-2 text-left font-mono">{m.model}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatTokens(m.promptTokens)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatTokens(m.completionTokens)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-white">{formatTokens(m.totalTokens)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-argent-300">{formatCost(m.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 空状态
function EmptyState() {
  return (
    <div className="glass-tile glass-tile-edge flex flex-col items-center justify-center gap-4 rounded-2xl py-20 shadow-xl">
      <div className="glass-tile glass-tile-edge flex h-16 w-16 items-center justify-center rounded-2xl text-argent-300">
        <MessageCircle size={28} />
      </div>
      <p className="text-sm text-white/50">还没有用量数据，先去和小林 AI 对话吧</p>
    </div>
  );
}

// 主组件
export function UsagePanel({ className, refreshTrigger = 0 }: UsagePanelProps) {
  // mount 时读取一次
  const [data, setData] = useState(loadUsageData);
  // refreshTrigger 变化时重新读取
  useEffect(() => {
    setData(loadUsageData());
  }, [refreshTrigger]);
  // 缓存空状态判定
  const isEmpty = useMemo(() => data.all.length === 0, [data]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* 顶部三栏汇总 */}
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard title="今日" summary={data.today} />
            <SummaryCard title="本周" summary={data.week} />
            <SummaryCard title="本月" summary={data.month} />
          </div>
          {/* 中部：饼图 + 折线图 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
            <TypePieChart records={data.all} />
            <TrendLineChart data={data.trend} />
          </div>
          {/* 底部：模型分组表 */}
          <ModelTable models={data.byModel} />
        </>
      )}
    </div>
  );
}

export default UsagePanel;
