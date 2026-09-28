import type { Doc } from "../_generated/dataModel";
import { env } from "../_generated/server";

export function buildUrl(project: Doc<"projects">, number: number): string {
  return `${env.SITE_URL}/${project.owner}/${project.name}/builds/${number}`;
}
