-- WhatsApp clicks per ready question (#111): which question the buyer picked on the product page
-- before opening WhatsApp. Same rules as product_contact_clicks: a counter per product, day
-- (Asia/Baku) and question kind, no IP address, no user id, no message text.
CREATE TABLE product_contact_question_clicks
(
    product_id BIGINT      NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    day        DATE        NOT NULL,
    question   VARCHAR(16) NOT NULL,
    clicks     BIGINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, day, question),
    CONSTRAINT product_contact_question_clicks_clicks CHECK (clicks >= 0),
    CONSTRAINT product_contact_question_clicks_question
        CHECK (question IN ('GENERAL', 'AVAILABILITY', 'SIZE', 'VISIT', 'PRICE'))
);
