INSERT INTO "account_members" ("user_id", "account_id", "role")
SELECT "repo_permissions"."user_id", "projects"."account_id",
  CASE WHEN bool_or("repo_permissions"."org_owner") THEN 'owner' ELSE 'member' END
FROM "repo_permissions"
INNER JOIN "projects" ON "projects"."id" = "repo_permissions"."project_id"
WHERE "repo_permissions"."permission" <> 'none'
GROUP BY "repo_permissions"."user_id", "projects"."account_id"
ON CONFLICT ("account_id", "user_id") DO NOTHING;
