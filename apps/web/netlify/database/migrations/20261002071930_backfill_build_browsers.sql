UPDATE "builds" SET "browsers" = COALESCE((
  SELECT array_agg(DISTINCT "snapshots"."metadata"->>'browser' ORDER BY "snapshots"."metadata"->>'browser')
  FROM "snapshots"
  WHERE "snapshots"."build_id" = "builds"."id"
    AND jsonb_typeof("snapshots"."metadata"->'browser') = 'string'
), '{}')
WHERE "builds"."status" = 'finalized';
