// 玻璃按钮组件：主按钮（钛金橙渐变）、次按钮（玻璃描边）、危险按钮（深朱红）
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  shimmer?: boolean; // 主按钮流光
}

const sizeMap: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-8 text-base",
};

const variantMap: Record<Variant, string> = {
  primary:
    "text-white bg-gradient-to-br from-titanium-500 to-titanium-700 border-transparent shadow-glow hover:from-titanium-400 hover:to-titanium-600",
  secondary:
    "text-argent-100 glass border-white/15 hover:border-titanium-500/50 hover:text-white",
  danger:
    "text-crimson-400 border-crimson-600/50 bg-crimson-600/10 hover:bg-crimson-600/20 hover:text-crimson-500",
  ghost:
    "text-argent-300 border-transparent hover:text-white hover:bg-white/5",
};

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = "secondary", size = "md", shimmer = false, children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide",
          "transition-all duration-200 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-titanium-500/50",
          "disabled:opacity-50 disabled:pointer-events-none",
          sizeMap[size],
          variantMap[variant],
          variant === "primary" && shimmer && "btn-shimmer",
          className
        )}
        {...rest}
      >
        {children}
      </button>
    );
  }
);
GlassButton.displayName = "GlassButton";
