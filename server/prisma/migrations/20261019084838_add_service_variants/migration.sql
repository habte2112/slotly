-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "ServiceVariant" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderVariant" (
    "providerId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "priceOverride" INTEGER,
    "durationOverride" INTEGER,
    "userId" TEXT,

    CONSTRAINT "ProviderVariant_pkey" PRIMARY KEY ("providerId","variantId")
);

-- CreateIndex
CREATE INDEX "ServiceVariant_serviceId_idx" ON "ServiceVariant"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceVariant_serviceId_name_key" ON "ServiceVariant"("serviceId", "name");

-- CreateIndex
CREATE INDEX "ProviderVariant_variantId_idx" ON "ProviderVariant"("variantId");

-- CreateIndex
CREATE INDEX "Booking_variantId_idx" ON "Booking"("variantId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ServiceVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVariant" ADD CONSTRAINT "ServiceVariant_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ServiceVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
