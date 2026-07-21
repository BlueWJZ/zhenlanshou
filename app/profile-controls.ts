export const PROFILE_AGE_OPTIONS = Array.from(
  { length: 83 },
  (_, index) => index + 18,
);

export const PROFILE_HEIGHT_OPTIONS = Array.from(
  { length: 111 },
  (_, index) => index + 120,
);

export const PROFILE_WEIGHT_WHOLE_OPTIONS = Array.from(
  { length: 381 },
  (_, index) => index + 20,
);

export const PROFILE_WEIGHT_TENTH_OPTIONS = Array.from(
  { length: 10 },
  (_, index) => index,
);

export function splitProfileWeight(value: number) {
  const safe = Math.min(400, Math.max(20, Number.isFinite(value) ? value : 70));
  const tenths = Math.round(safe * 10);
  return {
    whole: Math.floor(tenths / 10),
    tenth: tenths % 10,
  };
}

export function composeProfileWeight(whole: number, tenth: number) {
  const safeWhole = Math.min(400, Math.max(20, Math.round(whole)));
  const safeTenth = Math.min(9, Math.max(0, Math.round(tenth)));
  return Math.min(400, Number((safeWhole + safeTenth / 10).toFixed(1)));
}
