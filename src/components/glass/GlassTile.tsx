// 小元素玻璃组件：用于图标方块、标签、复选框、Toggle、计数徽章等
// 提供 iOS 26 液态玻璃的轻量折射 + 厚度高光 + 可选动态光泽
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassTileProps extends HTMLAttributes<HTMLDivElement | HTMLSpanElement> {
  variant?: "default" | "strong";
  edge?: boolean; // 顶部高光边
  hover?: boolean; // 悬停容器（保留类名用于布局）
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
      children,
      ...rest
    },
    ref
  ) => {
    const Tag = as as "div";
    return (
      <Tag
        ref={ref}
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
