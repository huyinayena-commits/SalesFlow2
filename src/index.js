const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
};

const ADMIN_SESSION_COOKIE = "salesflow2-admin-session";
const OAUTH_STATE_COOKIE = "salesflow2-oauth-state";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;
const OAUTH_STATE_MAX_AGE = 60 * 10;

function base64url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signValue(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function createSignedToken(payload, secret) {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${await signValue(body, secret)}`;
}

async function readSignedToken(token, secret) {
  if (!secret || typeof token !== "string") return null;
  const [body, signature] = token.split(".");
  if (!body || !signature || signature !== await signValue(body, secret)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body)));
    return payload && Number.isInteger(payload.exp) && payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

function cookies(request) {
  return Object.fromEntries((request.headers.get("Cookie") || "").split(";").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([name]) => name));
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function redirect(location, headers = {}) {
  const responseHeaders = new Headers({ Location: location });
  Object.entries(headers).forEach(([name, value]) => {
    (Array.isArray(value) ? value : [value]).forEach((item) => responseHeaders.append(name, item));
  });
  return new Response(null, { status: 302, headers: responseHeaders });
}

function oauthRedirectUri(request) {
  return `${new URL(request.url).origin}/auth/google/callback`;
}

function adminEmails(env) {
  return new Set((env.ADMIN_EMAILS || "").split(/[\s,]+/).map((email) => email.trim().toLowerCase()).filter(Boolean));
}

async function adminSession(request, env) {
  const session = await readSignedToken(cookies(request)[ADMIN_SESSION_COOKIE], env.SESSION_SECRET);
  return session?.role === "admin";
}

async function authType(request, env) {
  if (env.APP_PASSWORD && request.headers.get("Authorization") === `Bearer ${env.APP_PASSWORD}`) return "password";
  if (await adminSession(request, env)) return "admin";
  return null;
}

async function startGoogleLogin(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET || !env.ADMIN_EMAILS) {
    return error("Konfigurasi Google OAuth belum lengkap.", 503);
  }
  const state = await createSignedToken({
    nonce: base64url(crypto.getRandomValues(new Uint8Array(24))),
    exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_MAX_AGE,
  }, env.SESSION_SECRET);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: oauthRedirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, {
    "Set-Cookie": cookie(OAUTH_STATE_COOKIE, state, OAUTH_STATE_MAX_AGE),
  });
}

async function finishGoogleLogin(request, env) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const stateCookie = cookies(request)[OAUTH_STATE_COOKIE];
  const statePayload = await readSignedToken(state, env.SESSION_SECRET);
  const cookiePayload = await readSignedToken(stateCookie, env.SESSION_SECRET);
  if (!code || !statePayload || !cookiePayload || state !== stateCookie || statePayload.nonce !== cookiePayload.nonce) {
    return error("OAuth state tidak valid atau sudah kedaluwarsa.", 400);
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: oauthRedirectUri(request),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) return error("Kode OAuth Google tidak dapat diverifikasi.", 401);
  const tokens = await tokenResponse.json();
  if (typeof tokens.id_token !== "string") return error("Respons login Google tidak valid.", 401);

  const identityResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`);
  if (!identityResponse.ok) return error("Identitas Google tidak dapat diverifikasi.", 401);
  const identity = await identityResponse.json();
  const expiresAt = Number(identity.exp);
  const issuerValid = identity.iss === "https://accounts.google.com" || identity.iss === "accounts.google.com";
  const identityValid = identity.aud === env.GOOGLE_CLIENT_ID && issuerValid && Number.isFinite(expiresAt) && expiresAt > Math.floor(Date.now() / 1000) && identity.email_verified === "true";
  if (!identityValid || !adminEmails(env).has(String(identity.email || "").toLowerCase())) {
    return error("Akun Google tidak memiliki akses admin.", 403);
  }

  const session = await createSignedToken({
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE,
  }, env.SESSION_SECRET);
  return redirect("/", {
    "Set-Cookie": [
      cookie(ADMIN_SESSION_COOKIE, session, ADMIN_SESSION_MAX_AGE),
      cookie(OAUTH_STATE_COOKIE, "", 0),
    ],
  });
}

