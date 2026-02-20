-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DeliveryNoteStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaterialRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_ORDERED', 'ORDERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestForQuotationStatus" AS ENUM ('DRAFT', 'SENT', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierQuotationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PurchaseReceiptStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED');


-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT NOT NULL,
    "sourceQuoteId" TEXT,
    "reservationWarehouseId" TEXT,
    "reservationLocationId" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "quoteLineId" TEXT,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "qtyOrdered" INTEGER NOT NULL,
    "qtyDelivered" INTEGER NOT NULL DEFAULT 0,
    "qtyInvoiced" INTEGER NOT NULL DEFAULT 0,
    "unitPriceCents" INTEGER NOT NULL,
    "reservationId" TEXT,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "DeliveryNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "sourceWarehouseId" TEXT,
    "sourceLocationId" TEXT,
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryNoteLine" (
    "id" TEXT NOT NULL,
    "deliveryNoteId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "salesOrderLineId" TEXT,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitCostMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "sourceWarehouseId" TEXT,
    "sourceLocationId" TEXT,
    "reservationId" TEXT,

    CONSTRAINT "DeliveryNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "MaterialRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredBy" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequestLine" (
    "id" TEXT NOT NULL,
    "materialRequestId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "qtyRequested" INTEGER NOT NULL,
    "qtyOrdered" INTEGER NOT NULL DEFAULT 0,
    "preferredVendorId" TEXT,

    CONSTRAINT "MaterialRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestForQuotation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "RequestForQuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "materialRequestId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestForQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestForQuotationLine" (
    "id" TEXT NOT NULL,
    "requestForQuotationId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "materialRequestLineId" TEXT,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "uom" TEXT,

    CONSTRAINT "RequestForQuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestForQuotationVendor" (
    "id" TEXT NOT NULL,
    "requestForQuotationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestForQuotationVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuotation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "SupplierQuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "vendorId" TEXT NOT NULL,
    "requestForQuotationId" TEXT,
    "quoteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuotationLine" (
    "id" TEXT NOT NULL,
    "supplierQuotationId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "requestForQuotationLineId" TEXT,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "deliveryDays" INTEGER,

    CONSTRAINT "SupplierQuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "PurchaseReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "vendorId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "supplierQuotationId" TEXT,
    "destinationWarehouseId" TEXT,
    "destinationLocationId" TEXT,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceiptLine" (
    "id" TEXT NOT NULL,
    "purchaseReceiptId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "purchaseOrderLineId" TEXT,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "qtyReceived" INTEGER NOT NULL,
    "acceptedQty" INTEGER,
    "rejectedQty" INTEGER,
    "unitCostMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "destinationWarehouseId" TEXT,
    "destinationLocationId" TEXT,

    CONSTRAINT "PurchaseReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesOrder_orgId_status_orderDate_idx" ON "SalesOrder"("orgId", "status", "orderDate");

-- CreateIndex
CREATE INDEX "SalesOrder_orgId_customerId_orderDate_idx" ON "SalesOrder"("orgId", "customerId", "orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_orgId_number_key" ON "SalesOrder"("orgId", "number");

-- CreateIndex
CREATE INDEX "SalesOrderLine_salesOrderId_lineNo_idx" ON "SalesOrderLine"("salesOrderId", "lineNo");

-- CreateIndex
CREATE INDEX "SalesOrderLine_productId_idx" ON "SalesOrderLine"("productId");

-- CreateIndex
CREATE INDEX "DeliveryNote_orgId_status_deliveryDate_idx" ON "DeliveryNote"("orgId", "status", "deliveryDate");

-- CreateIndex
CREATE INDEX "DeliveryNote_orgId_customerId_deliveryDate_idx" ON "DeliveryNote"("orgId", "customerId", "deliveryDate");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryNote_orgId_number_key" ON "DeliveryNote"("orgId", "number");

-- CreateIndex
CREATE INDEX "DeliveryNoteLine_deliveryNoteId_lineNo_idx" ON "DeliveryNoteLine"("deliveryNoteId", "lineNo");

-- CreateIndex
CREATE INDEX "DeliveryNoteLine_salesOrderLineId_idx" ON "DeliveryNoteLine"("salesOrderLineId");

-- CreateIndex
CREATE INDEX "MaterialRequest_orgId_status_requestDate_idx" ON "MaterialRequest"("orgId", "status", "requestDate");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialRequest_orgId_number_key" ON "MaterialRequest"("orgId", "number");

-- CreateIndex
CREATE INDEX "MaterialRequestLine_materialRequestId_lineNo_idx" ON "MaterialRequestLine"("materialRequestId", "lineNo");

-- CreateIndex
CREATE INDEX "RequestForQuotation_orgId_status_transactionDate_idx" ON "RequestForQuotation"("orgId", "status", "transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "RequestForQuotation_orgId_number_key" ON "RequestForQuotation"("orgId", "number");

-- CreateIndex
CREATE INDEX "RequestForQuotationLine_requestForQuotationId_lineNo_idx" ON "RequestForQuotationLine"("requestForQuotationId", "lineNo");

-- CreateIndex
CREATE INDEX "RequestForQuotationVendor_vendorId_status_idx" ON "RequestForQuotationVendor"("vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RequestForQuotationVendor_requestForQuotationId_vendorId_key" ON "RequestForQuotationVendor"("requestForQuotationId", "vendorId");

-- CreateIndex
CREATE INDEX "SupplierQuotation_orgId_status_quoteDate_idx" ON "SupplierQuotation"("orgId", "status", "quoteDate");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuotation_orgId_number_key" ON "SupplierQuotation"("orgId", "number");

-- CreateIndex
CREATE INDEX "SupplierQuotationLine_supplierQuotationId_lineNo_idx" ON "SupplierQuotationLine"("supplierQuotationId", "lineNo");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_orgId_status_receiptDate_idx" ON "PurchaseReceipt"("orgId", "status", "receiptDate");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_orgId_vendorId_receiptDate_idx" ON "PurchaseReceipt"("orgId", "vendorId", "receiptDate");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceipt_orgId_number_key" ON "PurchaseReceipt"("orgId", "number");

-- CreateIndex
CREATE INDEX "PurchaseReceiptLine_purchaseReceiptId_lineNo_idx" ON "PurchaseReceiptLine"("purchaseReceiptId", "lineNo");

-- CreateIndex
CREATE INDEX "PurchaseReceiptLine_purchaseOrderLineId_idx" ON "PurchaseReceiptLine"("purchaseOrderLineId");

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_sourceQuoteId_fkey" FOREIGN KEY ("sourceQuoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_reservationWarehouseId_fkey" FOREIGN KEY ("reservationWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_reservationLocationId_fkey" FOREIGN KEY ("reservationLocationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_quoteLineId_fkey" FOREIGN KEY ("quoteLineId") REFERENCES "QuoteLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNoteLine" ADD CONSTRAINT "DeliveryNoteLine_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNoteLine" ADD CONSTRAINT "DeliveryNoteLine_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNoteLine" ADD CONSTRAINT "DeliveryNoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNoteLine" ADD CONSTRAINT "DeliveryNoteLine_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNoteLine" ADD CONSTRAINT "DeliveryNoteLine_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNoteLine" ADD CONSTRAINT "DeliveryNoteLine_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestLine" ADD CONSTRAINT "MaterialRequestLine_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestLine" ADD CONSTRAINT "MaterialRequestLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestLine" ADD CONSTRAINT "MaterialRequestLine_preferredVendorId_fkey" FOREIGN KEY ("preferredVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestForQuotation" ADD CONSTRAINT "RequestForQuotation_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestForQuotationLine" ADD CONSTRAINT "RequestForQuotationLine_requestForQuotationId_fkey" FOREIGN KEY ("requestForQuotationId") REFERENCES "RequestForQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestForQuotationLine" ADD CONSTRAINT "RequestForQuotationLine_materialRequestLineId_fkey" FOREIGN KEY ("materialRequestLineId") REFERENCES "MaterialRequestLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestForQuotationLine" ADD CONSTRAINT "RequestForQuotationLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestForQuotationVendor" ADD CONSTRAINT "RequestForQuotationVendor_requestForQuotationId_fkey" FOREIGN KEY ("requestForQuotationId") REFERENCES "RequestForQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestForQuotationVendor" ADD CONSTRAINT "RequestForQuotationVendor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_requestForQuotationId_fkey" FOREIGN KEY ("requestForQuotationId") REFERENCES "RequestForQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationLine" ADD CONSTRAINT "SupplierQuotationLine_supplierQuotationId_fkey" FOREIGN KEY ("supplierQuotationId") REFERENCES "SupplierQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationLine" ADD CONSTRAINT "SupplierQuotationLine_requestForQuotationLineId_fkey" FOREIGN KEY ("requestForQuotationLineId") REFERENCES "RequestForQuotationLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationLine" ADD CONSTRAINT "SupplierQuotationLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_supplierQuotationId_fkey" FOREIGN KEY ("supplierQuotationId") REFERENCES "SupplierQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptLine" ADD CONSTRAINT "PurchaseReceiptLine_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptLine" ADD CONSTRAINT "PurchaseReceiptLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptLine" ADD CONSTRAINT "PurchaseReceiptLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptLine" ADD CONSTRAINT "PurchaseReceiptLine_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptLine" ADD CONSTRAINT "PurchaseReceiptLine_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

