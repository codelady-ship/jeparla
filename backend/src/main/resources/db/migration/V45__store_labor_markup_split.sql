-- Price breakdown (#104): the seller chooses whether the product page shows labor and the store's
-- markup as two lines or as one line "labor and store share" (the default).
ALTER TABLE stores
    ADD COLUMN split_labor_markup BOOLEAN NOT NULL DEFAULT FALSE;
