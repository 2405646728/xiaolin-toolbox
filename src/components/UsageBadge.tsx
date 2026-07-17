// 小林 AI · 状态栏用量徽章
// 显示当前会话或今日的 API 用量（tokens + 费用），悬停查看分项明细
// 超出每日费用上限时红色高亮 + 闪烁动画
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAllUsage, getUsageToday, getUsageByConversation,
  formatTokens, formatCost,
  type UsageSummary,
} from "@/lib/usage";

export interface UsageBadgeProps {
  conversationId?: string;     // 当前对话 ID，提供时只统计该对话用量
  refreshTrigger?: number;     // 刷新触发器
  dailyLimitYuan?: number;     // 每日费用上限，超限红色高亮
  className?: string;
}

interface BadgeData {
  summary: UsageSummary;
  modelDist: { model: string; count: number }[];
  todayCost: number; // 今日费用（用于超限判定，始终基于今日）
}

/** 今日 00:00 时间戳（本地时区） */
function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 加载徽章所需数据：汇总 + 模型分布 + 今日费用 */
function loadBadgeData(conversationId?: string): BadgeData {
  const todaySummary = getUsageToday();
  const summary = conversationId
    ? getUsageByConversation(conversationId)
    : todaySummary;
  // 模型分布：按 conversationId 过滤或按今日过滤
  const all = getAllUsage();
  const filtered = conversationId
    ? all.filter((r) => r.conversationId === conversationId)
    : all.filter((r) => r.timestamp >= startOfToday());
  const map = new Map<string, number>();
  for (const r of filtered) {
    map.set(r.model, (map.get(r.model) || 0) + 1);
  }
  const modelDist = Array.from(map.entries())
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count);
  return { summary, modelDist, todayCost: todaySummary.cost };
}

/** 数字平滑过渡组件 */
function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className={cn("inline-block tabular-nums", className)}
      >
        {format(value)}
      </motion.span>
    </AnimatePresence>
  );
}

/** tooltip 行 */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/50">{label}</span>
      <span className="tabular-nums text-white/85">{value}</span>
    </div>
  );
}

export function UsageBadge({
  conversationId,
  refreshTrigger = 0,
  dailyLimitYuan,
  className,
}: UsageBadgeProps) {
  const [data, setData] = useState<BadgeData>(() => loadBadgeData(conversationId));

  useEffect(() => {
    setData(loadBadgeData(conversationId));
  }, [conversationId, refreshTrigger]);

  // 超限判定：始终基于今日费用（非会话费用）
  const exceeded = useMemo(
    () => (dailyLimitYuan ? data.todayCost >= dailyLimitYuan : false),
    [dailyLimitYuan, data.todayCost]
  );

  const { summary, modelDist } = data;
  const scopeLabel = conversationId ? "本对话用量" : "今日用量";

  return (
    <div className={cn("group relative inline-flex", className)}>
      <motion.div
        className={cn(
          "glass-tile glass-tile-edge flex h-7 cursor-help items-center gap-1.5 rounded-full px-2.5 text-xs",
          exceeded && "ring-1 ring-red-500/70"
        )}
        animate={exceeded ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
        transition={
          exceeded
            ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
        }
      >
        {/* 状态点：绿色正常 / 红色超限闪烁 */}
        <motion.span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            exceeded ? "bg-red-500" : "bg-emerald-400"
          )}
          animate={exceeded ? { scale: [1, 1.4, 1] } : {}}
          transition={exceeded ? { duration: 1.2, repeat: Infinity } : {}}
        />
        <Activity size={11} className="shrink-0 text-argent-300" />
        <AnimatedNumber
          value={summary.totalTokens}
          format={formatTokens}
          className="text-white/90"
        />
        <span className="text-white/40">tokens</span>
        <span className="text-white/30">·</span>
        <AnimatedNumber
          value={summary.cost}
          format={formatCost}
          className={exceeded ? "text-red-400" : "text-argent-300"}
        />
      </motion.div>

      {/* 悬停 tooltip：分项明细（glass-tile 玻璃风格） */}
      <div className="pointer-events-none absolute right-0 top-full z-50 mt-1.5 w-56 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <div className="glass-tile glass-tile-edge rounded-xl p-3 text-xs shadow-2xl">
          <div className="mb-2 flex items-center gap-1.5 text-white/70">
            <TrendingUp size={11} className="text-argent-300" />
            <span className="font-medium">{scopeLabel}</span>
          </div>
          <div className="flex flex-col gap-1">
            <Row label="输入 tokens" value={summary.promptTokens.toLocaleString()} />
            <Row label="输出 tokens" value={summary.completionTokens.toLocaleString()} />
            <Row label="图片 tokens" value={(summary.imageTokens || 0).toLocaleString()} />
            <Row label="调用次数" value={String(summary.count)} />
          </div>
          {modelDist.length > 0 && (
            <div className="mt-2 border-t border-white/10 pt-2">
              <div className="mb-1 text-white/50">模型分布</div>
              <div className="flex flex-col gap-0.5">
                {modelDist.slice(0, 5).map((m) => (
                  <div
                    key={m.model}
                    className="flex items-center justify-between text-white/75"
                  >
                    <span className="truncate font-mono pr-2">{m.model}</span>
                    <span className="tabular-nums shrink-0">{m.count} 次</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UsageBadge;
