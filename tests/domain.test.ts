import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateEnergyTotals,
  calculateExerciseCalories,
  getDueReminders,
  type ReminderSchedule,
} from "../app/domain";

const profile = {
  sex: "male" as const,
  age: 30,
  height: 170,
  weight: 70,
  target: 65,
  activity: 1.2,
  goalMode: "maintain" as const,
};

test("uses sex-specific Mifflin-St Jeor coefficients", () => {
  const male = calculateEnergyTotals(profile, [], []);
  const female = calculateEnergyTotals({ ...profile, sex: "female" }, [], []);
  assert.equal(male.bmr, 1618);
  assert.equal(female.bmr, 1452);
  assert.equal(male.bmr - female.bmr, 166);
});

test("calculates intake, exercise and daily balance without accepting NaN", () => {
  const totals = calculateEnergyTotals(
    profile,
    [
      {
        kcal: 500,
        protein: 30,
        carbs: 60,
        fat: 15,
        sodium: 800,
        sugar: 5,
        fiber: 6,
        servings: 1.5,
      },
      {
        kcal: Number.NaN,
        protein: -2,
        carbs: 0,
        fat: 0,
        servings: 1,
      },
    ],
    [{ kcal: 300 }, { kcal: Number.NaN }],
  );
  assert.equal(totals.intake, 750);
  assert.equal(totals.protein, 45);
  assert.equal(totals.exercise, 300);
  assert.equal(totals.balance, totals.intake - totals.maintenance);
});

test("calculates MET exercise calories", () => {
  assert.equal(calculateExerciseCalories(8.3, 70, 40), 407);
  assert.equal(calculateExerciseCalories(Number.NaN, 70, 40), 0);
  assert.equal(calculateExerciseCalories(8.3, -70, 40), 0);
});

const reminders: ReminderSchedule = {
  enabled: true,
  breakfast: "08:00",
  lunch: "12:30",
  dinner: "19:00",
  waterEnabled: true,
  waterStart: "09:00",
  waterEnd: "21:00",
  waterInterval: 120,
};

test("catches a reminder delayed by browser throttling within the grace window", () => {
  const meal = getDueReminders(reminders, new Date(2026, 6, 21, 8, 4));
  assert.equal(meal[0]?.id, "meal-breakfast");
  assert.equal(meal[0]?.scheduledTime, "08:00");

  const water = getDueReminders(reminders, new Date(2026, 6, 21, 11, 4));
  assert.equal(water[0]?.id, "water");
  assert.equal(water[0]?.scheduledTime, "11:00");
});

test("does not send stale or invalid reminder schedules", () => {
  assert.deepEqual(
    getDueReminders(reminders, new Date(2026, 6, 21, 8, 6)),
    [],
  );
  assert.deepEqual(
    getDueReminders(
      { ...reminders, enabled: false, waterStart: "22:00", waterEnd: "08:00" },
      new Date(2026, 6, 21, 23, 0),
    ),
    [],
  );
});
