-- V69: after V68 (on-model product photos, #336); #320 must take the next free number.
-- AI results that wait for the seller's approval (#316): counted per store for the merchant dashboard and per
-- product for the product list. Only REVIEW_REQUIRED rows are indexed, so the index stays small.
CREATE INDEX ai_jobs_review_idx ON ai_jobs (store_id, product_id) WHERE status = 'REVIEW_REQUIRED';
