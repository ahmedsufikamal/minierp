-- CreateTable
CREATE TABLE "OrgSetting" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgSetting_orgId_key_key" ON "OrgSetting"("orgId", "key");

-- CreateIndex
CREATE INDEX "OrgSetting_orgId_idx" ON "OrgSetting"("orgId");
