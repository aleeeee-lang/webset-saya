// Attendreem: task + lesson reminders as phone/laptop push notifications.
// Runs every 5 minutes (see push_cron.sql / lesson_push.sql). Sends, at most once each:
//   tasks:   new  - a teacher just gave a task to the class
//            h1   - deadline is tomorrow (sent from 17:00 local time)
//            h0   - deadline is today (sent from 06:00 local time)
//            soon - deadline within the next hour
//   lessons: about 10-15 minutes before a lesson starts (students of the class + its teacher),
//            skipped on days marked as a holiday in the academic calendar.
// Each person can turn tasks / lessons off in Settings (table notif_prefs).
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

  // who turned which reminders off
  const { data: prefRows } = await db.from("notif_prefs").select("user_id,tasks,lessons");
  const noTasks = new Set((prefRows ?? []).filter((r: { tasks: boolean }) => r.tasks === false).map((r: { user_id: string }) => r.user_id));
  const noLessons = new Set((prefRows ?? []).filter((r: { lessons: boolean }) => r.lessons === false).map((r: { user_id: string }) => r.user_id));

  type Msg = { user: string; title: string; body: string; url: string; tag: string; ttl: number };
  const msgs: Msg[] = [];
  const taskLog: { task_id: string; user_id: string; stage: string }[] = [];
  const lessonLog: { schedule_id: string; user_id: string; day: string }[] = [];

  // ---------- lessons ----------
  const local = new Date(now.getTime() + TZ * H);
  const isoDay = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
  const todayStr = local.toISOString().slice(0, 10);
  const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  const { data: hol } = await db.from("holidays").select("type").eq("date", todayStr);
  const isHoliday = (hol ?? []).some((h: { type: string | null }) => !h.type || h.type === "holiday");
  if (!isHoliday) {
    const { data: lessons } = await db.from("class_schedules").select("id,class,start_time,subject,room,teacher_id,teacher_name").eq("day", isoDay);
    const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const soonLessons = (lessons ?? []).filter((l: { start_time: string }) => { const d = toMin(l.start_time) - nowMin; return d > 0 && d <= 15; });
    if (soonLessons.length) {
      const lc = [...new Set(soonLessons.map((l: { class: string }) => l.class))];
      const ids = soonLessons.map((l: { id: string }) => l.id);
      const [{ data: studs }, { data: sent, error: logErr }] = await Promise.all([
        db.from("profiles").select("id,class").eq("role", "murid").in("class", lc),
        db.from("lesson_push_log").select("schedule_id,user_id").eq("day", todayStr).in("schedule_id", ids),
      ]);
      if (logErr) soonLessons.length = 0;   // log table missing -> never risk repeating every 5 minutes
      const sentSet = new Set((sent ?? []).map((r: { schedule_id: string; user_id: string }) => r.schedule_id + ":" + r.user_id));
      for (const l of soonLessons as { id: string; class: string; start_time: string; subject: string; room: string | null; teacher_id: string | null; teacher_name: string | null }[]) {
        const mins = toMin(l.start_time) - nowMin;
        const at = l.start_time.slice(0, 5).replace(":", ".");
        const where = l.room ? " · " + l.room : "";
        const people: { id: string; teacher: boolean }[] = (studs ?? []).filter((s: { class: string }) => s.class === l.class).map((s: { id: string }) => ({ id: s.id, teacher: false }));
        if (l.teacher_id) people.push({ id: l.teacher_id, teacher: true });
        for (const p of people) {
          if (noLessons.has(p.id) || sentSet.has(l.id + ":" + p.id)) continue;
          msgs.push({
            user: p.id,
            title: "📚 " + at + " · " + l.subject,
            body: p.teacher
              ? "Kamu mengajar " + l.class + where + " — mulai " + mins + " menit lagi"
              : "Mulai " + mins + " menit lagi" + where + (l.teacher_name ? " · " + l.teacher_name : ""),
            url: "schedule.html", tag: "lesson-" + l.id, ttl: 15 * 60,   // no use arriving after the lesson started
          });
          lessonLog.push({ schedule_id: l.id, user_id: p.id, day: todayStr });
        }
      }
    }
  }

  // ---------- tasks ----------
  const { data: tasks, error } = await db.from("tasks").select("id,title,subject,due_at,user_id,class,created_at")
    .gt("due_at", nowIso)
    .or(`due_at.lt.${soonIso},created_at.gt.${recentIso}`);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (tasks?.length) {
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
        if (noTasks.has(u) || doneSet.has(t.id + ":" + u) || logSet.has(t.id + ":" + u + ":" + stage)) continue;
        msgs.push({ user: u, title, body, url: "tasks.html", tag: "task-" + t.id, ttl: 6 * 3600 });
        taskLog.push({ task_id: t.id, user_id: u, stage });
      }
    }
  }
  if (!msgs.length) return Response.json({ sent: 0 });

  // log first so a slow run never sends the same reminder twice
  if (taskLog.length) await db.from("task_push_log").upsert(taskLog, { onConflict: "task_id,user_id,stage", ignoreDuplicates: true });
  if (lessonLog.length) await db.from("lesson_push_log").upsert(lessonLog, { onConflict: "schedule_id,user_id,day", ignoreDuplicates: true });

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
        JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.tag }),
        { TTL: m.ttl },
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.endpoint);
    }
  })));
  if (gone.length) await db.from("push_subscriptions").delete().in("endpoint", gone);

  return Response.json({ sent, reminders: msgs.length, lessons: lessonLog.length, removed: gone.length });
});
