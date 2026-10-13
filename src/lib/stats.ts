/**
 * Dashboard queries. Definitions live in docs/METRICS.md — keep the two in sync.
 * Days are New Zealand days, approximated with the current NZ UTC offset (±1 h around DST changes).
 */
export interface Stats {
  days: number;
  pageviews: number;
  visitorDays: number;
  engaged: number;
  homeVisits: number;
  workReach: number | null;
  series: { day: string; visitors: number; pageviews: number }[];
  topPages: { key: string; n: number }[];
  sources: { key: string; n: number }[];
  outbound: { key: string; n: number }[];
  langs: { key: string; n: number }[];
  countries: { key: string; n: number }[];
  devices: { key: string; n: number }[];
}

export function nzOffsetSeconds(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Auckland", timeZoneName: "longOffset" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT+13:00"
  const m = parts?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 12 * 3600;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60);
}

export async function loadStats(db: D1Database, days: number, now = new Date()): Promise<Stats> {
  const since = now.getTime() - days * 86_400_000;
  const off = nzOffsetSeconds(now);
  const DAY = `date(ts / 1000 + ${off}, 'unixepoch')`;
  const all = <T>(sql: string, ...binds: unknown[]) =>
    db
      .prepare(sql)
      .bind(...binds)
      .all<T>()
      .then((r) => r.results);
  const top = (col: string, where: string, limit = 8) =>
    all<{ key: string; n: number }>(
      `SELECT ${col} AS key, COUNT(*) AS n FROM events WHERE ts >= ? AND ${where} AND ${col} IS NOT NULL GROUP BY key ORDER BY n DESC LIMIT ${limit}`,
      since,
    );

  const [totals, engaged, home, series, topPages, refs, apps, campaigns, outbound, langs, countries, devices] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS pageviews, COUNT(DISTINCT ${DAY} || visitor) AS visitorDays FROM events WHERE ts >= ? AND type = 'pageview'`,
      )
      .bind(since)
      .first<{ pageviews: number; visitorDays: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT ${DAY} AS d, visitor,
             SUM(type = 'pageview') AS pv,
             MAX(CASE WHEN type = 'engage' THEN value ELSE 0 END) AS eng,
             SUM(type IN ('out', 'email', 'play', 'lang')) AS clicks
           FROM events WHERE ts >= ? GROUP BY d, visitor
           HAVING pv >= 2 OR eng >= 10 OR clicks > 0)`,
      )
      .bind(since)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS visits, SUM(saw_work) AS work FROM (
           SELECT ${DAY} AS d, visitor,
             MAX(type = 'section' AND section = 'work') AS saw_work,
             MAX(type = 'pageview' AND path IN ('/', '/zh', '/zh/')) AS home
           FROM events WHERE ts >= ? GROUP BY d, visitor) WHERE home = 1`,
      )
      .bind(since)
      .first<{ visits: number; work: number | null }>(),
    all<{ day: string; visitors: number; pageviews: number }>(
      `SELECT ${DAY} AS day, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS pageviews
       FROM events WHERE ts >= ? AND type = 'pageview' GROUP BY day ORDER BY day`,
      since,
    ),
    top("path", "type = 'pageview'", 10),
    top("ref", "type = 'pageview'"),
    top("app", "type = 'pageview'"),
    top("campaign", "type = 'pageview'"),
    top("target", "type IN ('out', 'email')", 12),
    top("lang", "type = 'pageview'", 2),
    top("country", "type = 'pageview'"),
    top("device", "type = 'pageview'", 3),
  ]);

  // Fill missing days so the chart has one bar per day.
  const byDay = new Map(series.map((s) => [s.day, s]));
  const filled: Stats["series"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000 + off * 1000).toISOString().slice(0, 10);
    filled.push(byDay.get(d) ?? { day: d, visitors: 0, pageviews: 0 });
  }

  const sources = [
    ...refs.map((r) => ({ key: r.key, n: r.n })),
    ...apps.map((a) => ({ key: `app: ${a.key}`, n: a.n })),
    ...campaigns.map((c) => ({ key: `?r=${c.key}`, n: c.n })),
  ].sort((a, b) => b.n - a.n);

  return {
    days,
    pageviews: totals?.pageviews ?? 0,
    visitorDays: totals?.visitorDays ?? 0,
    engaged: engaged?.n ?? 0,
    homeVisits: home?.visits ?? 0,
    workReach: home?.visits ? (home.work ?? 0) / home.visits : null,
    series: filled,
    topPages,
    sources,
    outbound,
    langs,
    countries,
    devices,
  };
}
