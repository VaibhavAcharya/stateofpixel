export const LAB_OWNER = "lab.stateofpixel";

export function isLab(owner: string): boolean {
  return import.meta.env.DEV && owner === LAB_OWNER;
}
