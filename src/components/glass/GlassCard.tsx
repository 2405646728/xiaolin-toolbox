// 玻璃卡片基础组件：带高光边与悬停光斑跟随
import { forwardRef, type HTMLAttributes, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong";
  hover?: boolean; // 是否启用光斑跟随
  edge?: boolean; // 是否启用顶部高光边
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", hover = false, edge = true, onMouseMove, children, ...rest }, ref) => {
    const handleMove = (e: MouseEvent<HTMLDivElement>) => {
      if (hover) {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }
      onMouseMove?.(e);
    };
    return (
      <div
        ref={ref}
        onMouseMove={handleMove}
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
