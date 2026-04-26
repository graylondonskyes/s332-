# PHC Neon Deploy Guide V69

V69 adds Neon as an **additional** enterprise-grade backup lane. The shipped file-backed serverless persistence lane stays intact.

1. Install dependencies so `pg` is available.
2. Set `NEON_DATABASE_URL`.
3. Deploy the site/functions.
4. Open the live product and use the **Neon** lane.
5. Refresh health.
6. Push the first backup snapshot.
7. Pull/merge if restore is needed.
