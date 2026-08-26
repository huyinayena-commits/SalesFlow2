const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "Content-Type",
};

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
    if (!url.pathname.startsWith("/api/")) return json({ service: "salesflow2-api" });

    try {
      if (url.pathname === "/api/month" && request.method === "GET") {
        const month = url.searchParams.get("month");
        if (!month || !isMonth(month)) return error("Query month harus berformat YYYY-MM.");
        return json(await getMonth(env, month));
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
