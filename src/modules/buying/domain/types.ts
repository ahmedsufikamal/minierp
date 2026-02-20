export const buyingPermissions = {
  materialRequestRead: "buying.material-request.read",
  materialRequestWrite: "buying.material-request.write",
  materialRequestApprove: "buying.material-request.approve",
  rfqRead: "buying.rfq.read",
  rfqWrite: "buying.rfq.write",
  supplierQuotationRead: "buying.supplier-quotation.read",
  supplierQuotationWrite: "buying.supplier-quotation.write",
  purchaseReceiptRead: "buying.purchase-receipt.read",
  purchaseReceiptWrite: "buying.purchase-receipt.write",
  purchaseReceiptPost: "buying.purchase-receipt.post",
  supplierPaymentRead: "buying.supplier-payment.read",
  supplierPaymentWrite: "buying.supplier-payment.write",
  supplierPaymentPost: "buying.supplier-payment.post",
  payableRead: "buying.payable.read",
} as const;

export type BuyingPermission = (typeof buyingPermissions)[keyof typeof buyingPermissions];
