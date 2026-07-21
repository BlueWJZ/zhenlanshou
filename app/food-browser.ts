import type { Food } from "./data";

type FoodFilter = {
  value: string;
  label: string;
  categories?: readonly string[];
  source?: string;
};

export const FOOD_FILTERS: readonly FoodFilter[] = [
  { value: "全部", label: "全部" },
  { value: "便利商店", label: "便利商店", source: "便利商店" },
  { value: "早餐", label: "早餐", categories: ["早餐"] },
  { value: "主食", label: "主食", categories: ["主食"] },
  { value: "蛋白質", label: "蛋白質", categories: ["蛋白質", "高蛋白"] },
  { value: "蔬菜", label: "蔬菜", categories: ["蔬菜"] },
  { value: "水果", label: "水果", categories: ["水果"] },
  {
    value: "正餐",
    label: "正餐",
    categories: ["便當", "正餐", "小吃", "單點", "速食", "高蛋白"],
  },
  { value: "飲品", label: "飲品", categories: ["飲品"] },
  { value: "點心", label: "點心", categories: ["點心", "甜點"] },
  { value: "運動後", label: "運動後", categories: ["運動後"] },
] as const;

export const DEFAULT_FOOD_GROUPS = [
  "早餐",
  "主食",
  "蛋白質",
  "蔬菜",
  "水果",
  "正餐",
  "飲品",
  "點心",
  "運動後",
] as const;

export function matchesFoodFilter(food: Food, value: string) {
  if (value === "全部") return true;
  const filter = FOOD_FILTERS.find((item) => item.value === value);
  if (!filter) return true;
  return (
    filter.source === food.source ||
    Boolean(filter.categories?.includes(food.category))
  );
}

const baseName = (name: string) =>
  name
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/＋.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const uniqueFoods = (foods: Food[]) => {
  const seen = new Set<string>();
  return foods.filter((food) => {
    const key = baseName(food.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function getDefaultFoodSelection(foods: Food[], filter: string) {
  if (filter !== "全部") return uniqueFoods(foods).slice(0, 12);

  const selected: Food[] = [];
  const used = new Set<string>();
  DEFAULT_FOOD_GROUPS.forEach((group) => {
    const food = foods.find(
      (candidate) =>
        matchesFoodFilter(candidate, group) &&
        !used.has(baseName(candidate.name)),
    );
    if (!food) return;
    selected.push(food);
    used.add(baseName(food.name));
  });
  return selected;
}
