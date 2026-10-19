export interface VariantBase {
  durationMinutes: number;
  price: number;
}

export interface ProviderOverride {
  durationOverride: number | null;
  priceOverride: number | null;
}

// ባለሙያው ልዩ ዋጋ ወይም ጊዜ ካለው እሱ፣ ከሌለ የዘይቤው ነባሪ (0 እውነተኛ ዋጋ ነው፣ ነጻ)
export function resolveTerms(base: VariantBase, override?: ProviderOverride | null): VariantBase {
  return {
    durationMinutes: override?.durationOverride ?? base.durationMinutes,
    price: override?.priceOverride ?? base.price,
  };
}