import {
  calculateEnergyTotals,
  type EnergyExercise,
  type EnergyFood,
  type EnergyProfile,
} from "./domain";
import type { WeightLog } from "./state";

const pad = (value: number) => String(value).padStart(2, "0");

export function getCalendarMonthDates(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return Array<string | null>(42).fill(null);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return Array<string | null>(42).fill(null);

  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth
      ? `${year}-${pad(monthIndex + 1)}-${pad(day)}`
      : null;
  });
}

export function shiftMonthKey(monthKey: string, amount: number) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const date = new Date(Number(match[1]), Number(match[2]) - 1 + amount, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function calculateDailyDeficit(
  profile: EnergyProfile,
  foods: EnergyFood[],
  exercises: EnergyExercise[],
) {
  const totals = calculateEnergyTotals(profile, foods, exercises);
  return {
    intake: Math.round(totals.intake),
    exercise: Math.round(totals.exercise),
    maintenance: Math.round(totals.maintenance),
    deficit: foods.length
      ? Math.round(totals.maintenance - totals.intake)
      : null,
  };
}

export function upsertWeightLog(
  weights: WeightLog[],
  date: string,
  value: number,
) {
  const next = [
    ...weights.filter((item) => item.date !== date),
    { date, value: Math.round(value * 10) / 10 },
  ].sort((a, b) => a.date.localeCompare(b.date));
  return {
    weights: next,
    latestWeight: next[next.length - 1]?.value ?? value,
  };
}

export function getWeightOnDate(
  weights: WeightLog[],
  date: string,
  fallback: number,
) {
  const applicable = weights
    .filter((item) => item.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date));
  return applicable[applicable.length - 1]?.value ?? fallback;
}
