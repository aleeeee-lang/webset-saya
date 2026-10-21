// Attendreem: task + lesson reminders as phone/laptop push notifications.
// Runs every 5 minutes (see push_cron.sql / lesson_push.sql). Sends, at most once each:
//   tasks:   new  - a teacher just gave a task to the class
//            h1   - deadline is tomorrow (sent from 17:00 local time)
//            h0   - deadline is today (sent from 06:00 local time)
//            soon - deadline within the next hour
//   lessons: about 10-15 minutes before a lesson starts (students of the class + its teacher),
//            skipped on days marked as a holiday in the academic calendar.
//   exams:   academic-calendar days of type "exam": 3 days before and the day before (17:00), and on the day (06:00);
//            for a multi-day exam only the first day gets the early reminders. Everyone with notifications on.
//   queue:   announcements and attendance changes queued by database triggers (push_events.sql),
//            and new leave requests / feedback / SPP proofs for admins (admin_push.sql);
//            the database also calls this right away with {"queue_only": true} (push_instant.sql)
// Each person can turn tasks / lessons / general off in Settings (table notif_prefs).
// Secrets needed (Edge Functions -> Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

// the school's time zone, set by the admin in Kelola Jadwal (school_timezone.sql); WIB = 7, WITA = 8, WIT = 9
const TZ_HOURS: Record<string, number> = { "Asia/Jakarta": 7, "Asia/Makassar": 8, "Asia/Jayapura": 9 };
let TZ = Number(Deno.env.get("TZ_OFFSET_HOURS") ?? "7");
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

// ---------- photo clean-up (keeps the free 1 GB storage from filling up) ----------
// Once a day (02.00-02.10 school time): check-in photos older than 30 days, and letter /
// phone-change photos older than 90 days, are removed from storage. The attendance itself stays.
const FACE_DAYS = 30, DOC_DAYS = 90;
// deno-lint-ignore no-explicit-any
async function cleanupPhotos(db: any, local: Date) {
  const day = (n: number) => new Date(local.getTime() - n * 86400_000).toISOString().slice(0, 10);
  const stamp = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();
  const bucket = db.storage.from("attendance-photos");
  let removed = 0;
  const drop = async (paths: string[]) => {
    for (let i = 0; i < paths.length; i += 100) {
      const part = paths.slice(i, i + 100);
      const { error } = await bucket.remove(part);
      if (!error) removed += part.length;
    }
  };
  // 1) face photos of check-ins older than 30 days
  for (let round = 0; round < 10; round++) {
    const { data: rows, error } = await db.from("attendance").select("id, photo_url").lt("date", day(FACE_DAYS)).not("photo_url", "is", null).limit(500);
    if (error || !rows?.length) break;
    await drop(rows.map((r: { photo_url: string }) => r.photo_url));
    await db.from("attendance").update({ photo_url: null }).in("id", rows.map((r: { id: string }) => r.id));
    if (rows.length < 500) break;
  }
  // 2) letter photos (Izin / Sakit) older than 90 days
  for (const t of ["attendance", "leave_requests"]) {
    const dateCol = t === "attendance" ? "date" : "end_date";
    const { data: rows, error } = await db.from(t).select("id, proof_url").lt(dateCol, day(DOC_DAYS)).not("proof_url", "is", null).limit(500);
    if (error || !rows?.length) continue;   // column missing on an older database: skip
    // the same letter can be on several days: remove each file once
    await drop([...new Set(rows.map((r: { proof_url: string }) => r.proof_url))] as string[]);
    await db.from(t).update({ proof_url: null }).in("id", rows.map((r: { id: string }) => r.id));
  }
  // 3) phone-change face photos older than 90 days (the change history itself stays)
  {
    const { data: rows, error } = await db.from("fp_changes").select("photo_path").lt("created_at", stamp(DOC_DAYS)).limit(500);
    if (!error && rows?.length) await drop(rows.map((r: { photo_path: string }) => r.photo_path));
  }
  return removed;
}

