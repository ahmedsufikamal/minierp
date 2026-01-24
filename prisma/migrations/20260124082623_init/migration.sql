/*
  Warnings:

  - You are about to drop the column `memo` on the `JournalLine` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `PurchaseBill` table. All the data in the column will be lost.
  - You are about to drop the column `subtotalCents` on the `PurchaseBill` table. All the data in the column will be lost.
  - You are about to drop the column `taxCents` on the `PurchaseBill` table. All the data in the column will be lost.
  - You are about to drop the column `totalCents` on the `PurchaseBill` table. All the data in the column will be lost.
  - You are about to drop the column `lineTotalCents` on the `PurchaseBillLine` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `SalesInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `issueDate` on the `SalesInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `subtotalCents` on the `SalesInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `taxCents` on the `SalesInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `totalCents` on the `SalesInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `lineTotalCents` on the `SalesInvoiceLine` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Account` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "InventoryMove" DROP CONSTRAINT "InventoryMove_productId_fkey";

-- DropIndex
DROP INDEX "Account_orgId_idx";

-- DropIndex
DROP INDEX "Customer_orgId_idx";

-- DropIndex
DROP INDEX "Customer_orgId_name_key";

-- DropIndex
DROP INDEX "InventoryMove_orgId_createdAt_idx";

-- DropIndex
DROP INDEX "InventoryMove_orgId_productId_idx";

-- DropIndex
DROP INDEX "JournalEntry_orgId_date_idx";

-- DropIndex
DROP INDEX "JournalLine_accountId_idx";

-- DropIndex
DROP INDEX "JournalLine_entryId_idx";

-- DropIndex
DROP INDEX "Product_orgId_idx";

-- DropIndex
DROP INDEX "PurchaseBill_orgId_idx";

-- DropIndex
DROP INDEX "PurchaseBillLine_billId_idx";

-- DropIndex
DROP INDEX "SalesInvoice_orgId_idx";

-- DropIndex
DROP INDEX "SalesInvoiceLine_invoiceId_idx";

-- DropIndex
DROP INDEX "Vendor_orgId_idx";

-- DropIndex
DROP INDEX "Vendor_orgId_name_key";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "JournalLine" DROP COLUMN "memo";

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "unit" SET DEFAULT 'pcs';

-- AlterTable
ALTER TABLE "PurchaseBill" DROP COLUMN "currency",
DROP COLUMN "subtotalCents",
DROP COLUMN "taxCents",
DROP COLUMN "totalCents";

-- AlterTable
ALTER TABLE "PurchaseBillLine" DROP COLUMN "lineTotalCents";

-- AlterTable
ALTER TABLE "SalesInvoice" DROP COLUMN "currency",
DROP COLUMN "issueDate",
DROP COLUMN "subtotalCents",
DROP COLUMN "taxCents",
DROP COLUMN "totalCents",
ADD COLUMN     "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SalesInvoiceLine" DROP COLUMN "lineTotalCents";

-- AddForeignKey
ALTER TABLE "InventoryMove" ADD CONSTRAINT "InventoryMove_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
