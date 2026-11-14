-- USD/EUR display rates (#53): AZN per one unit, from the same daily CBAR bulletin as the metals.
-- Display only: prices are stored and charged in AZN; a converted price is an approximation.
CREATE TABLE exchange_rates
(
    id           BIGSERIAL PRIMARY KEY,
    currency     CHAR(3)        NOT NULL CHECK (currency IN ('USD', 'EUR')),
    rate_date    DATE           NOT NULL,
    azn_per_unit NUMERIC(12, 6) NOT NULL CHECK (azn_per_unit > 0),
    fetched_at   TIMESTAMPTZ    NOT NULL,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT exchange_rates_currency_date_key UNIQUE (currency, rate_date)
);
