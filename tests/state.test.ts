import assert from "node:assert/strict";
import test from "node:test";
import {
  createBackupPayload,
  normalizeAppState,
  restoreBackupText,
} from "../app/state";

test("normalizes legacy reminder data and clamps unsafe imported values", () => {
  const state = normalizeAppState({
    profile: {
      name: "  測試者  ",
      sex: "female",
      age: 8,
      height: 999,
      weight: -1,
      target: 999,
      activity: 99,
      goalMode: "cut",
    },
    reminders: { water: "07:30", waterInterval: 999 },
    foods: [
      {
        id: "food",
        logId: "log",
        date: "2026-07-21",
        name: "餐點",
        source: "測試",
        category: "測試",
        kcal: -100,
        protein: Number.NaN,
        carbs: 10,
        fat: 2,
        servings: 999,
      },
      { date: "not-a-date", name: "應被移除" },
    ],
  });
  assert.equal(state.profile.name, "測試者");
  assert.equal(state.profile.age, 18);
  assert.equal(state.profile.height, 230);
  assert.equal(state.profile.weight, 20);
  assert.equal(state.profile.target, 400);
  assert.equal(state.profile.activity, 1.25);
  assert.equal(state.reminders.waterStart, "07:30");
  assert.equal(state.reminders.waterInterval, 120);
  assert.equal(state.foods.length, 1);
  assert.equal(state.foods[0].kcal, 0);
  assert.equal(state.foods[0].protein, 0);
  assert.equal(state.foods[0].servings, 100);
});

test("round-trips a complete backup envelope", () => {
  const state = normalizeAppState({
    profile: { name: "小藍", sex: "female" },
    weights: [{ date: "2026-07-21", value: 58.2 }],
  });
  const restored = restoreBackupText(JSON.stringify(createBackupPayload(state)));
  assert.equal(restored.profile.name, "小藍");
  assert.deepEqual(restored.weights, [{ date: "2026-07-21", value: 58.2 }]);
});

test("rejects unrelated or future backup files", () => {
  assert.throws(() => restoreBackupText("{}"), /不是有效/);
  assert.throws(
    () =>
      restoreBackupText(
        JSON.stringify({ product: "真藍瘦", schemaVersion: 999, state: {} }),
      ),
    /不受支援/,
  );
});
