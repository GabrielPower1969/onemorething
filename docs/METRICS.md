# Metrics — definitions

Implemented in `src/lib/stats.ts`; events are defined in `src/lib/analytics.ts` and `docs/PLAN.md` §7.
Days are New Zealand days (the current NZ UTC offset is applied, so day edges can be off by an hour
around daylight-saving changes).

| Metric | Definition |
|---|---|
| **Visitor-days** | Distinct `visitor` hashes per NZ day, summed over the range. A person who visits on 3 days counts 3. True multi-day "unique visitors" cannot be computed — by design, the salt changes every day. |
| **Page views** | `pageview` events (including back/forward-cache restores). |
| **Engaged visit** | A visitor-day with ≥ 2 page views, or ≥ 10 s visible time (`engage`), or any click (`out`, `email`, `play`, `lang`). |
| **Work reach** | Home visitor-days that had a `section=work` event (Work ≥ 50 % on screen for ≥ 1.5 s) ÷ home visitor-days. Answers "do people who land on Home actually see the work?" |
| **Read-through** | `read` events (90 % of a post) ÷ that post's page views. Collected; not on the dashboard yet (v1.1). |
| **Sources** | Referrer host; in-app browsers that send no referrer are labelled from the user agent (`app: wechat`, `app: linkedin`); `?r=` campaign codes (group-level only — never one code per person). |
| **Outbound clicks** | `out` events by configured target id (flowgt, loyal, github, linkedin, …) and `email` (`mailto` or `copy`). |

Not counted: automated browsers (`navigator.webdriver`), known bots (`isbot`), visitors who opted out
on `/privacy`, browsers sending Global Privacy Control, and anything not on the production host.

Retention: raw events ≈ 13 months (trimmed in batches when each day's salt is created).
