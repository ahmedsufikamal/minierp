import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stockSettingsSchema } from "@/modules/inventory/application/schemas";

export type InventoryStockSettings = ReturnType<typeof toStockSettingsRecord>;

type CachedEntry = {
  expiresAt: number;
  value: InventoryStockSettings;
};

const CACHE_TTL_MS = 15_000;
const stockSettingsCache = new Map<string, CachedEntry>();

function valuationToLegacyCosting(method: "FIFO" | "MOVING_AVERAGE" | "STANDARD"): string {
  if (method === "FIFO") return "FIFO";
  if (method === "STANDARD") return "STANDARD";
  return "AVG";
}

function legacyCostingToValuation(method: string | null | undefined): "FIFO" | "MOVING_AVERAGE" | "STANDARD" {
  if (method === "FIFO") return "FIFO";
  if (method === "STANDARD") return "STANDARD";
  return "MOVING_AVERAGE";
}

function decimalToNumber(value: Prisma.Decimal | number): number {
  if (typeof value === "number") return value;
  return Number(value.toString());
}

function toStockSettingsRecord(row: {
  itemNamingBy: "ITEM_CODE" | "NAMING_SERIES";
  defaultWarehouseId: string | null;
  defaultStockUomId: string | null;
  defaultValuationMethod: "FIFO" | "MOVING_AVERAGE" | "STANDARD";
  autoInsertItemPriceIfMissing: boolean;
  updateExistingPriceListRate: boolean;
  allowEditStockUomQtySalesDocs: boolean;
  allowEditStockUomQtyPurchaseDocs: boolean;
  overDeliveryReceiptAllowancePct: Prisma.Decimal | number;
  overTransferAllowancePct: Prisma.Decimal | number;
  overPickingAllowancePct: Prisma.Decimal | number;
  allowNegativeStock: boolean;
  showBarcodeFieldInStockTransactions: boolean;
  convertItemDescriptionToCleanHtml: boolean;
  allowInternalTransfersAtArmsLengthPrice: boolean;
  qiActionIfNotSubmitted: "STOP" | "WARN" | "ALLOW";
  qiActionIfRejected: "STOP" | "WARN" | "ALLOW";
  enableStockReservation: boolean;
  allowPartialReservation: boolean;
  autoReserveStockForSalesOrderOnPurchase: boolean;
  autoReserveSerialAndBatchNos: boolean;
  autoCreateSerialAndBatchBundleForOutward: boolean;
  pickSerialBatchBasedOn: "FIFO" | "LIFO" | "EXPIRY";
  disableSerialNoAndBatchSelector: boolean;
  haveDefaultNamingSeriesForBatchId: boolean;
  useSerialBatchFields: boolean;
  doNotUpdateSerialBatchOnCreationOfAutoBundle: boolean;
  allowExistingSerialNoToBeReceivedAgain: boolean;
  setBundleNamingBasedOnNamingSeries: boolean;
  raiseMaterialRequestWhenStockReachesReorderLevel: boolean;
  notifyByEmailOnCreationOfAutomaticMaterialRequest: boolean;
  allowMaterialTransferFromDeliveryNoteToSalesInvoice: boolean;
  allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice: boolean;
  freezeStocksOlderThanDays: number;
  version: number;
  updatedAt: Date;
}): {
  item_naming_by: "ITEM_CODE" | "NAMING_SERIES";
  default_warehouse_id: string | null;
  default_stock_uom_id: string | null;
  default_valuation_method: "FIFO" | "MOVING_AVERAGE" | "STANDARD";
  auto_insert_item_price_if_missing: boolean;
  update_existing_price_list_rate: boolean;
  allow_edit_stock_uom_qty_sales_docs: boolean;
  allow_edit_stock_uom_qty_purchase_docs: boolean;
  over_delivery_receipt_allowance_pct: number;
  over_transfer_allowance_pct: number;
  over_picking_allowance_pct: number;
  allow_negative_stock: boolean;
  show_barcode_field_in_stock_transactions: boolean;
  convert_item_description_to_clean_html: boolean;
  allow_internal_transfers_at_arms_length_price: boolean;
  qi_action_if_not_submitted: "STOP" | "WARN" | "ALLOW";
  qi_action_if_rejected: "STOP" | "WARN" | "ALLOW";
  enable_stock_reservation: boolean;
  allow_partial_reservation: boolean;
  auto_reserve_stock_for_sales_order_on_purchase: boolean;
  auto_reserve_serial_and_batch_nos: boolean;
  auto_create_serial_and_batch_bundle_for_outward: boolean;
  pick_serial_batch_based_on: "FIFO" | "LIFO" | "EXPIRY";
  disable_serial_no_and_batch_selector: boolean;
  have_default_naming_series_for_batch_id: boolean;
  use_serial_batch_fields: boolean;
  do_not_update_serial_batch_on_creation_of_auto_bundle: boolean;
  allow_existing_serial_no_to_be_received_again: boolean;
  set_bundle_naming_based_on_naming_series: boolean;
  raise_material_request_when_stock_reaches_reorder_level: boolean;
  notify_by_email_on_creation_of_automatic_material_request: boolean;
  allow_material_transfer_from_delivery_note_to_sales_invoice: boolean;
  allow_material_transfer_from_purchase_receipt_to_purchase_invoice: boolean;
  freeze_stocks_older_than_days: number;
  version: number;
  updated_at: string;
} {
  return {
    item_naming_by: row.itemNamingBy,
    default_warehouse_id: row.defaultWarehouseId,
    default_stock_uom_id: row.defaultStockUomId,
    default_valuation_method: row.defaultValuationMethod,
    auto_insert_item_price_if_missing: row.autoInsertItemPriceIfMissing,
    update_existing_price_list_rate: row.updateExistingPriceListRate,
    allow_edit_stock_uom_qty_sales_docs: row.allowEditStockUomQtySalesDocs,
    allow_edit_stock_uom_qty_purchase_docs: row.allowEditStockUomQtyPurchaseDocs,
    over_delivery_receipt_allowance_pct: decimalToNumber(row.overDeliveryReceiptAllowancePct),
    over_transfer_allowance_pct: decimalToNumber(row.overTransferAllowancePct),
    over_picking_allowance_pct: decimalToNumber(row.overPickingAllowancePct),
    allow_negative_stock: row.allowNegativeStock,
    show_barcode_field_in_stock_transactions: row.showBarcodeFieldInStockTransactions,
    convert_item_description_to_clean_html: row.convertItemDescriptionToCleanHtml,
    allow_internal_transfers_at_arms_length_price: row.allowInternalTransfersAtArmsLengthPrice,
    qi_action_if_not_submitted: row.qiActionIfNotSubmitted,
    qi_action_if_rejected: row.qiActionIfRejected,
    enable_stock_reservation: row.enableStockReservation,
    allow_partial_reservation: row.allowPartialReservation,
    auto_reserve_stock_for_sales_order_on_purchase: row.autoReserveStockForSalesOrderOnPurchase,
    auto_reserve_serial_and_batch_nos: row.autoReserveSerialAndBatchNos,
    auto_create_serial_and_batch_bundle_for_outward: row.autoCreateSerialAndBatchBundleForOutward,
    pick_serial_batch_based_on: row.pickSerialBatchBasedOn,
    disable_serial_no_and_batch_selector: row.disableSerialNoAndBatchSelector,
    have_default_naming_series_for_batch_id: row.haveDefaultNamingSeriesForBatchId,
    use_serial_batch_fields: row.useSerialBatchFields,
    do_not_update_serial_batch_on_creation_of_auto_bundle: row.doNotUpdateSerialBatchOnCreationOfAutoBundle,
    allow_existing_serial_no_to_be_received_again: row.allowExistingSerialNoToBeReceivedAgain,
    set_bundle_naming_based_on_naming_series: row.setBundleNamingBasedOnNamingSeries,
    raise_material_request_when_stock_reaches_reorder_level: row.raiseMaterialRequestWhenStockReachesReorderLevel,
    notify_by_email_on_creation_of_automatic_material_request:
      row.notifyByEmailOnCreationOfAutomaticMaterialRequest,
    allow_material_transfer_from_delivery_note_to_sales_invoice:
      row.allowMaterialTransferFromDeliveryNoteToSalesInvoice,
    allow_material_transfer_from_purchase_receipt_to_purchase_invoice:
      row.allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice,
    freeze_stocks_older_than_days: row.freezeStocksOlderThanDays,
    version: row.version,
    updated_at: row.updatedAt.toISOString(),
  };
}

