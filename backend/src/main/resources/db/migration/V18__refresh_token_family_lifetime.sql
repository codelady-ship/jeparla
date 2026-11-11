-- Absolute lifetime of a session (#134). Every refresh used to start a new 30-day token, so a session that was
-- refreshed now and then never ended. Each family now ends a fixed time after its login (jeparla.auth.
-- refresh-family-ttl, 90 days); the API copies the end to every token of the family and never issues a token
-- that outlives it.
--
-- Existing families end 90 days after their first token, or when their newest token expires if that is later,
-- so no token row breaks the new CHECK. No new table: the runtime role keeps its grants (V16).

ALTER TABLE refresh_tokens
    ADD COLUMN family_expires_at TIMESTAMPTZ;

UPDATE refresh_tokens t
SET family_expires_at = f.ends_at
FROM (SELECT family_id, GREATEST(min(created_at) + INTERVAL '90 days', max(expires_at)) AS ends_at
      FROM refresh_tokens
      GROUP BY family_id) f
WHERE f.family_id = t.family_id;

ALTER TABLE refresh_tokens
    ALTER COLUMN family_expires_at SET NOT NULL,
    ADD CONSTRAINT refresh_tokens_within_family CHECK (expires_at <= family_expires_at);
