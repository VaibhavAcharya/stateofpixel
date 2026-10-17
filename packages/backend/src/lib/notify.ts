import { env } from "../env.ts";

export type Notification = { title: string; message: string; link?: string };

export function isNotifyConfigured(): boolean {
  return env.NOTIFY_URL !== undefined && env.NOTIFY_API_KEY !== undefined;
}

export async function sendNotification(
  notification: Notification,
): Promise<void> {
  if (env.NOTIFY_URL === undefined || env.NOTIFY_API_KEY === undefined) {
    return;
  }
  const response = await fetch(env.NOTIFY_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.NOTIFY_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ project: "stateofpixel", ...notification }),
  });
  if (!response.ok && response.status !== 429) {
    throw new Error(`Notify API returned ${response.status}`);
  }
}
