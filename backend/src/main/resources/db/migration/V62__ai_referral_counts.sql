-- Visits that came from an AI assistant's answer (#62, PLAN 5.18: AI referrers counted separately).
-- Daily counters per assistant and kind of landing page, nothing else: no address, no user agent, no URL,
-- no visitor. Every count is one INSERT ... ON CONFLICT DO UPDATE (AiReferralCounts).

CREATE TABLE ai_referral_counts
(
    day    DATE   NOT NULL,
    source TEXT   NOT NULL,
    page   TEXT   NOT NULL,
    visits BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (day, source, page),
    -- az.jeparla.analytics.AiSource
    CONSTRAINT ai_referral_counts_source CHECK (source IN (
        'CHATGPT', 'PERPLEXITY', 'GEMINI', 'COPILOT', 'CLAUDE', 'DEEPSEEK', 'GROK', 'META_AI', 'MISTRAL', 'ALICE')),
    -- az.jeparla.analytics.LandingPage
    CONSTRAINT ai_referral_counts_page CHECK (page IN (
        'HOME', 'PRODUCT', 'STORE', 'CATEGORY', 'PRICES', 'GUIDE', 'OTHER')),
    CONSTRAINT ai_referral_counts_visits CHECK (visits >= 0)
);

COMMENT ON TABLE ai_referral_counts IS
    'Daily visits from AI assistants (#62) per assistant and landing page kind; no personal data';
