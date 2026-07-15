// 模块网格：响应式列数，桌面 4 列 / 平板 3 列 / 手机 2 列
import { type ModuleMeta } from "@/data/modules";
import { ModuleCard } from "@/components/modules/ModuleCard";

interface ModuleGridProps {
  modules: ModuleMeta[];
  emptyHint?: string;
}

export function ModuleGrid({ modules, emptyHint }: ModuleGridProps) {
  if (modules.length === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-xl glass-tile glass-tile-edge text-sm text-argent-500">
        {emptyHint ?? "无匹配模块"}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {modules.map((m, i) => (
        <ModuleCard key={m.id} module={m} index={i} />
      ))}
    </div>
  );
}
