"use client";

import { useEffect, useState } from "react";
import { DateChoice } from "./date-choice";

type Mode = "none" | "soon" | "hour" | "tomorrow" | "custom" | "before";
const MOSCOW_OFFSET = 3 * 60 * 60 * 1000;
const moscowParts = (iso: string) => new Date(Date.parse(iso) + MOSCOW_OFFSET).toISOString().slice(0, 16);
const tomorrowMorning = () => {
  const now = new Date(Date.now() + MOSCOW_OFFSET);
  now.setUTCDate(now.getUTCDate() + 1);
  return new Date(`${now.toISOString().slice(0, 10)}T09:00:00+03:00`).toISOString();
};

export function ReminderChoice({ remindAt, remindMinutes, dueDate, onChange }: {
  remindAt: string;
  remindMinutes: string;
  dueDate: string;
  onChange: (at: string, minutes: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(() => remindAt ? "custom" : remindMinutes ? "before" : "none");
  const initial = remindAt ? moscowParts(remindAt) : moscowParts(tomorrowMorning());
  const [customDate, setCustomDate] = useState(initial.slice(0, 10));
  const [customTime, setCustomTime] = useState(initial.slice(11, 16));

  useEffect(() => {
    if (!dueDate && mode === "before") { setMode("none"); onChange("", ""); }
  }, [dueDate, mode, onChange]);

  const exact = (date: string, time: string) => {
    if (!date || !time) return;
    onChange(new Date(`${date}T${time}:00+03:00`).toISOString(), "");
  };
  const select = (next: Mode) => {
    setMode(next);
    if (next === "none") onChange("", "");
    if (next === "soon" || next === "hour" || next === "tomorrow") {
      const at = next === "soon" ? new Date(Date.now() + 15 * 60_000).toISOString()
        : next === "hour" ? new Date(Date.now() + 60 * 60_000).toISOString() : tomorrowMorning();
      const local = moscowParts(at);
      setCustomDate(local.slice(0, 10));
      setCustomTime(local.slice(11, 16));
      onChange(at, "");
    }
    if (next === "custom") exact(customDate, customTime);
    if (next === "before") onChange("", remindMinutes || "60");
  };

  return <div className="reminder-field">
    <div className="field-label">Напомнить в Telegram</div>
    <div className="reminder-options">
      {([[
        "Не нужно", "none"], ["Через 15 мин", "soon"], ["Через час", "hour"],
        ["Завтра в 9:00", "tomorrow"], ["Дата и время", "custom"],
        ...(dueDate ? [["До срока", "before"]] : []),
      ] as [string, Mode][]).map(([label, value]) => <button type="button" key={value} className={mode === value ? "selected" : ""} onClick={() => select(value)}>{label}</button>)}
    </div>
    {mode === "custom" && <div className="reminder-custom"><DateChoice value={customDate} onChange={date => { setCustomDate(date); exact(date, customTime); }} allowNone={false}/><label>Время<input type="time" value={customTime} onChange={event => { setCustomTime(event.target.value); exact(customDate, event.target.value); }}/></label></div>}
    {mode === "before" && dueDate && <select className="reminder-before" aria-label="За сколько до срока напомнить" value={remindMinutes || "60"} onChange={event => onChange("", event.target.value)}><option value="5">За 5 минут</option><option value="15">За 15 минут</option><option value="30">За 30 минут</option><option value="60">За 1 час</option><option value="180">За 3 часа</option><option value="1440">За 1 день</option></select>}
  </div>;
}
