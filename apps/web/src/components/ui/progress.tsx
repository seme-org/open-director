import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({
  value = 0,
  className,
  indCls,
}: {
  value?: number;
  className?: string;
  indCls?: string;
}) {
  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-zinc-800", className)}>
      <div
        className={cn("h-full w-full flex-1 rounded-full bg-blue-500 transition-all", indCls)}
        style={{ transform: `translateX(-${100 - Math.max(0, Math.min(100, value))}%)` }}
      />
    </div>
  );
}
