-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "priceAtBooking" INTEGER;
-- ነባር ቀጠሮዎችን አሁን ባለው የአገልግሎት ዋጋ ይሞላል
UPDATE "Booking" AS b
SET "priceAtBooking" = s."price"
FROM "Service" AS s
WHERE b."serviceId" = s."id" AND b."priceAtBooking" IS NULL;