function buildCreateDefaults(companyId: string) {
  const defaults = stockSettingsSchema.parse({});
  return {
    companyId,
    itemNamingBy: defaults.item_naming_by,
    defaultWarehouseId: defaults.default_warehouse_id,
    defaultStockUomId: defaults.default_stock_uom_id,
    defaultValuationMethod: defaults.default_valuation_method,
    autoInsertItemPriceIfMissing: defaults.auto_insert_item_price_if_missing,
    updateExistingPriceListRate: defaults.update_existing_price_list_rate,
    allowEditStockUomQtySalesDocs: defaults.allow_edit_stock_uom_qty_sales_docs,
    allowEditStockUomQtyPurchaseDocs: defaults.allow_edit_stock_uom_qty_purchase_docs,
    overDeliveryReceiptAllowancePct: defaults.over_delivery_receipt_allowance_pct,
    overTransferAllowancePct: defaults.over_transfer_allowance_pct,
    overPickingAllowancePct: defaults.over_picking_allowance_pct,
    allowNegativeStock: defaults.allow_negative_stock,
    showBarcodeFieldInStockTransactions: defaults.show_barcode_field_in_stock_transactions,
    convertItemDescriptionToCleanHtml: defaults.convert_item_description_to_clean_html,
    allowInternalTransfersAtArmsLengthPrice: defaults.allow_internal_transfers_at_arms_length_price,
    qiActionIfNotSubmitted: defaults.qi_action_if_not_submitted,
    qiActionIfRejected: defaults.qi_action_if_rejected,
    enableStockReservation: defaults.enable_stock_reservation,
    allowPartialReservation: defaults.allow_partial_reservation,
    autoReserveStockForSalesOrderOnPurchase: defaults.auto_reserve_stock_for_sales_order_on_purchase,
    autoReserveSerialAndBatchNos: defaults.auto_reserve_serial_and_batch_nos,
    autoCreateSerialAndBatchBundleForOutward: defaults.auto_create_serial_and_batch_bundle_for_outward,
    pickSerialBatchBasedOn: defaults.pick_serial_batch_based_on,
    disableSerialNoAndBatchSelector: defaults.disable_serial_no_and_batch_selector,
    haveDefaultNamingSeriesForBatchId: defaults.have_default_naming_series_for_batch_id,
    useSerialBatchFields: defaults.use_serial_batch_fields,
    doNotUpdateSerialBatchOnCreationOfAutoBundle:
      defaults.do_not_update_serial_batch_on_creation_of_auto_bundle,
    allowExistingSerialNoToBeReceivedAgain: defaults.allow_existing_serial_no_to_be_received_again,
    setBundleNamingBasedOnNamingSeries: defaults.set_bundle_naming_based_on_naming_series,
    raiseMaterialRequestWhenStockReachesReorderLevel:
      defaults.raise_material_request_when_stock_reaches_reorder_level,
    notifyByEmailOnCreationOfAutomaticMaterialRequest:
      defaults.notify_by_email_on_creation_of_automatic_material_request,
    allowMaterialTransferFromDeliveryNoteToSalesInvoice:
      defaults.allow_material_transfer_from_delivery_note_to_sales_invoice,
    allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice:
      defaults.allow_material_transfer_from_purchase_receipt_to_purchase_invoice,
    freezeStocksOlderThanDays: defaults.freeze_stocks_older_than_days,
    // Legacy compatibility sync.
    defaultUom: "pcs",
    costingMethod: valuationToLegacyCosting(defaults.default_valuation_method),
    preventNegativeStock: !defaults.allow_negative_stock,
    allowNegativeOverride: false,
    trackByLocation: false,
    baseCurrency: "BDT",
    version: 1,
  };
}

