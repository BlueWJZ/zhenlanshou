import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMealPlan,
  type MealPlanContext,
} from "../app/meal-plan";

const context: MealPlanContext = {
  targetCalories: 1900,
  intakeCalories: 0,
  proteinTarget: 112,
  proteinIntake: 0,
  exerciseCalories: 0,
  goalMode: "cut",
  date: "2026-07-21",
  seed: 0,
  preference: "auto",
  loggedMeals: [],
};

test("builds a complete deterministic menu without duplicate dishes", () => {
  const first = buildMealPlan(context);
  const second = buildMealPlan(context);
  assert.deepEqual(first, second);
  assert.equal(first.items.length, 4);
  assert.equal(new Set(first.items.map((item) => item.food.name)).size, 4);
  assert.ok(first.totalKcal > 1100 && first.totalKcal < 2500);
  assert.ok(first.candidateCount > 100);
});

test("rotates through many genuinely different menu combinations", () => {
  const signatures = new Set(
    Array.from({ length: 24 }, (_, seed) =>
      buildMealPlan({ ...context, seed }).items
        .map((item) => item.food.name.replace(/（[^）]*）/g, ""))
        .join("|"),
    ),
  );
  assert.ok(signatures.size >= 18, `only generated ${signatures.size} menus`);
});

test("uses remaining calories and skips meals that were already logged", () => {
  const plan = buildMealPlan({
    ...context,
    intakeCalories: 720,
    proteinIntake: 42,
    loggedMeals: ["早餐", "午餐"],
  });
  assert.equal(plan.isRemainderPlan, true);
  assert.deepEqual(
    plan.items.map((item) => item.meal),
    ["晚餐", "點心"],
  );
  assert.match(plan.reason, /已扣除今天記錄/);
});

test("respects convenience-store and ovo-lacto vegetarian situations", () => {
  const convenience = buildMealPlan({
    ...context,
    preference: "convenience",
  });
  assert.ok(
    convenience.items.every((item) => item.food.source === "便利商店"),
  );

  const vegetarian = buildMealPlan({ ...context, preference: "vegetarian" });
  assert.ok(vegetarian.items.length === 4);
  assert.ok(vegetarian.tags.includes("蛋奶素候選"));
  assert.ok(
    vegetarian.items.every(
      (item) =>
        item.food.source === "素食" ||
        !/雞|鴨|鵝|豬|牛|羊|肉|魚|蝦|蟹|鮪|鮭|鯖|火腿|培根/.test(
          item.food.name,
        ),
    ),
  );
});
