// 玻璃条带组件：用于顶部搜索栏与底部状态栏的强玻璃容器
import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface GlassBarProps extends HTMLAttributes<HTMLDivElement> {
  flow?: boolean; // 是否启用流光带动画
}

export const GlassBar = forwardRef<HTMLDivElement, GlassBarProps>(
  ({ className, flow = false, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-2xl glass-strong glass-edge",
          flow && "glass-flow",
          className
        )}
        {...rest}
      >
        {children}
      </div>
    );
  }
);
GlassBar.displayName = "GlassBar";
