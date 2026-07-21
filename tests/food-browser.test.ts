import assert from "node:assert/strict";
import test from "node:test";
import { FOOD_LIBRARY, SINGLE_FOODS } from "../app/data";
import {
  DEFAULT_FOOD_GROUPS,
  FOOD_FILTERS,
  getDefaultFoodSelection,
  matchesFoodFilter,
} from "../app/food-browser";

const foods = [...SINGLE_FOODS, ...FOOD_LIBRARY];

test("default browser shows one representative for each useful group", () => {
  const selection = getDefaultFoodSelection(foods, "全部");
  assert.equal(selection.length, DEFAULT_FOOD_GROUPS.length);
  DEFAULT_FOOD_GROUPS.forEach((group) =>
    assert.ok(selection.some((food) => matchesFoodFilter(food, group))),
  );
});

test("food filters merge redundant database categories", () => {
  const values = FOOD_FILTERS.map((filter) => filter.value);
  assert.ok(values.includes("便利商店"));
  assert.ok(!values.includes("食藥署"));
  assert.ok(!values.includes("官方資料"));
  ["便當", "小吃", "單點", "速食", "高蛋白", "甜點"].forEach(
    (value) => assert.ok(!values.includes(value)),
  );
});

test("merged categories remain searchable through clear labels", () => {
  const meal = foods.find((food) => food.category === "便當");
  const dessert = foods.find((food) => food.category === "甜點");
  const proteinMeal = foods.find((food) => food.category === "高蛋白");
  assert.ok(meal && matchesFoodFilter(meal, "正餐"));
  assert.ok(dessert && matchesFoodFilter(dessert, "點心"));
  assert.ok(proteinMeal && matchesFoodFilter(proteinMeal, "蛋白質"));
});

test("a grouped view avoids filling the page with portion variants", () => {
  const meals = foods.filter((food) => matchesFoodFilter(food, "正餐"));
  const selection = getDefaultFoodSelection(meals, "正餐");
  assert.ok(selection.length > 1);
  assert.equal(
    new Set(selection.map((food) => food.name.replace(/（[^）]*）/g, ""))).size,
    selection.length,
  );
});
