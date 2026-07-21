import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDailyDeficit,
  getCalendarMonthDates,
  getWeightOnDate,
  shiftMonthKey,
  upsertWeightLog,
} from "../app/calendar";

const profile = {
  sex: "female" as const,
  age: 32,
  height: 165,
  weight: 60,
  target: 55,
  activity: 1.2,
  goalMode: "cut" as const,
};

test("builds a complete six-week month grid including leap day", () => {
  const dates = getCalendarMonthDates("2028-02");
  assert.equal(dates.length, 42);
  assert.ok(dates.includes("2028-02-29"));
  assert.equal(dates.filter(Boolean).length, 29);
});

test("shifts month keys across year boundaries", () => {
  assert.equal(shiftMonthKey("2026-12", 1), "2027-01");
  assert.equal(shiftMonthKey("2026-01", -1), "2025-12");
});

test("calculates deficit against maintenance only when food was logged", () => {
  const empty = calculateDailyDeficit(profile, [], [{ kcal: 200 }]);
  assert.equal(empty.deficit, null);

  const logged = calculateDailyDeficit(
    profile,
    [
      {
        kcal: 1500,
        protein: 80,
        carbs: 160,
        fat: 50,
        servings: 1,
      },
    ],
    [{ kcal: 200 }],
  );
  assert.equal(logged.deficit, logged.maintenance - 1500);
  assert.equal(logged.exercise, 200);
});

test("replaces a daily weight and keeps the newest date as current", () => {
  const result = upsertWeightLog(
    [
      { date: "2026-07-20", value: 70.2 },
      { date: "2026-07-22", value: 69.8 },
    ],
    "2026-07-20",
    70.05,
  );
  assert.deepEqual(result.weights, [
    { date: "2026-07-20", value: 70.1 },
    { date: "2026-07-22", value: 69.8 },
  ]);
  assert.equal(result.latestWeight, 69.8);
});

test("uses the most recent available weight for a historical date", () => {
  const weights = [
    { date: "2026-07-02", value: 70.4 },
    { date: "2026-07-12", value: 69.9 },
    { date: "2026-07-22", value: 69.2 },
  ];
  assert.equal(getWeightOnDate(weights, "2026-07-15", 72), 69.9);
  assert.equal(getWeightOnDate(weights, "2026-06-30", 72), 72);
});
