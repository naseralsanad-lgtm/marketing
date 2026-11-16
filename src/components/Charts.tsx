"use client";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compact } from "@/lib/utils";

export const PALETTE = ["#0a84ff", "#30b0c7", "#34c759", "#ff9f0a", "#bf5af2", "#ff375f", "#8e8e93", "#ac8e68"];
type Datum = { name: string; value: number; color?: string };

const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow)", color: "var(--ink)" }, itemStyle: { color: "var(--ink)" }, labelStyle: { color: "var(--ink-2)" } };

export function Donut({ data, format = (n: number) => compact(n), height = 180, center }: { data: Datum[]; format?: (n: number) => string; height?: number; center?: { value: string; label: string } }) {
  const d = data.filter((x) => x.value > 0);
  if (!d.length) return <div className="flex items-center justify-center text-[12.5px] text-ink-3" style={{ height }}>No data yet</div>;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer><PieChart><Pie data={d} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="94%" paddingAngle={d.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>{d.map((x, i) => <Cell key={x.name} fill={x.color ?? PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip {...tip} formatter={(v) => format(Number(v))} /></PieChart></ResponsiveContainer>
        {center && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="num text-[19px] font-semibold">{center.value}</span><span className="text-[11px] text-ink-3">{center.label}</span></div>}
      </div>
      <ul className="min-w-[120px] flex-1 space-y-1.5 text-[12.5px]">
        {d.map((x, i) => <li key={x.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: x.color ?? PALETTE[i % PALETTE.length] }} /><span className="min-w-0 flex-1 truncate text-ink-2">{x.name}</span><span className="num font-medium">{format(x.value)}</span></li>)}
      </ul>
    </div>
  );
}

/** Horizontal share bars — the calm default for distributions. */
export function ShareBars({ data, format = (n: number) => `${Math.round(n * 100)}%`, max, color = "var(--accent)", targets }: { data: Datum[]; format?: (n: number) => string; max?: number; color?: string; targets?: Record<string, number> }) {
  if (!data.length) return <div className="py-6 text-center text-[12.5px] text-ink-3">No data yet</div>;
  const top = max ?? Math.max(...data.map((d) => d.value), ...Object.values(targets ?? {}), 0.0001);
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.name} className="text-[12.5px]">
          <div className="mb-1 flex justify-between gap-3"><span className="truncate text-ink-2">{d.name}</span><span className="num shrink-0 font-medium">{format(d.value)}{targets?.[d.name] != null && <span className="font-normal text-ink-3"> / {format(targets[d.name])}</span>}</span></div>
          <div className="relative h-2 rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (d.value / top) * 100)}%`, background: d.color ?? color }} />
            {targets?.[d.name] != null && <span title="Target" className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ insetInlineStart: `${Math.min(100, (targets[d.name] / top) * 100)}%` }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Columns({ data, format = (n: number) => compact(n), height = 200 }: { data: Datum[]; format?: (n: number) => string; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11.5, fill: "var(--ink-2)" }} axisLine={false} tickLine={false} interval={0} />
          <YAxis hide />
          <Tooltip {...tip} cursor={{ fill: "var(--surface-2)" }} formatter={(v) => format(Number(v))} />
          <Bar dataKey="value" radius={[6, 6, 2, 2]} maxBarSize={56} isAnimationActive={false} label={{ position: "top", fontSize: 11.5, fill: "var(--ink)", formatter: (v: unknown) => format(Number(v)) }}>{data.map((d, i) => <Cell key={i} fill={d.color ?? "var(--accent)"} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