export async function loadStockSettings(companyId: string, opts?: { bypassCache?: boolean }) {
  const bypassCache = Boolean(opts?.bypassCache);
  const now = Date.now();
  const cached = stockSettingsCache.get(companyId);
  if (!bypassCache && cached && cached.expiresAt > now) {
    return cached.value;
  }

  let row = await prisma.inventoryCompanySetting.findUnique({
    where: { companyId },
    select: {
      itemNamingBy: true,
      defaultWarehouseId: true,
      defaultStockUomId: true,
      defaultValuationMethod: true,
      autoInsertItemPriceIfMissing: true,
      updateExistingPriceListRate: true,
      allowEditStockUomQtySalesDocs: true,
      allowEditStockUomQtyPurchaseDocs: true,
      overDeliveryReceiptAllowancePct: true,
      overTransferAllowancePct: true,
      overPickingAllowancePct: true,
      allowNegativeStock: true,
      showBarcodeFieldInStockTransactions: true,
      convertItemDescriptionToCleanHtml: true,
      allowInternalTransfersAtArmsLengthPrice: true,
      qiActionIfNotSubmitted: true,
      qiActionIfRejected: true,
      enableStockReservation: true,
      allowPartialReservation: true,
      autoReserveStockForSalesOrderOnPurchase: true,
      autoReserveSerialAndBatchNos: true,
      autoCreateSerialAndBatchBundleForOutward: true,
      pickSerialBatchBasedOn: true,
      disableSerialNoAndBatchSelector: true,
      haveDefaultNamingSeriesForBatchId: true,
      useSerialBatchFields: true,
      doNotUpdateSerialBatchOnCreationOfAutoBundle: true,
      allowExistingSerialNoToBeReceivedAgain: true,
      setBundleNamingBasedOnNamingSeries: true,
      raiseMaterialRequestWhenStockReachesReorderLevel: true,
      notifyByEmailOnCreationOfAutomaticMaterialRequest: true,
      allowMaterialTransferFromDeliveryNoteToSalesInvoice: true,
      allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice: true,
      freezeStocksOlderThanDays: true,
      version: true,
      updatedAt: true,
      costingMethod: true,
      preventNegativeStock: true,
    },
  });

  if (!row) {
    row = await prisma.inventoryCompanySetting.create({
      data: buildCreateDefaults(companyId),
      select: {
        itemNamingBy: true,
        defaultWarehouseId: true,
        defaultStockUomId: true,
        defaultValuationMethod: true,
        autoInsertItemPriceIfMissing: true,
        updateExistingPriceListRate: true,
        allowEditStockUomQtySalesDocs: true,
        allowEditStockUomQtyPurchaseDocs: true,
        overDeliveryReceiptAllowancePct: true,
        overTransferAllowancePct: true,
        overPickingAllowancePct: true,
        allowNegativeStock: true,
        showBarcodeFieldInStockTransactions: true,
        convertItemDescriptionToCleanHtml: true,
        allowInternalTransfersAtArmsLengthPrice: true,
        qiActionIfNotSubmitted: true,
        qiActionIfRejected: true,
        enableStockReservation: true,
        allowPartialReservation: true,
        autoReserveStockForSalesOrderOnPurchase: true,
        autoReserveSerialAndBatchNos: true,
        autoCreateSerialAndBatchBundleForOutward: true,
        pickSerialBatchBasedOn: true,
        disableSerialNoAndBatchSelector: true,
        haveDefaultNamingSeriesForBatchId: true,
        useSerialBatchFields: true,
        doNotUpdateSerialBatchOnCreationOfAutoBundle: true,
        allowExistingSerialNoToBeReceivedAgain: true,
        setBundleNamingBasedOnNamingSeries: true,
        raiseMaterialRequestWhenStockReachesReorderLevel: true,
        notifyByEmailOnCreationOfAutomaticMaterialRequest: true,
        allowMaterialTransferFromDeliveryNoteToSalesInvoice: true,
        allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice: true,
        freezeStocksOlderThanDays: true,
        version: true,
        updatedAt: true,
        costingMethod: true,
        preventNegativeStock: true,
      },
    });
  }

  // Compatibility sync guard for legacy fields.
  if (
    row.defaultValuationMethod !== legacyCostingToValuation(row.costingMethod) ||
    row.preventNegativeStock !== !row.allowNegativeStock
  ) {
    await prisma.inventoryCompanySetting.update({
      where: { companyId },
      data: {
        costingMethod: valuationToLegacyCosting(row.defaultValuationMethod),
        preventNegativeStock: !row.allowNegativeStock,
      },
    });
  }

  const value = toStockSettingsRecord(row);
  stockSettingsCache.set(companyId, {
    expiresAt: now + CACHE_TTL_MS,
    value,
  });
  return value;
}

export function invalidateStockSettingsCache(companyId: string) {
  stockSettingsCache.delete(companyId);
}

export function shouldBlockByFreezeWindow(settings: InventoryStockSettings, documentDate: Date, now = new Date()) {
  if (!Number.isFinite(settings.freeze_stocks_older_than_days)) return false;
  const cutoff = new Date(now.getTime() - settings.freeze_stocks_older_than_days * 24 * 60 * 60 * 1000);
  return documentDate.getTime() < cutoff.getTime();
}
