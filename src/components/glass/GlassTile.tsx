// 小元素玻璃组件：用于图标方块、标签、复选框、Toggle、计数徽章等
// 提供 iOS 26 液态玻璃的轻量折射 + 厚度高光 + 可选悬停光斑 + 可选动态光泽
import { forwardRef, type HTMLAttributes, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface GlassTileProps extends HTMLAttributes<HTMLDivElement | HTMLSpanElement> {
  variant?: "default" | "strong";
  edge?: boolean; // 顶部高光边
  hover?: boolean; // 悬停光斑跟随
  shine?: boolean; // 动态光泽流动
  as?: "div" | "span";
}

export const GlassTile = forwardRef<HTMLDivElement, GlassTileProps>(
  (
    {
      className,
      variant = "default",
      edge = true,
      hover = false,
      shine = false,
      as = "div",
      onMouseMove,
      children,
      ...rest
    },
    ref
  ) => {
    const handleMove = (e: MouseEvent<HTMLDivElement>) => {
      if (hover) {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }
      onMouseMove?.(e);
    };
    const Tag = as as "div";
    return (
      <Tag
        ref={ref}
        onMouseMove={handleMove}
        className={cn(
          "relative rounded-xl",
          variant === "default" ? "glass-tile" : "glass-tile-strong",
          edge && "glass-tile-edge",
          hover && "glass-tile-hover",
          shine && "glass-shine",
          className
        )}
        {...rest}
      >
        {children}
      </Tag>
    );
  }
);
GlassTile.displayName = "GlassTile";
