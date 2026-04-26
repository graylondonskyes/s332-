ALTER TABLE app_review_submissions ADD COLUMN reviewed_at TEXT DEFAULT '';
ALTER TABLE app_revenue_settlements ADD COLUMN payout_reference TEXT DEFAULT '';
ALTER TABLE app_revenue_settlements ADD COLUMN paid_at TEXT DEFAULT '';
