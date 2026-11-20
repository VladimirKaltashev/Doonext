"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, History, Plus, X } from "lucide-react";
import { DateChoice } from "../components/date-choice";
import { CompletionHeatmap } from "../components/completion-heatmap";
import { TelegramLogin } from "../components/telegram-login";

type TelegramWebApp = { initData: string; ready: () => void; expand: () => void; showConfirm?: (message: string, callback: (confirmed: boolean) => void) => void };
declare global { interface Window { Telegram?: { WebApp: TelegramWebApp } } }
const telegramHeaders = () => ({ "x-telegram-init-data": window.Telegram?.WebApp?.initData ?? "" });

type Task = { id: string; title: string; dueDate: string | null; dueTime: string | null; estimateMinutes: number | null; remindMinutes: number | null; priority: number; parentId: string | null; completed: boolean; completedAt: string | null; inProgress: boolean; createdAt: string };
const dateKey = (d: Date) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return dateKey(d); };
const niceDate = (value: string) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(value + "T12:00:00"));
const deadlineKey = (task: Task) => task.dueDate ? `${task.dueDate}T${task.dueTime ?? "99:99"}` : null;
const sortTasks = (a: Task, b: Task) => (deadlineKey(a) ?? "9999").localeCompare(deadlineKey(b) ?? "9999") || a.priority - b.priority || a.createdAt.localeCompare(b.createdAt);
const estimateText = (minutes: number) => minutes <= 30 ? "до 30 мин" : minutes <= 60 ? "до 1 ч" : minutes <= 120 ? "до 2 ч" : "больше 2 ч";
const estimateGroup = (minutes: number) => minutes <= 30 ? 20 : minutes <= 60 ? 60 : minutes <= 120 ? 120 : 180;
const urgency = (task: Task, tomorrowKey: string) => {
  if (task.priority === 0) return 0;
  if (!task.dueDate || task.dueDate > tomorrowKey) return task.priority;
  if (task.priority === 1 && task.parentId) return 0;
  if (task.priority === 3) return 1;
  return task.priority;
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [signin, setSignin] = useState(false);
  const [canImport, setCanImport] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"tasks" | "history">("tasks");
  const [selectedHistoryDay, setSelectedHistoryDay] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState("");
  const [remindMinutes, setRemindMinutes] = useState("");
  const [priority, setPriority] = useState(2);
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/tasks", { cache: "no-store", headers: telegramHeaders() });
      if (response.status === 401) { setSignin(true); return; }
      const data = await response.json() as { tasks: Task[]; canImport?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error);
      setTasks(data.tasks); setCanImport(Boolean(data.canImport)); setSignin(false); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить задачи"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { window.Telegram?.WebApp?.ready(); window.Telegram?.WebApp?.expand(); void refresh(); }, [refresh]);
  const openNew = (parent = "") => { setEditing(null); setTitle(""); setDueDate(""); setDueTime(""); setEstimateMinutes(""); setRemindMinutes(""); setPriority(2); setParentId(parent); setDialog(true); };
  const openEdit = (task: Task) => { setEditing(task); setTitle(task.title); setDueDate(task.dueDate ?? ""); setDueTime(task.dueTime ?? ""); setEstimateMinutes(task.estimateMinutes?.toString() ?? ""); setRemindMinutes(task.remindMinutes?.toString() ?? ""); setPriority(task.priority); setParentId(task.parentId ?? ""); setDialog(true); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!title.trim()) return; setSaving(true);
    try {
      const response = await fetch(editing ? `/api/tasks/${editing.id}` : "/api/tasks", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json", ...telegramHeaders() }, body: JSON.stringify({ title, dueDate: dueDate || null, dueTime: dueDate && dueTime ? dueTime : null, estimateMinutes: estimateMinutes ? Number(estimateMinutes) : null, remindMinutes: dueDate && remindMinutes ? Number(remindMinutes) : null, priority, ...(editing ? {} : { parentId: parentId || null }) }) });
      const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error);
      setDialog(false); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить"); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!editing) return;
    const count = tasks.filter(task => task.parentId === editing.id).length;
    const prompt = count ? `Удалить задачу и ${count} подзадач?` : "Удалить задачу навсегда?";
    const confirmed = window.Telegram?.WebApp?.showConfirm ? await new Promise<boolean>(resolve => window.Telegram!.WebApp.showConfirm!(prompt, resolve)) : window.confirm(prompt);
    if (!confirmed) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/tasks/${editing.id}`, { method: "DELETE", headers: telegramHeaders() });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error);
      setDialog(false); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось удалить задачу"); }
    finally { setDeleting(false); }
  };
  const toggle = async (task: Task, field: "completed" | "inProgress") => {
    setTasks(current => current.map(item => item.id === task.id ? { ...item, [field]: !task[field] } : item));
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...telegramHeaders() }, body: JSON.stringify({ [field]: !task[field] }) });
      if (!response.ok) throw new Error(); await refresh();
    } catch { await refresh(); setError("Не удалось обновить задачу"); }
  };
  const claimImport = async (event: React.FormEvent) => {
    event.preventDefault(); setImporting(true);
    try {
      const response = await fetch("/api/migration/claim", { method: "POST", headers: { "Content-Type": "application/json", ...telegramHeaders() }, body: JSON.stringify({ code: importCode }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error);
      setImportDialog(false); setImportCode(""); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось перенести задачи"); }
    finally { setImporting(false); }
  };
  const effectiveKey = (task: Task) => {
    const own = deadlineKey(task);
    const childKeys = tasks.filter(t => t.parentId === task.id && !t.completed).map(deadlineKey).filter((key): key is string => Boolean(key));
    return [own, ...childKeys].filter((key): key is string => Boolean(key)).sort()[0] ?? null;
  };
  const roots = useMemo(() => tasks.filter(t => !t.parentId).sort((a,b) => (effectiveKey(a) ?? "9999").localeCompare(effectiveKey(b) ?? "9999") || a.priority - b.priority || a.createdAt.localeCompare(b.createdAt)), [tasks]);
  const children = (id: string) => tasks.filter(t => t.parentId === id).sort((a,b) => Number(a.completed) - Number(b.completed) || sortTasks(a,b));
  const active = roots.filter(t => !t.completed);
  const done = roots.filter(t => t.completed);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 60000); return () => clearInterval(timer); }, []);
  const current = dateKey(clock);
  const tomorrow = addDays(1);
  const currentTime = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const isOverdue = (task: Task) => { const key = effectiveKey(task); if (!key) return false; const date = key.slice(0,10); const time = key.slice(11); return date < current || (date === current && time !== "99:99" && time < currentTime); };
  const effectiveDate = (task: Task) => effectiveKey(task)?.slice(0,10) ?? null;
  const shownPriority = (task: Task) => urgency(task, tomorrow);
  const visible = active;
  const urgent = visible.filter(t => shownPriority(t) === 0 && !isOverdue(t));
  const buckets = [
    { name: "Просрочено", items: visible.filter(isOverdue), tone: "late" },
    { name: "Срочно", items: urgent, tone: "urgent" },
    { name: "Сегодня", items: visible.filter(t => effectiveDate(t) === current && !isOverdue(t) && shownPriority(t) !== 0), tone: "today" },
    { name: "Ближайшие дни", items: visible.filter(t => { const d = effectiveDate(t); return d && d > current && d <= addDays(7) && shownPriority(t) !== 0; }), tone: "soon" },
    { name: "Позже", items: visible.filter(t => { const d = effectiveDate(t); return d && d > addDays(7) && shownPriority(t) !== 0; }), tone: "later" },
    { name: "Без срока", items: visible.filter(t => !effectiveDate(t) && shownPriority(t) !== 0), tone: "none" },
  ];
  const historyDays = useMemo(() => {
    const groups = new Map<string, Task[]>();
    for (const task of tasks.filter(t => t.completed)) {
      const day = task.completedAt ? dateKey(new Date(task.completedAt)) : "unknown";
      groups.set(day, [...(groups.get(day) ?? []), task]);
    }
    return [...groups.entries()].sort(([a], [b]) => a === "unknown" ? 1 : b === "unknown" ? -1 : b.localeCompare(a)).map(([day, items]) => ({
      day,
      label: day === "unknown" ? "Дата не записана" : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(day + "T12:00:00")),
      items: items.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "") || a.title.localeCompare(b.title)),
    }));
  }, [tasks]);
  const shownHistory = selectedHistoryDay ? historyDays.filter(group => group.day === selectedHistoryDay) : historyDays;
  const row = (task: Task, child = false) => {
    const sub = child ? [] : children(task.id);
    return <div className={`task-block ${task.completed ? "is-done" : ""}`} key={task.id}>
      <div className={`task-row ${child ? "sub-row" : ""}`}>
        <button className={`check-button ${task.completed ? "checked" : ""}`} aria-label={task.completed ? "Вернуть задачу" : "Выполнить задачу"} onClick={() => void toggle(task, "completed")}>{task.completed && <Check size={15} strokeWidth={3}/>}</button>
        <button className="task-main" onClick={() => openEdit(task)}><span className="task-title">{task.title}</span><span className="task-meta">
          {task.dueDate && <span className={isOverdue(task) && !task.completed ? "overdue" : ""}>{niceDate(task.dueDate)}{task.dueTime ? ` · до ${task.dueTime}` : ""}</span>}
          {!task.dueDate && !child && effectiveKey(task) && <span>подзадача: {niceDate(effectiveKey(task)!.slice(0,10))}{effectiveKey(task)!.slice(11) !== "99:99" ? ` · до ${effectiveKey(task)!.slice(11)}` : ""}</span>}
          {task.estimateMinutes && <span>{estimateText(task.estimateMinutes)}</span>}
          {task.remindMinutes && !task.completed && <span>Напомнить за {task.remindMinutes >= 1440 ? "день" : task.remindMinutes >= 60 ? `${task.remindMinutes / 60} ч` : `${task.remindMinutes} мин`}</span>}
          {!task.completed && shownPriority(task) === 0 && <span className="urgent-label">Срочно</span>}
          {!task.completed && shownPriority(task) === 1 && <span className="high">Важно</span>}
          {sub.length > 0 && <span>{sub.filter(t => t.completed).length}/{sub.length} подзадач</span>}
        </span></button>
        <button className={`focus-button ${task.inProgress ? "on" : ""}`} onClick={() => void toggle(task, "inProgress")} aria-label={task.inProgress ? "Убрать из работы" : "Взять в работу"}>{task.inProgress ? "В работе" : "В работу"}</button>
      </div>
      {sub.length > 0 && <div className="subtasks">{sub.map(t => row(t, true))}</div>}
      {!child && !task.completed && <button className="add-sub" onClick={() => openNew(task.id)}><Plus size={14}/> Подзадача</button>}
    </div>;
  };
  return <div className="app-shell">
    <main className="content">
      {!signin && <header className="page-header"><h1>{view === "tasks" ? "Задачи" : "История"}</h1><div className="header-actions">{view === "tasks" && canImport && <button className="secondary-button" onClick={() => setImportDialog(true)}>Перенести</button>}<button className="secondary-button icon-button history-button" aria-label={view === "tasks" ? "История" : "Назад к задачам"} title={view === "tasks" ? "История" : "Назад к задачам"} onClick={() => setView(view === "tasks" ? "history" : "tasks")}>{view === "tasks" ? <History size={19}/> : <ArrowLeft size={19}/>}</button>{view === "tasks" && <button className="primary-button icon-button" aria-label="Добавить задачу" title="Добавить задачу" onClick={() => openNew()}><Plus size={20}/></button>}{typeof window !== "undefined" && !window.Telegram?.WebApp?.initData && <button className="secondary-button quiet-button" onClick={async () => { await fetch("/api/auth/telegram/logout", { method: "POST" }); void refresh(); }}>Выйти</button>}</div></header>}
      {error && <div className="error">{error}<button onClick={() => setError("")}><X size={14}/></button></div>}
      {signin ? <TelegramLogin/> :
      loading ? <div className="empty">Загрузка…</div> : view === "history" ? <div className="task-list">
        <CompletionHeatmap dates={tasks.filter(t => t.completed).map(t => t.completedAt)} selected={selectedHistoryDay} onSelect={setSelectedHistoryDay} now={clock}/>
        {shownHistory.map(group => <section className="bucket history-bucket" key={group.day}><h2>{group.label} · {group.items.length}</h2><div className="bucket-body">{group.items.map(task => <div className="history-row" key={task.id}><span>{task.title}</span>{task.parentId && <span className="history-parent">{tasks.find(parent => parent.id === task.parentId)?.title}</span>}</div>)}</div></section>)}
        {!shownHistory.length && <div className="empty">{selectedHistoryDay ? "В этот день задач нет" : "Пока нет выполненных задач"}</div>}
      </div> : <div className="task-list">
        {buckets.filter(b => b.items.length).map(bucket => <section className="bucket" key={bucket.name}><h2 className={bucket.tone}>{bucket.name}</h2><div className="bucket-body">{bucket.items.map(t => row(t))}</div></section>)}
        {!visible.length && !done.length && <div className="empty">Нет задач</div>}
        {done.length > 0 && <section className="bucket completed-bucket"><h2>Выполнено</h2><div className="bucket-body">{done.map(t => row(t))}</div></section>}
      </div>}
    </main>
    {dialog && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDialog(false); }}>
      <form className="modal" onSubmit={save}>
        <div className="modal-head"><h2>{editing ? "Изменить задачу" : parentId ? "Новая подзадача" : "Новая задача"}</h2><button type="button" className="close" onClick={() => setDialog(false)}><X size={20}/></button></div>
        <label>Название<input autoFocus value={title} onChange={e => setTitle(e.target.value)} maxLength={240} required/></label>
        <div className="date-field"><div className="field-label">Срок</div><DateChoice key={editing?.id ?? "new"} value={dueDate} onChange={value => { setDueDate(value); if (!value) { setDueTime(""); setRemindMinutes(""); } }}/></div>
        {dueDate && <label>До какого времени<input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}/></label>}
        {dueDate && <label>Напомнить<select value={remindMinutes} onChange={e => setRemindMinutes(e.target.value)}><option value="">Не напоминать</option><option value="5">За 5 минут</option><option value="15">За 15 минут</option><option value="30">За 30 минут</option><option value="60">За 1 час</option><option value="180">За 3 часа</option><option value="1440">За 1 день</option></select></label>}
        <div className="estimate-field"><div className="field-label">Примерно займёт</div><div className="estimate-options">{[["До 30 мин", 20], ["До 1 ч", 60], ["До 2 ч", 120], ["Больше 2 ч", 180], ["Не указывать", 0]].map(([label, value]) => <button type="button" key={label} className={(estimateMinutes ? estimateGroup(Number(estimateMinutes)) : 0) === value ? "selected" : ""} onClick={() => setEstimateMinutes(value ? String(value) : "")}>{label}</button>)}</div></div>
        <label>Важность<select value={priority} onChange={e => setPriority(Number(e.target.value))}><option value={0}>Срочно</option><option value={1}>Высокая</option><option value={2}>Обычная</option><option value={3}>Низкая</option></select></label>
        {!editing && !parentId && roots.length > 0 && <label>Главная задача<select value={parentId} onChange={e => setParentId(e.target.value)}><option value="">Нет — отдельная задача</option>{roots.filter(t => !t.completed).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>}
        <button className="primary-button submit" disabled={saving}>{saving ? "Сохраняем…" : editing ? "Сохранить" : "Добавить задачу"}</button>
        {editing && <button type="button" className="delete-button" disabled={deleting} onClick={() => void remove()}>{deleting ? "Удаляем…" : "Удалить задачу"}</button>}
      </form>
    </div>}
    {importDialog && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setImportDialog(false); }}>
      <form className="modal" onSubmit={claimImport}>
        <div className="modal-head"><h2>Перенести задачи</h2><button type="button" className="close" onClick={() => setImportDialog(false)}><X size={20}/></button></div>
        <label>Код переноса<input autoFocus value={importCode} onChange={e => setImportCode(e.target.value)} required/></label>
        <button className="primary-button submit" disabled={importing}>{importing ? "Переносим…" : "Перенести"}</button>
      </form>
    </div>}
  </div>;
}
