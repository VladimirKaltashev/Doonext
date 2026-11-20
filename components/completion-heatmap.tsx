"use client";

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function CompletionHeatmap({ dates, selected, onSelect, now }: { dates: Array<string | null>; selected: string | null; onSelect: (day: string | null) => void; now: Date }) {
  const counts = new Map<string, number>();
  for (const completedAt of dates) if (completedAt) { const day = dateKey(new Date(completedAt)); counts.set(day, (counts.get(day) ?? 0) + 1); }
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  first.setDate(first.getDate() - (first.getDay() + 6) % 7 - 15 * 7);
  const cells = Array.from({ length: 16 * 7 }, (_, index) => { const date = new Date(first); date.setDate(first.getDate() + index); return { day: dateKey(date), date, count: counts.get(dateKey(date)) ?? 0 }; });
  return <div className="heatmap-wrap"><div className="heatmap-head"><span>Последние 16 недель</span>{selected && <button type="button" onClick={() => onSelect(null)}>Все дни</button>}</div><div className="heatmap-scroll"><div className="heatmap-grid">{cells.map(({ day, date, count }) => <button type="button" key={day} className={`heatmap-cell level-${Math.min(count, 4)} ${selected === day ? "selected" : ""} ${day > dateKey(now) ? "future" : ""}`} aria-label={`${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date)}: ${count} задач`} title={`${day}: ${count}`} onClick={() => onSelect(selected === day ? null : day)}/>)}</div></div></div>;
}
