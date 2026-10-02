import type * as schema from "./schema.ts";

type Tables = {
  users: typeof schema.users;
  connections: typeof schema.connections;
  accounts: typeof schema.accounts;
  accountMembers: typeof schema.accountMembers;
  projects: typeof schema.projects;
  projectTokens: typeof schema.projectTokens;
  builds: typeof schema.builds;
  deletedBuilds: typeof schema.deletedBuilds;
  snapshots: typeof schema.snapshots;
  reviews: typeof schema.reviews;
  comments: typeof schema.comments;
  approvedImages: typeof schema.approvedImages;
  images: typeof schema.images;
  usageDaily: typeof schema.usageDaily;
  repoPermissions: typeof schema.repoPermissions;
  githubEvents: typeof schema.githubEvents;
  jobs: typeof schema.jobs;
};

export type TableName = keyof Tables;

export type Id<_Table extends TableName> = string;

export type Doc<Table extends TableName> = Tables[Table]["$inferSelect"];
