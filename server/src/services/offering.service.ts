import { prisma } from "../lib/prisma";
import { resolveTerms } from "./variants";

export interface Offering {
  ok: true;
  service: { id: string; name: string };
  variant: { id: string; name: string } | null;
  durationMinutes: number;
  price: number;
}

export interface OfferingFailure {
  ok: false;
  status: 400 | 404;
  message: string;
}

// ለአንድ (ባለሙያ፣ አገልግሎት፣ ዘይቤ) የሚሰራውን ጊዜ እና ዋጋ ይወስናል፤ ደንቦቹ እዚህ ይተገበራሉ
export async function resolveOffering(
  providerId: string,
  serviceId: string,
  variantId?: string | null,
): Promise<Offering | OfferingFailure> {
  const link = await prisma.providerService.findUnique({
    where: { providerId_serviceId: { providerId, serviceId } },
    include: { service: true },
  });
  if (!link || !link.service.isActive) {
    return { ok: false, status: 404, message: "Provider does not offer this service" };
  }
  const service = link.service;

  const activeStyles = await prisma.serviceVariant.count({ where: { serviceId, isActive: true } });

  if (activeStyles === 0) {
    if (variantId) return { ok: false, status: 400, message: "This service has no styles" };
    return {
      ok: true,
      service: { id: service.id, name: service.name },
      variant: null,
      durationMinutes: service.durationMinutes,
      price: service.price,
    };
  }

  if (!variantId) return { ok: false, status: 400, message: "Please choose a style" };

  const offered = await prisma.providerVariant.findUnique({
    where: { providerId_variantId: { providerId, variantId } },
    include: { variant: true },
  });
  if (!offered || offered.variant.serviceId !== serviceId || !offered.variant.isActive) {
    return { ok: false, status: 404, message: "Provider does not offer this style" };
  }

  const terms = resolveTerms(offered.variant, offered);
  return {
    ok: true,
    service: { id: service.id, name: service.name },
    variant: { id: offered.variant.id, name: offered.variant.name },
    durationMinutes: terms.durationMinutes,
    price: terms.price,
  };
}