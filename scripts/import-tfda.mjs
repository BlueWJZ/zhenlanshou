import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const input = resolve(process.argv[2] || "/tmp/tfda-food/20_5.json");
const output = resolve(process.argv[3] || "app/tfda-foods.json");
const rows = JSON.parse(await readFile(input, "utf8"));

const nutrientMap = new Map([
  ["熱量", "kcal"],
  ["修正熱量", "kcal"],
  ["粗蛋白", "protein"],
  ["總碳水化合物", "carbs"],
  ["粗脂肪", "fat"],
  ["鈉", "sodium"],
  ["糖質總量", "sugar"],
  ["膳食纖維", "fiber"],
]);

const parseNumber = (value) => {
  if (value == null) return undefined;
  const normalized = String(value).trim().replaceAll(",", "");
  if (!normalized || /^(Tr|微量|N\/A|ND|--|－)$/i.test(normalized)) return 0;
  const parsed = Number(normalized.match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const foods = new Map();
for (const row of rows) {
  const field = nutrientMap.get(row["分析項"]);
  if (!field) continue;

  const id = row["整合編號"];
  if (!id || !row["樣品名稱"]) continue;

  if (!foods.has(id)) {
    const servingGrams = parseNumber(row["每單位重"]);
    const aliases = String(row["俗名"] || "")
      .split(/[、,，;；/]/)
      .map((item) => item.trim())
      .filter(Boolean);
    foods.set(id, {
      id: `tfda-${id}`,
      name: row["樣品名稱"],
      source: "食藥署",
      category: row["食品分類"] || "官方食品",
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      sodium: 0,
      sugar: 0,
      fiber: 0,
      aliases,
      servingGrams: servingGrams && servingGrams > 0 ? servingGrams : 100,
      servingLabel: servingGrams && servingGrams > 0 ? "1 單位" : "100g",
      dataSource: "tfda",
      sourceName: "衛生福利部食品藥物管理署",
      sourceUrl: "https://data.gov.tw/dataset/8543",
      confidence: "official",
    });
  }

  const food = foods.get(id);
  const per100g = parseNumber(row["每100克含量"]);
  const perServing = parseNumber(row["每單位重含量"]);
  if (per100g === undefined) continue;

  // 有官方「每單位」數值時直接採用，否則預設以 100g 為一份。
  const value =
    food.servingLabel === "100g" || perServing === undefined
      ? per100g
      : perServing;
  // 「修正熱量」與「熱量」重複時，以後出現的官方值覆蓋即可。
  food[field] = value;
}

const result = [...foods.values()]
  .filter((food) => food.kcal > 0 && food.protein >= 0)
  .sort(
    (a, b) =>
      a.category.localeCompare(b.category, "zh-Hant") ||
      a.name.localeCompare(b.name, "zh-Hant"),
  );

// 以陣列儲存，避免 2,000 多筆資料重複欄位名稱，降低手機首次載入量。
const compact = result.map((food) => [
  food.id,
  food.name,
  food.category,
  food.kcal,
  food.protein,
  food.carbs,
  food.fat,
  food.sodium,
  food.sugar,
  food.fiber,
  food.aliases,
  food.servingGrams,
  food.servingLabel,
]);

await writeFile(output, `${JSON.stringify(compact)}\n`, "utf8");
console.log(`Imported ${result.length} TFDA foods into ${output}`);
