// 玻璃卡片基础组件：带高光边
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong";
  hover?: boolean; // 悬停容器（保留类名用于布局）
  edge?: boolean; // 是否启用顶部高光边
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", hover = false, edge = true, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-2xl",
          variant === "default" ? "glass" : "glass-strong",
          edge && "glass-edge",
          hover && "glass-hover",
          className
        )}
        {...rest}
      >
        {children}
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";
