import type { Food } from "./data";

export type ParsedFoodItem = {
  raw: string;
  food: Food;
  servings: number;
  quantityLabel: string;
};

export type FoodSourceMeta = {
  label: string;
  detail: string;
  tone: "official" | "label" | "community" | "estimated";
};

const normalizeName = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[（）()\[\]【】・.。\s_-]/g, "")
    .replace(/一份|1份|一個|1個|一顆|1顆/g, "");

const splitInput = (text: string) =>
  text
    .normalize("NFKC")
    .replace(/今天|我吃了|我吃|早餐|午餐|晚餐|點心|宵夜/g, "")
    .replace(
      /(顆|個|份|杯|瓶|碗|片|塊|支|根|盒|包|克|g)\s+(?=[\p{Script=Han}A-Za-z])/giu,
      "$1＋",
    )
    .split(/[+＋、,，;；\n]|(?:\s+[與和跟及]\s*)/)
    .map((part) => part.trim())
    .filter(Boolean);

const quantityUnits =
  "公斤|kg|公克|克|g|毫升|ml|顆|個|份|杯|瓶|碗|片|塊|支|根|盒|包";

const extractQuantity = (raw: string) => {
  const leadingWithUnit = raw.match(
    new RegExp(`^(\\d+(?:\\.\\d+)?)(?![-/])\\s*(${quantityUnits})\\s*`, "i"),
  );
  const leadingPlain = raw.match(/^(\d+(?:\.\d+)?)(?![-/])\s+/i);
  const trailing = raw.match(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${quantityUnits})\\s*$`, "i"),
  );
  const match = leadingWithUnit || leadingPlain || trailing;
  if (!match) return null;
  const quantity = Number(match[1]);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return {
    match: match[0],
    index: match.index || 0,
    quantity,
    unit: match[2]?.toLowerCase() || "份",
  };
};

const findBestFood = (query: string, foods: Food[]) => {
  const needle = normalizeName(query);
  if (!needle) return undefined;

  let best: { food: Food; score: number } | undefined;
  for (const food of foods) {
    const candidates = [food.name, ...(food.aliases || [])].map(normalizeName);
    const score = Math.max(
      ...candidates.map((candidate) => {
        if (!candidate) return 0;
        if (candidate === needle) return 1000;
        if (candidate.startsWith(needle))
          return 820 - (candidate.length - needle.length);
        if (needle.startsWith(candidate))
          return 780 - (needle.length - candidate.length);
        if (candidate.includes(needle))
          return 650 - (candidate.length - needle.length);
        if (needle.includes(candidate))
          return 620 - (needle.length - candidate.length);
        return 0;
      }),
    );
    const singleBonus =
      /[＋+]/.test(food.name) && !/[＋+]/.test(query) ? -80 : 0;
    const officialBonus = food.dataSource === "tfda" ? 8 : 0;
    const finalScore = score + singleBonus + officialBonus;
    if (finalScore > (best?.score || 0)) best = { food, score: finalScore };
  }
  return best && best.score >= 560 ? best.food : undefined;
};

export const parseFoodText = (text: string, foods: Food[]) => {
  const matched: ParsedFoodItem[] = [];
  const unmatched: string[] = [];

  for (const raw of splitInput(text)) {
    const quantityMatch = extractQuantity(raw);
    const quantity = quantityMatch?.quantity || 1;
    const unit = quantityMatch?.unit || "份";
    const withoutQuantity = quantityMatch
      ? `${raw.slice(0, quantityMatch.index)} ${raw.slice(quantityMatch.index + quantityMatch.match.length)}`
      : raw;
    const query = withoutQuantity
      .replace(/約|大約|左右|半份/g, "")
      .trim();
    const food = findBestFood(query || raw, foods);
    if (!food) {
      unmatched.push(raw);
      continue;
    }

    let servings = quantity;
    if (["公斤", "kg", "公克", "克", "g", "毫升", "ml"].includes(unit)) {
      const amount = ["公斤", "kg"].includes(unit) ? quantity * 1000 : quantity;
      servings = amount / Math.max(1, food.servingGrams || 100);
    } else if (!quantityMatch) {
      servings = /半份/.test(raw) ? 0.5 : 1;
    }

    matched.push({
      raw,
      food,
      servings: Math.min(100, Math.max(0.05, Math.round(servings * 100) / 100)),
      quantityLabel: quantityMatch
        ? `${quantity}${unit}`
        : food.servingLabel || "1份",
    });
  }

  return { matched, unmatched };
};

export const getFoodSourceMeta = (food: Food): FoodSourceMeta => {
  switch (food.dataSource) {
    case "tfda":
      return { label: "官方資料", detail: "衛福部食藥署", tone: "official" };
    case "nutrition-label":
      return {
        label: "包裝標示",
        detail: "依使用者拍攝的營養標示",
        tone: "label",
      };
    case "open-food-facts":
      return {
        label: "條碼資料",
        detail: "Open Food Facts 社群資料",
        tone: "community",
      };
    case "user":
      return { label: "自行輸入", detail: "使用者建立", tone: "estimated" };
    case "ai":
      return {
        label: "AI 估算",
        detail: "可能因份量與烹調方式產生誤差",
        tone: "estimated",
      };
    default:
      return { label: "外食估算", detail: "真藍瘦估算資料", tone: "estimated" };
  }
};

type OpenFoodFactsProduct = {
  product_name?: string;
  brands?: string;
  serving_quantity?: number | string;
  serving_size?: string;
  nutriments?: Record<string, number | string | undefined>;
};

const numeric = (value: number | string | undefined) => {
  const parsed =
    typeof value === "string"
      ? Number.parseFloat(value.replace(",", "."))
      : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const foodFromOpenFoodFacts = (
  barcode: string,
  product: OpenFoodFactsProduct,
): Food | null => {
  const nutrients = product.nutriments || {};
  const servingGrams = numeric(product.serving_quantity) || 100;
  const factor = servingGrams / 100;
  const perServing = (name: string) => {
    const direct = numeric(nutrients[`${name}_serving`]);
    return direct || numeric(nutrients[`${name}_100g`]) * factor;
  };
  const kcal = perServing("energy-kcal");
  if (!product.product_name || !kcal) return null;

  return {
    id: `barcode-${barcode}`,
    name: product.product_name,
    source: product.brands || "包裝食品",
    category: "條碼食品",
    kcal: Math.round(kcal),
    protein: Math.round(perServing("proteins") * 10) / 10,
    carbs: Math.round(perServing("carbohydrates") * 10) / 10,
    fat: Math.round(perServing("fat") * 10) / 10,
    sodium: Math.round(perServing("sodium") * 1000),
    sugar: Math.round(perServing("sugars") * 10) / 10,
    fiber: Math.round(perServing("fiber") * 10) / 10,
    servingGrams,
    servingLabel: product.serving_size || `${servingGrams}g`,
    barcode,
    dataSource: "open-food-facts",
    sourceName: "Open Food Facts",
    sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
    confidence: "community",
  };
};

const labelNumber = (text: string, labels: string[]) => {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:：]?\\s*(\\d+(?:\\.\\d+)?)`, "i");
    const value = text.match(pattern)?.[1];
    if (value) return Number(value);
  }
  return 0;
};

export const parseNutritionLabel = (text: string): Food => ({
  id: `label-${Date.now()}`,
  name: "營養標示食品",
  source: "營養標示",
  category: "包裝食品",
  kcal: labelNumber(text, ["熱量", "energy(?:-kcal)?"]),
  protein: labelNumber(text, ["蛋白質", "protein"]),
  carbs: labelNumber(text, ["碳水化合物", "carbohydrates?"]),
  fat: labelNumber(text, ["脂肪", "fat"]),
  sodium: labelNumber(text, ["鈉", "sodium"]),
  sugar: labelNumber(text, ["糖", "sugars?"]),
  fiber: labelNumber(text, ["膳食纖維", "dietary fiber", "fiber"]),
  servingLabel: "營養標示每份",
  dataSource: "nutrition-label",
  sourceName: "產品包裝營養標示",
  confidence: "label",
});
