function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export const env = {
  get GITHUB_APP_ID() {
    return required("GITHUB_APP_ID");
  },
  get GITHUB_APP_SLUG() {
    return required("GITHUB_APP_SLUG");
  },
  get GITHUB_APP_PRIVATE_KEY() {
    return required("GITHUB_APP_PRIVATE_KEY");
  },
  get GITHUB_APP_CLIENT_ID() {
    return required("GITHUB_APP_CLIENT_ID");
  },
  get GITHUB_APP_CLIENT_SECRET() {
    return required("GITHUB_APP_CLIENT_SECRET");
  },
  get GITHUB_WEBHOOK_SECRET() {
    return required("GITHUB_WEBHOOK_SECRET");
  },
  get SITE_URL() {
    return required("SITE_URL");
  },
  get IMAGE_URL_SECRET() {
    return required("IMAGE_URL_SECRET");
  },
  get CONNECTION_SECRET() {
    return required("CONNECTION_SECRET");
  },
  get STATEOFPIXEL_SELF_HOSTED() {
    return process.env.STATEOFPIXEL_SELF_HOSTED === "true";
  },
  get DODO_PAYMENTS_API_KEY() {
    return process.env.DODO_PAYMENTS_API_KEY;
  },
  get DODO_PAYMENTS_WEBHOOK_SECRET() {
    return process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
  },
  get DODO_PAYMENTS_ENVIRONMENT(): "test_mode" | "live_mode" | undefined {
    const value = process.env.DODO_PAYMENTS_ENVIRONMENT;
    return value === "test_mode" || value === "live_mode" ? value : undefined;
  },
};