function logout(request) {
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": cookie(ADMIN_SESSION_COOKIE, "", 0) },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

function isMonth(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const [year, month] = value.split("-").map(Number);
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isNullableNonNegativeInteger(value) {
  return value === null || isNonNegativeInteger(value);
}

function validDay(month, day) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Number.isInteger(day) && day >= 1 && day <= lastDay;
}

async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

async function getSettings(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`,
  ).run();
  const row = await env.DB.prepare(
    "SELECT setting_value FROM app_settings WHERE setting_key = 'store_name'",
  ).first();
  return { storeName: row?.setting_value ?? "" };
}

async function saveSettings(env, body) {
  if (typeof body.storeName !== "string" || body.storeName.length > 100) {
    return error("storeName harus berupa teks maksimal 100 karakter.");
  }
  await env.DB.prepare(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES ('store_name', ?)
     ON CONFLICT(setting_key) DO UPDATE SET
       setting_value = excluded.setting_value,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  ).bind(body.storeName).run();
  return json(await getSettings(env));
}

async function getMonth(env, month) {
  const target = await env.DB.prepare(
    "SELECT month, target_spd, target_akm, updated_at FROM month_targets WHERE month = ?",
  ).bind(month).first();

  const { results } = await env.DB.prepare(
    "SELECT day, sales_net, total_struk, updated_at FROM daily_sales WHERE month = ? ORDER BY day",
  ).bind(month).all();

  return {
    month,
    targetSpd: target?.target_spd ?? 0,
    targetAkm: target?.target_akm ?? 0,
    days: results.map((row) => ({
      day: row.day,
      salesNet: row.sales_net,
      totalStruk: row.total_struk,
      updatedAt: row.updated_at,
    })),
    updatedAt: target?.updated_at ?? null,
  };
}

async function saveMonth(env, month, body) {
  const targetSpd = body.targetSpd ?? 0;
  const targetAkm = body.targetAkm ?? 0;
  if (!isNonNegativeInteger(targetSpd) || !isNonNegativeInteger(targetAkm)) {
    return error("targetSpd dan targetAkm harus bilangan bulat >= 0.");
  }
  if (body.days !== undefined && !Array.isArray(body.days)) {
    return error("days harus berupa array.");
  }

  const statements = [env.DB.prepare(
    `INSERT INTO month_targets (month, target_spd, target_akm)
     VALUES (?, ?, ?)
     ON CONFLICT(month) DO UPDATE SET
       target_spd = excluded.target_spd,
       target_akm = excluded.target_akm,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  ).bind(month, targetSpd, targetAkm)];

  for (const item of body.days ?? []) {
    if (!item || !validDay(month, item.day)) {
      return error(`day tidak valid: ${item?.day}`);
    }
    const salesNet = item.salesNet ?? null;
    const totalStruk = item.totalStruk ?? null;
    if (!isNullableNonNegativeInteger(salesNet) || !isNullableNonNegativeInteger(totalStruk)) {
      return error(`Nilai hari ${item.day} harus bilangan bulat >= 0 atau null.`);
    }
    statements.push(env.DB.prepare(
      `INSERT INTO daily_sales (month, day, sales_net, total_struk)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(month, day) DO UPDATE SET
         sales_net = excluded.sales_net,
         total_struk = excluded.total_struk,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ).bind(month, item.day, salesNet, totalStruk));
  }

  await env.DB.batch(statements);
  return json(await getMonth(env, month));
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: JSON_HEADERS });
    const url = new URL(request.url);
    if (url.pathname === "/auth/google" && request.method === "GET") return startGoogleLogin(request, env);
    if (url.pathname === "/auth/google/callback" && request.method === "GET") return finishGoogleLogin(request, env);
    if (url.pathname === "/auth/logout" && ["GET", "POST"].includes(request.method)) return logout(request);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      const type = await authType(request, env);
      return json({ authenticated: Boolean(type), admin: type === "admin" });
    }

    const type = await authType(request, env);
    if (!type) return error(env.APP_PASSWORD ? "Password diperlukan." : "APP_PASSWORD belum dikonfigurasi.", env.APP_PASSWORD ? 401 : 503);

    try {
      if (url.pathname === "/api/month" && request.method === "GET") {
        const month = url.searchParams.get("month");
        if (!month || !isMonth(month)) return error("Query month harus berformat YYYY-MM.");
        return json(await getMonth(env, month));
      }

      if (url.pathname === "/api/settings" && request.method === "GET") {
        return json(await getSettings(env));
      }

      if (url.pathname === "/api/settings" && ["POST", "PUT"].includes(request.method)) {
        const body = await readJson(request);
        if (!body) return error("Data pengaturan tidak valid.");
        return saveSettings(env, body);
      }

      if (url.pathname === "/api/month" && ["POST", "PUT"].includes(request.method)) {
        const body = await readJson(request);
        if (!body || !isMonth(body.month)) return error("month harus berformat YYYY-MM.");
        return saveMonth(env, body.month, body);
      }

      const dayMatch = url.pathname.match(/^\/api\/month\/(\d{4}-\d{2})\/day\/(\d+)$/);
      if (dayMatch && request.method === "PUT") {
        const [, month, dayText] = dayMatch;
        const day = Number(dayText);
        const body = await readJson(request);
        if (!isMonth(month) || !validDay(month, day) || !body) return error("Data hari tidak valid.");
        const existingTarget = await env.DB.prepare("SELECT target_spd, target_akm FROM month_targets WHERE month = ?").bind(month).first();
        return saveMonth(env, month, {
          targetSpd: existingTarget?.target_spd ?? 0,
          targetAkm: existingTarget?.target_akm ?? 0,
          days: [{ day, salesNet: body.salesNet ?? null, totalStruk: body.totalStruk ?? null }],
        });
      }

      return error("Endpoint tidak ditemukan.", 404);
    } catch (requestError) {
      console.error(requestError);
      return error("Terjadi kesalahan pada database atau Worker.", 500);
    }
  },
};
