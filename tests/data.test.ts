import assert from "node:assert/strict";
import test from "node:test";
import {
  EXERCISES,
  FOOD_LIBRARY,
  SINGLE_FOODS,
  TFDA_FOODS,
} from "../app/data";

test("ships the promised food and exercise catalog sizes", () => {
  assert.ok(FOOD_LIBRARY.length >= 500);
  assert.ok(TFDA_FOODS.length >= 2000);
  assert.ok(SINGLE_FOODS.length >= 100);
  assert.ok(EXERCISES.length >= 30);
});

test("keeps food identifiers unique and nutrition values finite", () => {
  const foods = [...FOOD_LIBRARY, ...SINGLE_FOODS, ...TFDA_FOODS];
  assert.equal(new Set(foods.map((food) => food.id)).size, foods.length);
  for (const food of foods) {
    assert.ok(food.name.trim(), `missing name: ${food.id}`);
    for (const key of ["kcal", "protein", "carbs", "fat"] as const) {
      assert.ok(Number.isFinite(food[key]), `${food.id}.${key} is not finite`);
      assert.ok(food[key] >= 0, `${food.id}.${key} is negative`);
    }
  }
});

test("keeps exercise MET values in a plausible positive range", () => {
  assert.equal(new Set(EXERCISES.map((item) => item.name)).size, EXERCISES.length);
  for (const exercise of EXERCISES) {
    assert.ok(exercise.met >= 1 && exercise.met <= 20, exercise.name);
  }
});
