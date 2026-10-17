import { z } from "zod";
import { internal } from "./api.ts";
import {
  isNotifyConfigured,
  type Notification,
  sendNotification,
} from "./lib/notify.ts";
import { internalAction, type Scheduler } from "./server.ts";

export const send = internalAction({
  args: { title: z.string(), message: z.string(), link: z.string().optional() },
  handler: async (_ctx, notification) => {
    await sendNotification(notification);
    return null;
  },
});

export async function notifyLater(
  ctx: { scheduler: Scheduler },
  notification: Notification,
): Promise<void> {
  if (isNotifyConfigured()) {
    await ctx.scheduler.runAfter(0, internal.notify.send, notification);
  }
}
