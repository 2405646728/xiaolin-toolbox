// 泪水放大镜：跟随鼠标/触摸的圆形玻璃放大镜，带折射光环 + Q弹拉伸形变。
// 快速移动时拉伸成水滴形，停留时回正放大；离开容器时淡出。
import { useEffect, useState, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";

interface MagnifierProps {
  containerRef: React.RefObject<HTMLElement | null>;
  size?: number; // 放大镜直径
  zoom?: number; // 内部放大倍数（视觉模拟）
  children?: ReactNode; // 放大镜内的装饰内容
}

export function Magnifier({
  containerRef,
  size = 120,
  zoom = 1.6,
  children,
}: MagnifierProps) {
  const [active, setActive] = useState(false);
  const visible = useMotionValue(0); // 0~1 透明度

  // 位置（弹簧 Q弹跟随）
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const sx = useSpring(x, { stiffness: 400, damping: 18, mass: 0.7 });
  const sy = useSpring(y, { stiffness: 400, damping: 18, mass: 0.7 });

  // 速度驱动形变：移动越快越拉伸成水滴
  const vx = useVelocity(sx);
  const vy = useVelocity(sy);
  const speed = useTransform(
    [vx, vy],
    ([a, b]: number[]) => Math.sqrt(a * a + b * b)
  );
  const stretchX = useTransform(speed, [0, 2000], [1, 1.35]);
  const stretchY = useTransform(speed, [0, 2000], [1, 0.7]);

  // 旋转方向跟随速度
  const rotate = useTransform([vx, vy], ([a, b]: number[]) => {
    return Math.atan2(b, a) * (180 / Math.PI);
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const move = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      const inside =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;
      if (inside) {
        x.set(clientX - size / 2);
        y.set(clientY - size / 2);
        if (!active) {
          setActive(true);
          visible.set(1);
        }
      } else if (active) {
        setActive(false);
        visible.set(0);
      }
    };

    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onLeave = () => {
      setActive(false);
      visible.set(0);
    };

    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("touchend", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("touchend", onLeave);
    };
  }, [containerRef, size, active, x, y, visible]);

  const opacity = useSpring(visible, { stiffness: 300, damping: 25 });
  const innerScale = useTransform(stretchX, (v) => zoom / v);

  return (
    <motion.div
      style={{
        x: sx,
        y: sy,
        scaleX: stretchX,
        scaleY: stretchY,
        rotate,
        opacity,
        width: size,
        height: size,
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 50,
        borderRadius: "50%",
        overflow: "hidden",
        backdropFilter: `blur(2px) saturate(180%) brightness(1.1)`,
        WebkitBackdropFilter: `blur(2px) saturate(180%) brightness(1.1)`,
        background:
          "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.18), rgba(255,110,64,0.06) 60%, rgba(0,0,0,0.12))",
        border: "1.5px solid rgba(255,255,255,0.35)",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.4), inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,110,64,0.15)",
      }}
    >
      {/* 放大镜内部放大装饰层 */}
      <motion.div
        style={{
          scale: innerScale,
          transformOrigin: "center",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </motion.div>
      {/* 顶部高光（泪水反光） */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: "22%",
          width: "30%",
          height: "22%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.7), transparent 70%)",
          filter: "blur(2px)",
        }}
      />
    </motion.div>
  );
}
