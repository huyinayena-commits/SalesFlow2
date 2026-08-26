# SalesFlow2 + Cloudflare D1

## Setup

```sh
npx wrangler login
npx wrangler d1 execute salesflow2 --remote --file=./schema.sql
npx wrangler deploy
```

Binding D1 tersedia di Worker sebagai `env.DB`, sesuai `wrangler.toml`.

## Endpoint

Ambil data bulan:

```sh
curl 'https://YOUR-WORKER.workers.dev/api/month?month=2026-08'
```

Simpan target dan beberapa hari sekaligus:

```sh
curl -X PUT 'https://YOUR-WORKER.workers.dev/api/month' \
  -H 'content-type: application/json' \
  -d '{"month":"2026-08","targetSpd":1000000,"targetAkm":31000000,"days":[{"day":1,"salesNet":2500000,"totalStruk":42}]}'
```

Perbarui satu hari:

```sh
curl -X PUT 'https://YOUR-WORKER.workers.dev/api/month/2026-08/day/1' \
  -H 'content-type: application/json' \
  -d '{"salesNet":2750000,"totalStruk":45}'
```

Worker ini mengembalikan data mentah. Perhitungan AKM, SPD, STD, APC, dan growth tetap dapat dilakukan di frontend seperti pada `SalesFlow2.html`.
