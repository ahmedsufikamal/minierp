CREATE UNIQUE INDEX IF NOT EXISTS "MetaModel_tenant_company_name_key"
  ON "MetaModel"("tenantId", "companyId", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "MetaFieldDef_tenant_company_model_field_key"
  ON "MetaFieldDef"("tenantId", "companyId", "modelName", "fieldKey");

CREATE UNIQUE INDEX IF NOT EXISTS "MetaPrintTemplate_tenant_company_model_name_key"
  ON "MetaPrintTemplate"("tenantId", "companyId", "modelName", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "MetaPermissionPolicy_tenant_company_model_action_key"
  ON "MetaPermissionPolicy"("tenantId", "companyId", "modelName", "actionKey");

CREATE UNIQUE INDEX IF NOT EXISTS "MetaCustomPermissionType_tenant_company_model_key_key"
  ON "MetaCustomPermissionType"("tenantId", "companyId", "modelName", "key");

CREATE UNIQUE INDEX IF NOT EXISTS "CompiledMeta_tenant_company_model_version_key"
  ON "CompiledMeta"("tenantId", "companyId", "modelName", "version");

CREATE UNIQUE INDEX IF NOT EXISTS "MasterParty_tenant_company_partyCode_key"
  ON "MasterParty"("tenantId", "companyId", "partyCode");

CREATE UNIQUE INDEX IF NOT EXISTS "MasterPriceList_tenant_company_key_key"
  ON "MasterPriceList"("tenantId", "companyId", "key");

CREATE UNIQUE INDEX IF NOT EXISTS "MasterCurrency_tenant_company_code_key"
  ON "MasterCurrency"("tenantId", "companyId", "code");

CREATE UNIQUE INDEX IF NOT EXISTS "MasterTaxCode_tenant_company_code_key"
  ON "MasterTaxCode"("tenantId", "companyId", "code");

CREATE INDEX IF NOT EXISTS "CompiledMeta_tenant_model_version_idx"
  ON "CompiledMeta"("tenantId", "modelName", "version");

CREATE INDEX IF NOT EXISTS "MetaFieldDef_tenant_company_model_active_sort_idx"
  ON "MetaFieldDef"("tenantId", "companyId", "modelName", "isActive", "sortOrder");

CREATE INDEX IF NOT EXISTS "MetaWorkflowDef_tenant_company_model_published_version_idx"
  ON "MetaWorkflowDef"("tenantId", "companyId", "modelName", "isPublished", "version");

CREATE INDEX IF NOT EXISTS "MetaWorkflowTransition_workflow_action_from_sort_idx"
  ON "MetaWorkflowTransition"("workflowDefId", "actionKey", "fromState", "sortOrder");

CREATE INDEX IF NOT EXISTS "MetaChangeLog_tenant_company_model_createdAt_idx"
  ON "MetaChangeLog"("tenantId", "companyId", "modelName", "createdAt");

CREATE INDEX IF NOT EXISTS "MasterParty_tenant_company_name_idx"
  ON "MasterParty"("tenantId", "companyId", "name");

CREATE INDEX IF NOT EXISTS "MasterParty_tenant_company_taxId_idx"
  ON "MasterParty"("tenantId", "companyId", "taxId");

CREATE INDEX IF NOT EXISTS "MasterParty_tenant_company_email_idx"
  ON "MasterParty"("tenantId", "companyId", "email");

CREATE INDEX IF NOT EXISTS "MasterParty_tenant_company_phone_idx"
  ON "MasterParty"("tenantId", "companyId", "phone");

CREATE INDEX IF NOT EXISTS "MasterPriceListItem_tenant_company_item_isActive_idx"
  ON "MasterPriceListItem"("tenantId", "companyId", "itemCode", "isActive");

CREATE INDEX IF NOT EXISTS "Product_company_barcode_idx"
  ON "Product"("orgId", "barcode");

CREATE INDEX IF NOT EXISTS "MasterAddress_tenant_company_party_primary_idx"
  ON "MasterAddress"("tenantId", "companyId", "partyId", "isPrimary");

CREATE INDEX IF NOT EXISTS "MasterContact_tenant_company_party_primary_idx"
  ON "MasterContact"("tenantId", "companyId", "partyId", "isPrimary");

CREATE INDEX IF NOT EXISTS "MasterPartyMergeHistory_tenant_company_createdAt_idx"
  ON "MasterPartyMergeHistory"("tenantId", "companyId", "createdAt");

CREATE INDEX IF NOT EXISTS "MasterParty_customData_gin_idx"
  ON "MasterParty" USING gin ("customData");

CREATE INDEX IF NOT EXISTS "Product_customData_gin_idx"
  ON "Product" USING gin ("customData");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "MasterParty_name_trgm_idx" ON "MasterParty" USING gin ("name" gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx" ON "Product" USING gin ("name" gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Product_sku_trgm_idx" ON "Product" USING gin ("sku" gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Product_barcode_trgm_idx" ON "Product" USING gin ("barcode" gin_trgm_ops)';
  END IF;
END $$;
