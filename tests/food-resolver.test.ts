import assert from "node:assert/strict";
import test from "node:test";
import type { Food } from "../app/data";
import {
  foodFromOpenFoodFacts,
  parseFoodText,
  parseNutritionLabel,
} from "../app/food-resolver";

const foods: Food[] = [
  {
    id: "egg",
    name: "茶葉蛋 1 顆",
    source: "便利商店",
    category: "蛋白質",
    kcal: 75,
    protein: 7,
    carbs: 1,
    fat: 5,
    servingGrams: 50,
  },
  {
    id: "chicken",
    name: "雞胸肉 100g",
    source: "便利商店",
    category: "蛋白質",
    kcal: 120,
    protein: 24,
    carbs: 2,
    fat: 2,
    servingGrams: 100,
  },
  {
    id: "seven",
    name: "7-ELEVEN 茶葉蛋",
    source: "便利商店",
    category: "蛋白質",
    kcal: 75,
    protein: 7,
    carbs: 1,
    fat: 5,
  },
];

test("parses units and gram-based servings", () => {
  const result = parseFoodText("2顆茶葉蛋、雞胸肉 200g", foods);
  assert.equal(result.unmatched.length, 0);
  assert.equal(result.matched[0].servings, 2);
  assert.equal(result.matched[1].servings, 2);
});

test("does not mistake digits inside a brand name for quantity", () => {
  const result = parseFoodText("7-ELEVEN 茶葉蛋", foods);
  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].servings, 1);
  assert.equal(result.matched[0].food.id, "seven");
});

test("accepts serving quantities that include a unit string", () => {
  const food = foodFromOpenFoodFacts("4710000000000", {
    product_name: "測試牛奶",
    serving_quantity: "250 ml",
    serving_size: "250 ml",
    nutriments: {
      "energy-kcal_100g": 60,
      proteins_100g: 3.2,
      carbohydrates_100g: 5,
      fat_100g: 3,
      sodium_100g: 0.04,
    },
  });
  assert.equal(food?.servingGrams, 250);
  assert.equal(food?.kcal, 150);
  assert.equal(food?.sodium, 100);
});

test("parses common Chinese nutrition label fields", () => {
  const food = parseNutritionLabel(
    "熱量 188 大卡 蛋白質 10.5 公克 脂肪 4.2 公克 碳水化合物 26 公克 鈉 320 毫克",
  );
  assert.equal(food.kcal, 188);
  assert.equal(food.protein, 10.5);
  assert.equal(food.sodium, 320);
});
