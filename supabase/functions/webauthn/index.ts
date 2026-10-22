// Attendreem: fingerprint / phone-lock check-in (WebAuthn passkeys).
// The phone checks the finger itself; the fingerprint never leaves the phone.
// This function only checks the phone's signed answer, then hands out a
// one-time ticket that the attendance check (attendance_security.sql) accepts
// once, within 2 minutes, for that student.
//
// POST JSON {action, ...} with the student's own login (Authorization header):
//   register-options / register-verify   one phone per student (admin resets it)
//   auth-options / auth-verify           every check-in -> { ticket }
//   change-options / change-verify       move to a new phone (face photo first, once per 7 days)
//   status                               { registered, last_change_at, next_change_at }
// Needs no extra secrets: SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@13";
import { createClient } from "npm:@supabase/supabase-js@2";

// pages allowed to use it (the page's address decides the "relying party")
const ORIGINS = (Deno.env.get("WEBAUTHN_ORIGINS") ?? "https://aleeeee-lang.github.io")
  .split(",").map((s) => s.trim()).filter(Boolean);
const RP_NAME = "Attendreem";
const CHALLENGE_TTL_MS = 5 * 60_000;
const CHANGE_EVERY_MS = 7 * 24 * 3600_000;   // a student may move to a new phone once per 7 days
const PHOTO_MAX_AGE_MS = 15 * 60_000;         // the face photo must be this fresh

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ORIGINS.includes(origin) ? origin : ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const b64u = {
  enc: (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)),
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = { ...cors(origin), "Content-Type": "application/json" };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);
  if (!origin || !ORIGINS.includes(origin)) return reply({ error: "origin not allowed" }, 403);
  const rpID = new URL(origin).hostname;

  // who is asking (their own login token)
  const auth = req.headers.get("authorization") ?? "";
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: who, error: whoErr } = await asUser.auth.getUser();
  if (whoErr || !who?.user) return reply({ error: "not signed in" }, 401);
  const user = who.user;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const { data: prof } = await db.from("profiles").select("name, role, class").eq("id", user.id).maybeSingle();
  // students and teachers check in (teacher_attendance.sql); admins and parents don't
  if (!prof || (prof.role !== "murid" && prof.role !== "guru")) return reply({ error: "students and teachers only" }, 403);
  const isTeacher = prof.role === "guru";

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { /* empty */ }
  const action = String(body.action ?? "");

  const { data: cred } = await db.from("webauthn_credentials").select("*").eq("user_id", user.id).maybeSingle();

  const saveChallenge = async (kind: string, challenge: string) => {
    await db.from("webauthn_challenges").delete().eq("user_id", user.id);
    await db.from("webauthn_challenges").insert({ user_id: user.id, kind, challenge });
  };
  const takeChallenge = async (kind: string) => {
    const { data } = await db.from("webauthn_challenges").select("*").eq("user_id", user.id).eq("kind", kind).maybeSingle();
    await db.from("webauthn_challenges").delete().eq("user_id", user.id);
    if (!data || Date.now() - Date.parse(data.created_at) > CHALLENGE_TTL_MS) return null;
    return data.challenge as string;
  };

  const lastChange = async () => {
    const { data } = await db.from("fp_changes").select("created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
    return data && data.length ? Date.parse(data[0].created_at) : 0;
  };
  const regOptions = () => generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.email ?? user.id,
    userDisplayName: prof.name ?? user.email ?? "Siswa",
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    // "discouraged": the phone keeps the key on this device only (on Android it isn't saved as a
    // synced passkey in Google Password Manager), so the fingerprint stays tied to one phone
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged", requireResidentKey: false },
    timeout: 60_000,
  });
  const verifyReg = (response: unknown, expectedChallenge: string) => verifyRegistrationResponse({
    response: response as never,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });
  // notifications go through push_queue (sent right away by the database trigger)
  const notifyChange = async (changeId: string) => {
    const who = (prof.name ?? (isTeacher ? "Guru" : "Siswa")) + (isTeacher ? " (Guru)" : prof.class ? " (" + prof.class + ")" : "");
    const rows: { user_id: string; title: string; body: string; url: string; tag: string }[] = [];
    const [{ data: admins }, { data: subs }, { data: prefs }, { data: parents }] = await Promise.all([
      db.from("profiles").select("id").eq("role", "admin"),
      db.from("push_subscriptions").select("user_id"),
      db.from("notif_prefs").select("user_id, admin_fp"),
      db.from("parent_links").select("parent_id").eq("student_id", user.id),
    ]);
    const hasPush = new Set((subs ?? []).map((r: { user_id: string }) => r.user_id));
    const fpOff = new Set((prefs ?? []).filter((r: { admin_fp?: boolean }) => r.admin_fp === false).map((r: { user_id: string }) => r.user_id));
    for (const a of admins ?? []) {
      if (hasPush.has(a.id) && !fpOff.has(a.id)) rows.push({ user_id: a.id, title: "👆 Sidik jari · Ganti HP", body: who + " mendaftarkan HP baru untuk absen sidik jari.", url: isTeacher ? "admin-teachers.html" : "admin-students.html", tag: "admin-fp-" + changeId });
    }
    for (const p of isTeacher ? [] : parents ?? []) {
      if (hasPush.has(p.parent_id)) rows.push({ user_id: p.parent_id, title: "👆 HP sidik jari anak diganti", body: (prof.name ?? "Anak Anda") + " mendaftarkan HP baru untuk absen sidik jari.", url: "parent.html", tag: "fp-" + changeId });
    }
    if (hasPush.has(user.id)) rows.push({ user_id: user.id, title: "👆 HP sidik jarimu diganti", body: "Kalau ini bukan kamu, segera lapor ke admin.", url: "attendance.html", tag: "fp-" + changeId });
    if (rows.length) await db.from("push_queue").insert(rows);
  };

  try {
    if (action === "status") {
      const last = cred ? await lastChange() : 0;
      return reply({
        registered: !!cred,
        last_change_at: last ? new Date(last).toISOString() : null,
        next_change_at: last ? new Date(last + CHANGE_EVERY_MS).toISOString() : null,
      });
    }

    if (action === "change-options") {
      if (!cred) return reply({ error: "NOT_REGISTERED" }, 404);
      const last = await lastChange();
      if (last && Date.now() - last < CHANGE_EVERY_MS) return reply({ error: "CHANGE_TOO_SOON", next_change_at: new Date(last + CHANGE_EVERY_MS).toISOString() }, 429);
      const options = await regOptions();
      await saveChallenge("change", options.challenge);
      return reply(options);
    }

    if (action === "change-verify") {
      if (!cred) return reply({ error: "NOT_REGISTERED" }, 404);
      const last = await lastChange();
      if (last && Date.now() - last < CHANGE_EVERY_MS) return reply({ error: "CHANGE_TOO_SOON" }, 429);
      // the face photo taken just before, in the student's own folder
      const photo = String(body.photo_path ?? "");
      const m = photo.match(/^([0-9a-f-]{36})\/(fpchange-\d+\.jpg)$/);
      if (!m || m[1] !== user.id) return reply({ error: "PHOTO_MISSING" }, 400);
      const { data: files } = await db.storage.from("attendance-photos").list(user.id, { search: m[2], limit: 5 });
      const f = (files ?? []).find((x: { name: string }) => x.name === m[2]) as { created_at?: string } | undefined;
      if (!f || !f.created_at || Date.now() - Date.parse(f.created_at) > PHOTO_MAX_AGE_MS) return reply({ error: "PHOTO_MISSING" }, 400);
      const expectedChallenge = await takeChallenge("change");
      if (!expectedChallenge) return reply({ error: "EXPIRED" }, 400);
      const v = await verifyReg(body.response, expectedChallenge);
      if (!v.verified || !v.registrationInfo) return reply({ error: "NOT_VERIFIED" }, 400);
      const c = v.registrationInfo.credential;
      const { error: upErr } = await db.from("webauthn_credentials").update({
        credential_id: c.id,
        public_key: b64u.enc(c.publicKey),
        counter: c.counter ?? 0,
        transports: c.transports ?? null,
        device_label: String(body.device ?? "").slice(0, 80) || null,
        created_at: new Date().toISOString(),
        last_used_at: null,
      }).eq("user_id", user.id);
      if (upErr) return reply({ error: upErr.message }, 400);
      const { data: ch } = await db.from("fp_changes").insert({ user_id: user.id, photo_path: photo, old_credential_id: cred.credential_id }).select("id").single();
      try { await notifyChange(ch?.id ?? crypto.randomUUID()); } catch (_) { /* the change itself is done */ }
      return reply({ ok: true });
    }

    if (action === "register-options") {
      if (cred) return reply({ error: "ALREADY_REGISTERED" }, 409);   // one phone; the admin resets it
      const options = await regOptions();
      await saveChallenge("register", options.challenge);
      return reply(options);
    }

    if (action === "register-verify") {
      if (cred) return reply({ error: "ALREADY_REGISTERED" }, 409);
      const expectedChallenge = await takeChallenge("register");
      if (!expectedChallenge) return reply({ error: "EXPIRED" }, 400);
      const v = await verifyReg(body.response, expectedChallenge);
      if (!v.verified || !v.registrationInfo) return reply({ error: "NOT_VERIFIED" }, 400);
      const c = v.registrationInfo.credential;
      const { error } = await db.from("webauthn_credentials").insert({
        user_id: user.id,
        credential_id: c.id,
        public_key: b64u.enc(c.publicKey),
        counter: c.counter ?? 0,
        transports: c.transports ?? null,
        device_label: String(body.device ?? "").slice(0, 80) || null,
      });
      if (error) return reply({ error: error.message }, 400);
      return reply({ ok: true });
    }

    if (action === "auth-options") {
      if (!cred) return reply({ error: "NOT_REGISTERED" }, 404);
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: [{ id: cred.credential_id, transports: cred.transports ?? undefined }],
        userVerification: "required",
        timeout: 60_000,
      });
      await saveChallenge("auth", options.challenge);
      return reply(options);
    }

    if (action === "auth-verify") {
      if (!cred) return reply({ error: "NOT_REGISTERED" }, 404);
      const expectedChallenge = await takeChallenge("auth");
      if (!expectedChallenge) return reply({ error: "EXPIRED" }, 400);
      const resp = body.response as { id?: string };
      if (!resp || resp.id !== cred.credential_id) return reply({ error: "WRONG_DEVICE" }, 400);
      const v = await verifyAuthenticationResponse({
        response: body.response as never,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: { id: cred.credential_id, publicKey: b64u.dec(cred.public_key), counter: Number(cred.counter ?? 0), transports: cred.transports ?? undefined },
        requireUserVerification: true,
      });
      if (!v.verified) return reply({ error: "NOT_VERIFIED" }, 400);
      await db.from("webauthn_credentials").update({ counter: v.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("user_id", user.id);
      const { data: t, error } = await db.from("fp_tickets").insert({ user_id: user.id }).select("ticket").single();
      if (error) return reply({ error: error.message }, 400);
      return reply({ ticket: t.ticket });
    }

    return reply({ error: "unknown action" }, 400);
  } catch (e) {
    return reply({ error: String((e as Error).message ?? e) }, 400);
  }
});
