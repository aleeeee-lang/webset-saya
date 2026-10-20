// Attendreem: fingerprint / phone-lock check-in (WebAuthn passkeys).
// The phone checks the finger itself; the fingerprint never leaves the phone.
// This function only checks the phone's signed answer, then hands out a
// one-time ticket that the attendance check (attendance_security.sql) accepts
// once, within 2 minutes, for that student.
//
// POST JSON {action, ...} with the student's own login (Authorization header):
//   register-options / register-verify   one phone per student (admin resets it)
//   auth-options / auth-verify           every check-in -> { ticket }
//   status                               { registered: boolean }
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

  const { data: prof } = await db.from("profiles").select("name, role").eq("id", user.id).maybeSingle();
  if (!prof || prof.role !== "murid") return reply({ error: "students only" }, 403);

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

  try {
    if (action === "status") return reply({ registered: !!cred });

    if (action === "register-options") {
      if (cred) return reply({ error: "ALREADY_REGISTERED" }, 409);   // one phone; the admin resets it
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID,
        userName: user.email ?? user.id,
        userDisplayName: prof.name ?? user.email ?? "Siswa",
        userID: new TextEncoder().encode(user.id),
        attestationType: "none",
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        timeout: 60_000,
      });
      await saveChallenge("register", options.challenge);
      return reply(options);
    }

    if (action === "register-verify") {
      if (cred) return reply({ error: "ALREADY_REGISTERED" }, 409);
      const expectedChallenge = await takeChallenge("register");
      if (!expectedChallenge) return reply({ error: "EXPIRED" }, 400);
      const v = await verifyRegistrationResponse({
        response: body.response as never,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
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
