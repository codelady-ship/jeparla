-- The store's own declared terms (#108), next to its services and return terms (#174, V46): whether it makes
-- pieces to order and in how many days usually. NULL = not declared; the days only go with "yes".
ALTER TABLE stores
    ADD COLUMN made_to_order      BOOLEAN,
    ADD COLUMN made_to_order_days SMALLINT,
    ADD CONSTRAINT stores_made_to_order_days
        CHECK (made_to_order_days IS NULL OR (made_to_order_days BETWEEN 1 AND 365 AND made_to_order));
