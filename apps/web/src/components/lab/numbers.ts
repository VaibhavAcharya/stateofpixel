import type { Priced } from "../../content/compare";
import {
  ARGOS,
  CHROMATIC,
  cheapestPlan,
  PERCY,
} from "../../lib/competitorPricing";
import { DEFAULT_SUITE, quote, type Suite } from "../compare/CostCalculator";
import { DEFAULT_WORKLOAD, estimate, TIERS } from "../landing/Pricing";

export const RIVALS: Priced[] = ["argos", "chromatic", "percy"];

export const count = new Intl.NumberFormat("en-US");

export function monthlyBills(suite: Suite = DEFAULT_SUITE) {
  return quote(suite, RIVALS);
}

const defaults = estimate(DEFAULT_WORKLOAD);

export const SNAPSHOTS_PER_GB = defaults.snapshots / defaults.stored;

export function tierReach(gigabytes: number) {
  const snapshots = Math.floor((gigabytes * SNAPSHOTS_PER_GB) / 1000) * 1000;
  return {
    snapshots,
    chromatic: Math.round(cheapestPlan(CHROMATIC, snapshots).cost),
    argos: Math.round(cheapestPlan(ARGOS, snapshots).cost),
    percy: Math.round(cheapestPlan(PERCY, snapshots).cost),
  };
}

export const FREE_TIER = TIERS[0];
