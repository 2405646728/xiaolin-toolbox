// 小林 AI · 对话历史侧栏
// 新建 / 切换 / 删除对话 + 每条用量徽章 · iOS 26 液态玻璃 + 宽度过渡（280/48）
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
  MessageCircle,
} from "lucide-react";
import { LiquidButton } from "@/components/liquid/LiquidButton";
import { GlassButton } from "@/components/glass/GlassButton";
import { ConversationUsageBadge } from "./ConversationUsageBadge";
import { listConversations, type Conversation } from "@/lib/conversations";
import { cn } from "@/lib/utils";

export interface ConversationSidebarProps {
  open: boolean;                          // 侧栏是否展开
  onToggle?: () => void;                  // 折叠 / 展开切换
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  refreshTrigger?: number;                // 用量刷新触发器
  className?: string;
}

const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 48;

/** 相对时间格式化：刚刚 / N 分钟前 / N 小时前 / 昨天 / 同年省略年份 */
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "刚刚";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  if (diff < 172800_000) return "昨天";
  const d = new Date(timestamp);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function ConversationSidebar({
  open,
  onToggle,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  refreshTrigger = 0,
  className,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // 拉取对话列表（按 updatedAt 降序）
  useEffect(() => {
    setConversations(listConversations());
  }, [refreshTrigger, open]);

  return (
    <motion.aside
      initial={false}
      animate={{ width: open ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className={cn(
        "glass-tile glass-tile-edge relative h-full shrink-0 overflow-hidden",
        className
      )}
    >
      {/* 展开态：完整内容（固定宽度，避免动画期间文字重排） */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-y-0 left-0 flex w-[280px] flex-col"
          >
            {/* 顶部操作区：新建对话 + 折叠按钮 */}
            <div className="flex shrink-0 items-center gap-2 p-3">
              <LiquidButton
                size="sm"
                variant="primary"
                onClick={onNewConversation}
                className="flex-1"
                title="新建对话"
              >
                <Plus className="h-4 w-4" />
                <span>新建对话</span>
              </LiquidButton>
              <GlassButton
                size="sm"
                variant="secondary"
                onClick={onToggle}
                className="shrink-0 px-2.5"
                title="折叠侧栏"
              >
                <PanelLeftClose className="h-4 w-4" />
              </GlassButton>
            </div>

            {/* 对话列表 / 空状态 */}
            {conversations.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-argent-500">
                <MessageCircle className="h-8 w-8 text-argent-500/60" />
                <p className="text-xs">还没有对话，点击上方按钮新建</p>
              </div>
            ) : (
              <div
                className={cn(
                  "flex-1 overflow-y-auto px-2 pb-3",
                  // 细线滚动条
                  "[&::-webkit-scrollbar]:w-1.5",
                  "[&::-webkit-scrollbar-thumb]:rounded-full",
                  "[&::-webkit-scrollbar-thumb]:bg-white/15",
                  "[&::-webkit-scrollbar-thumb:hover]:bg-white/25",
                  "[&::-webkit-scrollbar-track]:bg-transparent"
                )}
              >
                <div className="flex flex-col gap-1">
                  {conversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      active={conv.id === currentConversationId}
                      refreshTrigger={refreshTrigger}
                      onSelect={() => onSelectConversation(conv.id)}
                      onDelete={() => onDeleteConversation(conv.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 折叠态：浮动展开按钮 */}
      <AnimatePresence initial={false}>
        {!open && (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-y-0 left-0 flex w-[48px] flex-col items-center pt-3"
          >
            <GlassButton
              size="sm"
              variant="secondary"
              onClick={onToggle}
              className="shrink-0 px-2.5"
              title="展开侧栏"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </GlassButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}

// 对话条目：标题 + 时间 + 用量徽章 + 悬停删除
interface ConversationItemProps {
  conversation: Conversation;
  active: boolean;
  refreshTrigger: number;
  onSelect: () => void;
  onDelete: () => void;
}

function ConversationItem({
  conversation,
  active,
  refreshTrigger,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2 transition-colors",
        active ? "glass-tile-strong" : "hover:bg-white/10"
      )}
    >
      {/* 选中态：左侧橙色竖线（绝对定位，避免与 glass-tile-strong 的边框冲突） */}
      {active && (
        <span className="absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-r bg-titanium-500" />
      )}

      {/* 标题 + 删除按钮 */}
      <div className="flex items-center gap-1">
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs font-medium",
            active ? "text-white" : "text-argent-100"
          )}
          title={conversation.title}
        >
          {conversation.title}
        </span>
        {/* 删除按钮：悬停时显示 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={cn(
            "shrink-0 rounded p-0.5 text-argent-500 opacity-0 transition",
            "hover:bg-crimson-600/20 hover:text-crimson-400",
            "group-hover:opacity-100 focus:opacity-100"
          )}
          title="删除对话"
          aria-label="删除对话"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 时间 + 用量徽章 */}
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-[10px] text-argent-500">
          {formatRelativeTime(conversation.updatedAt)}
        </span>
        <ConversationUsageBadge
          conversationId={conversation.id}
          refreshTrigger={refreshTrigger}
        />
      </div>
    </div>
  );
}
export default ConversationSidebar;
