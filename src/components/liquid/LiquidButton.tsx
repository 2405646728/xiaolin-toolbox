// 液态按钮：鼠标在按钮内时黏性跟随 + 接近边缘拉伸变形；
// 鼠标离开瞬间挤出"水滴"并放大、弹簧 Q弹回弹。
import {
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
} from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  type HTMLMotionProps,
} from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

// 排除与 framer-motion 冲突的 drag/animation 等原生属性
type LiquidButtonNativeProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
>;

interface LiquidButtonProps
  extends Omit<HTMLMotionProps<"button">, keyof LiquidButtonNativeProps | "ref">,
    LiquidButtonNativeProps {
  variant?: Variant;
  size?: Size;
  shimmer?: boolean;
}

const sizeMap: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-8 text-base",
};

const variantMap: Record<Variant, string> = {
  primary:
    "text-white bg-gradient-to-br from-titanium-500 to-titanium-700 border-transparent shadow-glow",
  secondary:
    "text-argent-100 glass border-white/15 hover:border-titanium-500/50",
  danger:
    "text-crimson-400 border-crimson-600/50 bg-crimson-600/10 hover:bg-crimson-600/20",
  ghost: "text-argent-300 border-transparent hover:text-white hover:bg-white/5",
};

interface Drip {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
}

export function LiquidButton({
  className,
  variant = "secondary",
  size = "md",
  shimmer = false,
  children,
  onMouseMove,
  onMouseLeave,
  ...rest
}: LiquidButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [drips, setDrips] = useState<Drip[]>([]);
  const dripId = useRef(0);

  // 鼠标相对按钮中心的归一化偏移（-1 ~ 1）
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  // 弹簧平滑跟随（Q弹：stiffness 高、damping 低 → 多次回弹）
  const sx = useSpring(mx, { stiffness: 340, damping: 12, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 340, damping: 12, mass: 0.6 });

  // 黏性位移
  const translateX = useTransform(sx, (v) => v * 7);
  const translateY = useTransform(sy, (v) => v * 7);

  // 接近边缘时非均匀拉伸（水滴被拉长），反向轴收缩守恒体积
  const stretchX = useTransform(sx, [-1, 0, 1], [1.14, 1, 1.14]);
  const stretchY = useTransform(sy, [-1, 0, 1], [1.14, 1, 1.14]);
  const squeezeX = useTransform(sy, [-1, 0, 1], [0.92, 1, 0.92]);
  const squeezeY = useTransform(sx, [-1, 0, 1], [0.92, 1, 0.92]);
  const finalScaleX = useTransform(
    [stretchX, squeezeX],
    ([a, b]: number[]) => a * b
  );
  const finalScaleY = useTransform(
    [stretchY, squeezeY],
    ([a, b]: number[]) => a * b
  );

  // 轻微倾斜
  const rotate = useTransform(sx, (v) => v * 5);

  // 圆角随拉伸变小（水滴尖角感）
  const radius = useTransform([sx, sy], ([vx, vy]: number[]) => {
    const stretch = Math.max(Math.abs(vx), Math.abs(vy));
    return `${Math.round(9999 - stretch * 6000)}px`;
  });

  const handleMove = (e: MouseEvent<HTMLButtonElement>) => {
    onMouseMove?.(e);
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    mx.set((e.clientX - cx) / (rect.width / 2));
    my.set((e.clientY - cy) / (rect.height / 2));
  };

  const handleLeave = (e: MouseEvent<HTMLButtonElement>) => {
    onMouseLeave?.(e);
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const id = dripId.current++;
    setDrips((d) => [
      ...d,
      { id, x, y, dx, dy, size: 16 + Math.random() * 12 },
    ]);
    mx.set(0);
    my.set(0);
    window.setTimeout(() => {
      setDrips((d) => d.filter((it) => it.id !== id));
    }, 800);
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        x: translateX,
        y: translateY,
        scaleX: finalScaleX,
        scaleY: finalScaleY,
        rotate,
        borderRadius: radius,
      }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 overflow-visible rounded-full font-medium tracking-wide",
        "transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-titanium-500/50",
        "disabled:opacity-50 disabled:pointer-events-none",
        sizeMap[size],
        variantMap[variant],
        variant === "primary" && shimmer && "btn-shimmer",
        className
      )}
      {...rest}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      <AnimatePresence>
        {drips.map((d) => (
          <Drip key={d.id} drip={d} />
        ))}
      </AnimatePresence>
    </motion.button>
  );
}

// 水滴：从按钮边缘挤出，沿离开方向飞出 + 放大 + 淡出
function Drip({ drip }: { drip: Drip }) {
  return (
    <motion.span
      initial={{
        x: drip.x - drip.size / 2,
        y: drip.y - drip.size / 2,
        width: drip.size,
        height: drip.size,
        opacity: 0.85,
        scale: 0.3,
      }}
      animate={{
        x: drip.x - drip.size / 2 + drip.dx * 40,
        y: drip.y - drip.size / 2 + drip.dy * 40,
        width: drip.size * 2.6,
        height: drip.size * 2.6,
        opacity: 0,
        scale: 1,
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "absolute",
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.7), rgba(59,110,245,0.45) 50%, transparent 72%)",
        boxShadow:
          "0 0 14px rgba(59,110,245,0.55), inset 0 2px 4px rgba(255,255,255,0.5)",
        filter: "url(#liquid-soft)",
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  );
}
