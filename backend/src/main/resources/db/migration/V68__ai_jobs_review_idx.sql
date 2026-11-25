-- AI results that wait for the seller's approval (#316): counted per store for the merchant dashboard and per
-- product for the product list. Only REVIEW_REQUIRED rows are indexed, so the index stays small.
CREATE INDEX ai_jobs_review_idx ON ai_jobs (store_id, product_id) WHERE status = 'REVIEW_REQUIRED';
