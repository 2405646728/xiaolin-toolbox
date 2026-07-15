// 模块图标映射：将模块元数据中的字符串图标名映射到 lucide-react 组件
import {
  Trash2,
  Database,
  Rocket,
  HardDrive,
  Cpu,
  Package,
  Info,
  Terminal,
  Smartphone,
  BatteryCharging,
  Activity,
  Power,
  Lock,
  ShieldAlert,
  KeyRound,
  Files,
  Zap,
  EyeOff,
  Wifi,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Trash2,
  Database,
  Rocket,
  HardDrive,
  Cpu,
  Package,
  Info,
  Terminal,
  Smartphone,
  BatteryCharging,
  Activity,
  Power,
  Lock,
  ShieldAlert,
  KeyRound,
  Files,
  Zap,
  EyeOff,
  Wifi,
  ShieldCheck,
};

export function ModuleIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = iconMap[name] ?? Info;
  return <Icon className={className} />;
}
