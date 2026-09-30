import type { Doc } from "../dataModel.ts";
import { env } from "../env.ts";

export function buildUrl(project: Doc<"projects">, number: number): string {
  return `${env.SITE_URL}/${project.owner}/${project.name}/builds/${number}`;
}