type Task = { id: string; title: string; subject: string | null; due_at: string; user_id: string | null; class: string | null; created_at: string };

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  let queueOnly = false;
  try { queueOnly = !!(await req.json()).queue_only; } catch (_) { /* empty body from cron */ }
  webpush.setVapidDetails("mailto:admin@attendreem.app", Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  if (!queueOnly) {   // the queue path doesn't use the clock
    const { data: loc, error: locErr } = await db.from("school_location").select("timezone").eq("id", "default").maybeSingle();
    if (!locErr && loc && TZ_HOURS[(loc as { timezone?: string }).timezone ?? ""]) TZ = TZ_HOURS[(loc as { timezone: string }).timezone];
  }

  const now = new Date();
  const today = localDay(now);
  const hour = new Date(now.getTime() + TZ * H).getUTCHours();
  const nowIso = now.toISOString();
  const soonIso = new Date(now.getTime() + 48 * H).toISOString();
  const recentIso = new Date(now.getTime() - 30 * 60_000).toISOString();

  // who turned which reminders off
  const { data: prefRows } = await db.from("notif_prefs").select("*");
  const noTasks = new Set((prefRows ?? []).filter((r: { tasks: boolean }) => r.tasks === false).map((r: { user_id: string }) => r.user_id));
  const noLessons = new Set((prefRows ?? []).filter((r: { lessons: boolean }) => r.lessons === false).map((r: { user_id: string }) => r.user_id));

  const noExams = new Set((prefRows ?? []).filter((r: { exams?: boolean }) => r.exams === false).map((r: { user_id: string }) => r.user_id));
  const noGeneral = new Set((prefRows ?? []).filter((r: { general?: boolean }) => r.general === false).map((r: { user_id: string }) => r.user_id));

  type Msg = { user: string; title: string; body: string; url: string; tag: string; ttl: number };
  const msgs: Msg[] = [];
  const taskLog: { task_id: string; user_id: string; stage: string }[] = [];
  const lessonLog: { schedule_id: string; user_id: string; day: string }[] = [];
  const examLog: { holiday_id: string; user_id: string; stage: string }[] = [];

  // ---------- queued: announcements + attendance ----------
  // claim_push_queue marks the rows as sent and returns them in one step, so two runs at once never double-send
  let { data: queued, error: qErr } = await db.rpc("claim_push_queue", { max_rows: 2000 });
  if (qErr) {   // older database without the function: fall back to select + mark
    ({ data: queued, error: qErr } = await db.from("push_queue").select("id,user_id,title,body,url,tag")
      .is("sent_at", null).gt("created_at", new Date(now.getTime() - 6 * H).toISOString()).order("id").limit(2000));
    if (!qErr && queued?.length) await db.from("push_queue").update({ sent_at: nowIso }).in("id", queued.map((q: { id: number }) => q.id));
  }
  if (!qErr && queued?.length) {
    for (const q of queued as { user_id: string; title: string; body: string; url: string; tag: string | null }[]) {
      // admin division pushes (admin_push.sql) have their own switches in Settings
      if (noGeneral.has(q.user_id) && !(q.tag ?? "").startsWith("admin-")) continue;
      msgs.push({ user: q.user_id, title: q.title, body: q.body, url: q.url, tag: q.tag ?? "attendreem", ttl: 24 * 3600 });
    }
  }
  if (!qErr && Math.random() < 0.02) await db.from("push_queue").delete().lt("created_at", new Date(now.getTime() - 7 * 24 * H).toISOString());

  if (!queueOnly) {
    // ---------- lessons ----------
    const local = new Date(now.getTime() + TZ * H);

    // ---------- once a day: old photos ----------
    if (local.getUTCHours() === 2 && local.getUTCMinutes() < 10) {
      try { console.log("photos removed", await cleanupPhotos(db, local)); } catch (e) { console.error("cleanup", (e as Error).message); }
    }
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

    // ---------- exams ----------
    {
      const dayStr = (off: number) => new Date(local.getTime() + off * 86400_000).toISOString().slice(0, 10);
      const { data: exams, error: exErr } = await db.from("holidays").select("id,date,label,type").eq("type", "exam").gte("date", dayStr(-1)).lte("date", dayStr(3));
      if (!exErr && exams?.length) {
        const keys = new Set(exams.map((e: { date: string; label: string | null }) => e.date + "|" + (e.label ?? "")));
        const DAYN = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const due: { e: { id: string; date: string; label: string | null }; stage: string; title: string; body: string }[] = [];
        for (const e of exams as { id: string; date: string; label: string | null }[]) {
          const dd = Math.round((Date.parse(e.date + "T00:00:00Z") - Date.parse(todayStr + "T00:00:00Z")) / 86400_000);
          const prev = new Date(Date.parse(e.date + "T00:00:00Z") - 86400_000).toISOString().slice(0, 10);
          const firstDay = !keys.has(prev + "|" + (e.label ?? ""));
          const name = e.label || "Ujian";
          const wd = DAYN[new Date(e.date + "T00:00:00Z").getUTCDay()];
          if (dd === 0 && hour >= 6) due.push({ e, stage: "h0", title: "📝 Hari ini ujian: " + name, body: "Semangat! Cek lagi alat tulis dan jadwalnya ya." });
          else if (firstDay && dd === 1 && hour >= 17) due.push({ e, stage: "h1", title: "📝 Besok ujian: " + name, body: "Jangan lupa siapin alat tulis dan istirahat yang cukup." });
          else if (firstDay && dd === 3 && hour >= 17) due.push({ e, stage: "h3", title: "📝 3 hari lagi: " + name, body: "Mulai " + wd + ". Yuk mulai belajar dari sekarang!" });
        }
        if (due.length) {
          const ids = due.map((d) => d.e.id);
          const [{ data: subsAll }, { data: got, error: gotErr }] = await Promise.all([
            db.from("push_subscriptions").select("user_id"),
            db.from("exam_push_log").select("holiday_id,user_id,stage").in("holiday_id", ids),
          ]);
          if (!gotErr) {   // log table missing -> skip rather than repeat every 5 minutes
            const gotSet = new Set((got ?? []).map((r: { holiday_id: string; user_id: string; stage: string }) => r.holiday_id + ":" + r.user_id + ":" + r.stage));
            const people = [...new Set((subsAll ?? []).map((r: { user_id: string }) => r.user_id))];
            for (const d of due) for (const u of people) {
              if (noExams.has(u) || gotSet.has(d.e.id + ":" + u + ":" + d.stage)) continue;
              msgs.push({ user: u, title: d.title, body: d.body, url: "calendar.html", tag: "exam-" + d.e.id, ttl: 12 * 3600 });
              examLog.push({ holiday_id: d.e.id, user_id: u, stage: d.stage });
            }
          }
        }
      }
    }

    // ---------- tasks ----------
    const { data: tasks, error } = await db.from("tasks").select("id,title,subject,due_at,user_id,class,created_at")
      .gt("due_at", nowIso)
      .or(`due_at.lt.${soonIso},created_at.gt.${recentIso}`);
    if (error) console.error("tasks", error.message);   // keep going: queued + lesson reminders still go out
    if (!error && tasks?.length) {
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
  }   // end of !queueOnly
  if (!msgs.length) return Response.json({ sent: 0 });

  // log first so a slow run never sends the same reminder twice
  if (taskLog.length) await db.from("task_push_log").upsert(taskLog, { onConflict: "task_id,user_id,stage", ignoreDuplicates: true });
  if (lessonLog.length) await db.from("lesson_push_log").upsert(lessonLog, { onConflict: "schedule_id,user_id,day", ignoreDuplicates: true });
  if (examLog.length) await db.from("exam_push_log").upsert(examLog, { onConflict: "holiday_id,user_id,stage", ignoreDuplicates: true });

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

  return Response.json({ sent, reminders: msgs.length, lessons: lessonLog.length, exams: examLog.length, queued: queued?.length ?? 0, removed: gone.length });
});
