"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const plusDays = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return key(date); };
const plusMonth = () => { const now = new Date(); const last = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate(); return key(new Date(now.getFullYear(), now.getMonth() + 1, Math.min(now.getDate(), last))); };

export function DateChoice({ value, onChange, allowNone = true }: { value: string; onChange: (value: string) => void; allowNone?: boolean }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const todayKey = plusDays(0);
  const quick = [
    ["Сегодня", todayKey], ["Завтра", plusDays(1)], ["Послезавтра", plusDays(2)],
    ["Через 3 дня", plusDays(3)], ["Неделя", plusDays(7)],
    ["Месяц", plusMonth()],
  ];
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (monthStart.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const custom = Boolean(value && !quick.some(([, date]) => date === value));
  const selectedLabel = custom ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`)) : "Выбрать дату";
  return <div className="date-choice">
    <div className="date-options">
      {quick.map(([label, date]) => <button type="button" key={label} className={!open && value === date ? "selected" : ""} onClick={() => { onChange(date); setOpen(false); }}>{label}</button>)}
      <button type="button" className={open || custom ? "selected" : ""} onClick={() => { setMonth(new Date()); setOpen(!open); }} aria-expanded={open}>{selectedLabel}</button>
      {allowNone && <button type="button" className={!open && !value ? "selected" : ""} onClick={() => { onChange(""); setOpen(false); }}>Без срока</button>}
    </div>
    {open && <div className="calendar-panel">
      <div className="calendar-top"><button type="button" aria-label="Предыдущий месяц" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18}/></button><strong>{new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(monthStart)}</strong><button type="button" aria-label="Следующий месяц" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18}/></button></div>
      <div className="calendar-grid">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(day => <span className="weekday" key={day}>{day}</span>)}{Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`}/>)}{Array.from({ length: days }, (_, index) => { const date = new Date(month.getFullYear(), month.getMonth(), index + 1); const dayKey = key(date); return <button type="button" key={dayKey} className={`${dayKey === value ? "selected" : ""} ${dayKey === todayKey ? "today" : ""}`} aria-current={dayKey === todayKey ? "date" : undefined} onClick={() => { onChange(dayKey); setOpen(false); }} aria-label={`${dayKey === todayKey ? "Сегодня, " : ""}${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date)}`}>{index + 1}</button>; })}</div>
    </div>}
  </div>;
}
