export const CONTAINER_TYPES = [
  { value: "DRY_20", label: "Standard Dry Container (20 ft)" },
  { value: "DRY_40", label: "Standard Dry Container (40 ft)" },
  { value: "REEFER", label: "Refrigerated Container (Reefer)" },
] as const;

export type ContainerType = (typeof CONTAINER_TYPES)[number]["value"];

export const PRICE_CURRENCIES = ["USD", "EUR", "AED", "INR", "IRR"] as const;

export function containerTypeLabel(value?: string | null) {
  return CONTAINER_TYPES.find((item) => item.value === value)?.label || value || "-";
}

export function estimatedWeightTons(packagingKg: number, numberOfBoxes: number) {
  if (!packagingKg || !numberOfBoxes) return 0;
  return (packagingKg * numberOfBoxes) / 1000;
}

export function isQuoteExpired(validityDate?: string | null) {
  if (!validityDate) return false;
  return new Date(validityDate).getTime() < Date.now();
}
