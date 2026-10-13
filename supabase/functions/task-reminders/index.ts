// Attendreem: task reminders as phone/laptop push notifications.
// Runs every 15 minutes (see push_cron.sql). Sends, at most once each per student:
//   new  - a teacher just gave a task to the class
//   h1   - deadline is tomorrow (sent from 17:00 local time)
//   h0   - deadline is today (sent from 06:00 local time)
//   soon - deadline within the next hour
// Secrets needed (Edge Functions -> Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const TZ = Number(Deno.env.get("TZ_OFFSET_HOURS") ?? "7"); // WIB = 7, WITA = 8, WIT = 9
const H = 3600_000;

const localDay = (d: Date) => Math.floor((d.getTime() + TZ * H) / 86400_000);
const hhmm = (d: Date) => {
  const x = new Date(d.getTime() + TZ * H);
  return String(x.getUTCHours()).padStart(2, "0") + "." + String(x.getUTCMinutes()).padStart(2, "0");
};
const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const whenLabel = (due: Date, now: Date) => {
  const dd = localDay(due) - localDay(now);
  if (dd === 0) return "hari ini " + hhmm(due);
  if (dd === 1) return "besok " + hhmm(due);
  return DAYS[new Date(due.getTime() + TZ * H).getUTCDay()] + " " + hhmm(due);
};

type Task = { id: string; title: string; subject: string | null; due_at: string; user_id: string | null; class: string | null; created_at: string };

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  webpush.setVapidDetails("mailto:admin@attendreem.app", Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const now = new Date();
  const today = localDay(now);
  const hour = new Date(now.getTime() + TZ * H).getUTCHours();
  const nowIso = now.toISOString();
  const soonIso = new Date(now.getTime() + 48 * H).toISOString();
  const recentIso = new Date(now.getTime() - 30 * 60_000).toISOString();

  const { data: tasks, error } = await db.from("tasks").select("id,title,subject,due_at,user_id,class,created_at")
    .gt("due_at", nowIso)
    .or(`due_at.lt.${soonIso},created_at.gt.${recentIso}`);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!tasks?.length) return Response.json({ sent: 0 });

  // who should hear about each task
  const classes = [...new Set(tasks.filter((t: Task) => t.class).map((t: Task) => t.class as string))];
  const byClass: Record<string, string[]> = {};
  if (classes.length) {
    const { data: studs } = await db.from("profiles").select("id,class").eq("role", "murid").in("class", classes);
    (studs ?? []).forEach((s: { id: string; class: string }) => { (byClass[s.class] ||= []).push(s.id); });
  }
  const ids = tasks.map((t: Task) => t.id);
  const [{ data: done }, { data: logged }] = await Promise.all([
    db.from("task_done").select("task_id,user_id").in("task_id", ids),
    db.from("task_push_log").select("task_id,user_id,stage").in("task_id", ids),
  ]);
  const doneSet = new Set((done ?? []).map((r: { task_id: string; user_id: string }) => r.task_id + ":" + r.user_id));
  const logSet = new Set((logged ?? []).map((r: { task_id: string; user_id: string; stage: string }) => r.task_id + ":" + r.user_id + ":" + r.stage));

  type Msg = { user: string; task: Task; stage: string; title: string; body: string };
  const msgs: Msg[] = [];
  for (const t of tasks as Task[]) {
    const due = new Date(t.due_at);
    const left = due.getTime() - now.getTime();
    const dd = localDay(due) - today;
    const subj = t.subject ? t.subject + " · " : "";
    let stage = "", title = "", body = "";
    if (t.class && new Date(t.created_at).getTime() > now.getTime() - 30 * 60_000) {
      stage = "new"; title = "Tugas baru" + (t.subject ? " · " + t.subject : ""); body = t.title + " — deadline " + whenLabel(due, now);
    } else if (left <= H) {
      stage = "soon"; title = "⏰ 1 jam lagi deadline!"; body = subj + t.title;
    } else if (dd === 0 && hour >= 6) {
      stage = "h0"; title = "Hari ini deadline: " + t.title; body = subj + "jam " + hhmm(due);
    } else if (dd === 1 && hour >= 17) {
      stage = "h1"; title = "Besok deadline: " + t.title; body = subj + "jam " + hhmm(due) + ". Jangan lupa dikerjain ya!";
    }
    if (!stage) continue;
    const people = t.user_id ? [t.user_id] : (byClass[t.class as string] ?? []);
    for (const u of people) {
      if (doneSet.has(t.id + ":" + u) || logSet.has(t.id + ":" + u + ":" + stage)) continue;
      msgs.push({ user: u, task: t, stage, title, body });
    }
  }
  if (!msgs.length) return Response.json({ sent: 0 });

  // log first so a slow run never sends the same reminder twice
  await db.from("task_push_log").upsert(msgs.map((m) => ({ task_id: m.task.id, user_id: m.user, stage: m.stage })), { onConflict: "task_id,user_id,stage", ignoreDuplicates: true });

  const users = [...new Set(msgs.map((m) => m.user))];
  const { data: subs } = await db.from("push_subscriptions").select("endpoint,user_id,p256dh,auth").in("user_id", users);
  const subsByUser: Record<string, { endpoint: string; p256dh: string; auth: string }[]> = {};
  (subs ?? []).forEach((s: { endpoint: string; user_id: string; p256dh: string; auth: string }) => { (subsByUser[s.user_id] ||= []).push(s); });

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(msgs.flatMap((m) => (subsByUser[m.user] ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: m.title, body: m.body, url: "tasks.html", tag: "task-" + m.task.id }),
        { TTL: 6 * 3600 },
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.endpoint);
    }
  })));
  if (gone.length) await db.from("push_subscriptions").delete().in("endpoint", gone);

  return Response.json({ sent, reminders: msgs.length, removed: gone.length });
});
