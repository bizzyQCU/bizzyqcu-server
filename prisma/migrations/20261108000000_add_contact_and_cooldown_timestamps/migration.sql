-- AlterTable
ALTER TABLE "User" ADD COLUMN "contactNumber" TEXT,
ADD COLUMN "lastEmailChange" TIMESTAMP(3),
ADD COLUMN "lastContactChange" TIMESTAMP(3),
ADD COLUMN "lastPasswordChange" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Store" ADD COLUMN "contactNumber" TEXT,
ADD COLUMN "lastNameChange" TIMESTAMP(3),
ADD COLUMN "lastBioChange" TIMESTAMP(3),
ADD COLUMN "lastLocationChange" TIMESTAMP(3),
ADD COLUMN "lastContactChange" TIMESTAMP(3),
ADD COLUMN "lastProfileChange" TIMESTAMP(3);
