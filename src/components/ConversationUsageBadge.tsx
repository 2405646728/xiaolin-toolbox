// 小林 AI · 对话侧栏用量徽章
// 极简显示单个对话的 token 数与费用，悬停查看模型分布
import { useEffect, useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAllUsage, getUsageByConversation,
  formatTokens, formatCost,
} from "@/lib/usage";

export interface ConversationUsageBadgeProps {
  conversationId: string;
  refreshTrigger?: number;
  className?: string;
}

interface ConvData {
  totalTokens: number;
  cost: number;
  modelDist: { model: string; count: number }[];
}

/** 加载对话用量数据：汇总 + 模型分布 */
function loadConvData(conversationId: string): ConvData {
  const summary = getUsageByConversation(conversationId);
  const records = getAllUsage().filter((r) => r.conversationId === conversationId);
  const map = new Map<string, number>();
  for (const r of records) {
    map.set(r.model, (map.get(r.model) || 0) + 1);
  }
  const modelDist = Array.from(map.entries())
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count);
  return {
    totalTokens: summary.totalTokens,
    cost: summary.cost,
    modelDist,
  };
}

export function ConversationUsageBadge({
  conversationId,
  refreshTrigger = 0,
  className,
}: ConversationUsageBadgeProps) {
  const [data, setData] = useState<ConvData>(() => loadConvData(conversationId));

  useEffect(() => {
    setData(loadConvData(conversationId));
  }, [conversationId, refreshTrigger]);

  // tooltip 文本：模型分布
  const title = useMemo(() => {
    if (data.modelDist.length === 0) return "";
    return data.modelDist.map((m) => `${m.model}: ${m.count}次`).join(" · ");
  }, [data.modelDist]);

  // 用量 = 0 时返回 null
  if (data.totalTokens === 0) return null;

  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-[18px] items-center gap-0.5 text-[11px] text-white/40",
        className
      )}
    >
      <Zap size={9} className="shrink-0 text-argent-300/60" />
      <span className="tabular-nums">{formatTokens(data.totalTokens)}</span>
      <span className="text-white/20">·</span>
      <span className="tabular-nums">{formatCost(data.cost)}</span>
    </span>
  );
}

export default ConversationUsageBadge;
