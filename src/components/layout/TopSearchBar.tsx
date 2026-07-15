// 顶部搜索栏：强玻璃胶囊容器，全局快捷搜索
import { Search, X, Command } from "lucide-react";
import { useModuleStore } from "@/store/useModuleStore";
import { GlassBar } from "@/components/glass/GlassBar";
import { cn } from "@/lib/utils";

export function TopSearchBar() {
  const query = useModuleStore((s) => s.searchQuery);
  const setQuery = useModuleStore((s) => s.setSearchQuery);

  return (
    <GlassBar className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
      <Search className="h-5 w-5 shrink-0 text-titanium-500" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索优化功能…"
        className={cn(
          "flex-1 bg-transparent text-sm text-white placeholder:text-argent-400",
          "focus:outline-none"
        )}
      />
      {query ? (
        <button
          onClick={() => setQuery("")}
          className="rounded-full p-1 text-argent-400 hover:bg-white/10 hover:text-white"
          aria-label="清除搜索"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <kbd className="relative hidden items-center gap-1 rounded-md glass-tile glass-tile-edge px-2 py-0.5 text-[10px] text-argent-300 sm:flex">
          <Command className="h-3 w-3" /> K
        </kbd>
      )}
    </GlassBar>
  );
}
