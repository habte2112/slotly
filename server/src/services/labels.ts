// "Haircut" + "Fade" → "Haircut · Fade"
export function serviceLabel(serviceName: string, variantName?: string | null): string {
  return variantName ? `${serviceName} · ${variantName}` : serviceName;
}