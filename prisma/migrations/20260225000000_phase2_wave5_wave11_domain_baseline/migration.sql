-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('OPEN', 'QUALIFIED', 'LOST', 'CONVERTED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BomStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobCardStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubcontractingOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubcontractingReceiptStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QualityInspectionStatus" AS ENUM ('DRAFT', 'PASSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CapaStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SlaPolicyStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS', 'CHAT', 'CALL', 'NOTE');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('DRAFT', 'SENT', 'DELIVERED', 'FAILED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ANSWERED', 'MISSED', 'VOICEMAIL', 'ENDED');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "LeaveApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "SalaryStructureStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PayrollEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'GENERATED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'IN_MAINTENANCE', 'DISPOSED');

-- CreateEnum
CREATE TYPE "DepreciationEntryStatus" AS ENUM ('PLANNED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaintenanceScheduleStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RegionalProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PosShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PosSaleStatus" AS ENUM ('DRAFT', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "PosPaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK', 'WALLET');

-- CreateEnum
CREATE TYPE "PortalPartyType" AS ENUM ('CUSTOMER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "PortalConfigStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "IntegrationEmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApiTokenStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "EdiTransportType" AS ENUM ('API', 'SFTP', 'AS2');

-- CreateEnum
CREATE TYPE "EdiTransportStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BulkJobStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UtilityTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "AccountingPeriod" DROP CONSTRAINT "AccountingPeriod_orgId_fkey";

-- DropForeignKey
ALTER TABLE "AccountingPeriod" DROP CONSTRAINT "AccountingPeriod_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "FiscalYear" DROP CONSTRAINT "FiscalYear_orgId_fkey";

-- DropForeignKey
ALTER TABLE "FiscalYear" DROP CONSTRAINT "FiscalYear_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "GLEntry" DROP CONSTRAINT "GLEntry_orgId_fkey";

-- DropForeignKey
ALTER TABLE "GLEntry" DROP CONSTRAINT "GLEntry_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "IamOtpChallenge" DROP CONSTRAINT "IamOtpChallenge_orgId_fkey";

-- DropIndex
DROP INDEX "Company_domainVerificationToken_idx";

-- DropIndex
DROP INDEX "IamOtpChallenge_orgId_createdAt_idx";

-- DropIndex
DROP INDEX "User_pendingEmail_idx";

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "IamOtpChallenge" DROP COLUMN "orgId",
ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "probabilityPct" INTEGER,
ADD COLUMN     "tenantId" TEXT,
ADD COLUMN     "updatedBy" TEXT;

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "budgetMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "campaignId" TEXT,
    "customerId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "qualifiedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityStageHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "fromStage" "OpportunityStage",
    "toStage" "OpportunityStage" NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workstation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacityMinsPerDay" INTEGER NOT NULL DEFAULT 480,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workstation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingOperation" (
    "id" TEXT NOT NULL,
    "routingId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "operationName" TEXT NOT NULL,
    "workstationId" TEXT,
    "durationMins" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "RoutingOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bom" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "BomStatus" NOT NULL DEFAULT 'DRAFT',
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomLine" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "scrapPct" INTEGER,

    CONSTRAINT "BomLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "bomId" TEXT NOT NULL,
    "routingId" TEXT,
    "itemId" TEXT NOT NULL,
    "qtyPlanned" INTEGER NOT NULL,
    "qtyCompleted" INTEGER NOT NULL DEFAULT 0,
    "reservationWarehouseId" TEXT,
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "operationNo" INTEGER NOT NULL,
    "operationName" TEXT NOT NULL,
    "workstationId" TEXT,
    "plannedMins" INTEGER NOT NULL,
    "actualMins" INTEGER,
    "status" "JobCardStatus" NOT NULL DEFAULT 'OPEN',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractingOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "SubcontractingOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "vendorId" TEXT NOT NULL,
    "issueWarehouseId" TEXT,
    "expectedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractingOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "itemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qtyOutward" INTEGER NOT NULL,
    "qtyReceived" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SubcontractingOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractingReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "SubcontractingReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "subcontractingOrderId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractingReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractingReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "orderItemId" TEXT,
    "itemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qtyReceived" INTEGER NOT NULL,
    "qtyRejected" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SubcontractingReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityInspection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "QualityInspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "itemId" TEXT,
    "qtyInspected" INTEGER NOT NULL DEFAULT 0,
    "qtyAccepted" INTEGER NOT NULL DEFAULT 0,
    "qtyRejected" INTEGER NOT NULL DEFAULT 0,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityCapa" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "preventiveAction" TEXT,
    "status" "CapaStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityCapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "dueDate" TIMESTAMP(3),
    "plannedMins" INTEGER,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "workerRef" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "minutes" INTEGER NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "salesInvoiceId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportQueue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SlaPolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "queueId" TEXT,
    "firstResponseMins" INTEGER NOT NULL,
    "resolutionMins" INTEGER NOT NULL,
    "pauseOnCustomerWait" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "customerId" TEXT,
    "projectId" TEXT,
    "queueId" TEXT,
    "slaPolicyId" TEXT,
    "assignedTo" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstResponseAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "pauseStartedAt" TIMESTAMP(3),
    "pausedMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationWindow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "queueId" TEXT,
    "name" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "startsAt" TEXT NOT NULL,
    "endsAt" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "queueId" TEXT,
    "ticketId" TEXT,
    "customerId" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT,
    "body" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "queueId" TEXT,
    "ticketId" TEXT,
    "customerId" TEXT,
    "direction" "CallDirection" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "phoneNumber" TEXT NOT NULL,
    "fromNumber" TEXT,
    "toNumber" TEXT,
    "durationSecs" INTEGER,
    "notes" TEXT,
    "recordingUrl" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "departmentId" TEXT,
    "designationId" TEXT,
    "dateOfJoining" TIMESTAMP(3) NOT NULL,
    "dateOfRelieving" TIMESTAMP(3),
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "usedDays" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "status" "LeaveApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SalaryStructureStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "baseAmountMinor" INTEGER NOT NULL,
    "allowancesMinor" INTEGER NOT NULL DEFAULT 0,
    "deductionsMinor" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "PayrollEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "fiscalYearId" TEXT,
    "salaryStructureId" TEXT,
    "accountingPeriodId" TEXT,
    "notes" TEXT,
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntryEmployee" (
    "id" TEXT NOT NULL,
    "payrollEntryId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grossPayMinor" INTEGER NOT NULL,
    "deductionsMinor" INTEGER NOT NULL,
    "netPayMinor" INTEGER NOT NULL,

    CONSTRAINT "PayrollEntryEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'DRAFT',
    "payrollEntryId" TEXT,
    "employeeId" TEXT NOT NULL,
    "salaryStructureId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "grossPayMinor" INTEGER NOT NULL,
    "deductionsMinor" INTEGER NOT NULL,
    "netPayMinor" INTEGER NOT NULL,
    "notes" TEXT,
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "claimDate" TIMESTAMP(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "description" TEXT,
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "usefulLifeMonths" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "assetNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "acquiredOn" TIMESTAMP(3) NOT NULL,
    "inServiceOn" TIMESTAMP(3),
    "costMinor" INTEGER NOT NULL,
    "salvageMinor" INTEGER NOT NULL DEFAULT 0,
    "usefulLifeMonths" INTEGER NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "currentBookValueMinor" INTEGER NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'DRAFT',
    "disposedOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDepreciationEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "DepreciationEntryStatus" NOT NULL DEFAULT 'PLANNED',
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetDepreciationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "MaintenanceScheduleStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduledOn" TIMESTAMP(3) NOT NULL,
    "completedOn" TIMESTAMP(3),
    "assignedTo" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceVisit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "status" "MaintenanceScheduleStatus" NOT NULL DEFAULT 'PLANNED',
    "technician" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegionalProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "status" "RegionalProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegionalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warehouseId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosShift" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" "PosShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingCashMinor" INTEGER NOT NULL DEFAULT 0,
    "closingCashMinor" INTEGER,
    "openedBy" TEXT,
    "closedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "shiftId" TEXT,
    "status" "PosSaleStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "salesInvoiceId" TEXT,
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSaleLine" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,

    CONSTRAINT "PosSaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSalePayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "PosPaymentMethod" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "referenceNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosSalePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "partyType" "PortalPartyType" NOT NULL,
    "key" TEXT NOT NULL,
    "status" "PortalConfigStatus" NOT NULL DEFAULT 'ACTIVE',
    "filters" JSONB,
    "attributes" JSONB,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEmailTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEmailQueue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "templateId" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "IntegrationEmailStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationEmailQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationApiToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" JSONB,
    "status" "ApiTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdiCodeList" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "listType" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdiCodeList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdiTransport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EdiTransportType" NOT NULL,
    "status" "EdiTransportStatus" NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdiTransport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BulkJobStatus" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB,
    "result" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkJobItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "UtilityTaskStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB,
    "output" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilityTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_orgId_status_startsOn_idx" ON "Campaign"("orgId", "status", "startsOn");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_orgId_name_key" ON "Campaign"("orgId", "name");

-- CreateIndex
CREATE INDEX "Lead_orgId_status_createdAt_idx" ON "Lead"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_orgId_campaignId_status_idx" ON "Lead"("orgId", "campaignId", "status");

-- CreateIndex
CREATE INDEX "OpportunityStageHistory_orgId_opportunityId_changedAt_idx" ON "OpportunityStageHistory"("orgId", "opportunityId", "changedAt");

-- CreateIndex
CREATE INDEX "Workstation_orgId_isActive_idx" ON "Workstation"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Workstation_orgId_code_key" ON "Workstation"("orgId", "code");

-- CreateIndex
CREATE INDEX "Routing_orgId_isActive_idx" ON "Routing"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Routing_orgId_code_key" ON "Routing"("orgId", "code");

-- CreateIndex
CREATE INDEX "RoutingOperation_routingId_lineNo_idx" ON "RoutingOperation"("routingId", "lineNo");

-- CreateIndex
CREATE INDEX "Bom_orgId_itemId_status_idx" ON "Bom"("orgId", "itemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Bom_orgId_code_key" ON "Bom"("orgId", "code");

-- CreateIndex
CREATE INDEX "BomLine_bomId_lineNo_idx" ON "BomLine"("bomId", "lineNo");

-- CreateIndex
CREATE INDEX "WorkOrder_orgId_status_createdAt_idx" ON "WorkOrder"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkOrder_orgId_reservationWarehouseId_status_idx" ON "WorkOrder"("orgId", "reservationWarehouseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_orgId_number_key" ON "WorkOrder"("orgId", "number");

-- CreateIndex
CREATE INDEX "JobCard_orgId_workOrderId_status_idx" ON "JobCard"("orgId", "workOrderId", "status");

-- CreateIndex
CREATE INDEX "JobCard_orgId_workstationId_status_idx" ON "JobCard"("orgId", "workstationId", "status");

-- CreateIndex
CREATE INDEX "SubcontractingOrder_orgId_status_expectedDate_idx" ON "SubcontractingOrder"("orgId", "status", "expectedDate");

-- CreateIndex
CREATE UNIQUE INDEX "SubcontractingOrder_orgId_number_key" ON "SubcontractingOrder"("orgId", "number");

-- CreateIndex
CREATE INDEX "SubcontractingOrderItem_orderId_lineNo_idx" ON "SubcontractingOrderItem"("orderId", "lineNo");

-- CreateIndex
CREATE INDEX "SubcontractingReceipt_orgId_status_receiptDate_idx" ON "SubcontractingReceipt"("orgId", "status", "receiptDate");

-- CreateIndex
CREATE UNIQUE INDEX "SubcontractingReceipt_orgId_number_key" ON "SubcontractingReceipt"("orgId", "number");

-- CreateIndex
CREATE INDEX "SubcontractingReceiptItem_receiptId_lineNo_idx" ON "SubcontractingReceiptItem"("receiptId", "lineNo");

-- CreateIndex
CREATE INDEX "QualityInspection_orgId_referenceType_referenceId_idx" ON "QualityInspection"("orgId", "referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "QualityInspection_orgId_status_inspectedAt_idx" ON "QualityInspection"("orgId", "status", "inspectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QualityInspection_orgId_number_key" ON "QualityInspection"("orgId", "number");

-- CreateIndex
CREATE INDEX "QualityCapa_orgId_status_dueDate_idx" ON "QualityCapa"("orgId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "QualityCapa_orgId_inspectionId_idx" ON "QualityCapa"("orgId", "inspectionId");

-- CreateIndex
CREATE INDEX "Project_orgId_status_startDate_idx" ON "Project"("orgId", "status", "startDate");

-- CreateIndex
CREATE INDEX "Project_orgId_customerId_status_idx" ON "Project"("orgId", "customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_orgId_code_key" ON "Project"("orgId", "code");

-- CreateIndex
CREATE INDEX "ProjectTask_orgId_projectId_status_idx" ON "ProjectTask"("orgId", "projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectTask_orgId_assignedTo_status_idx" ON "ProjectTask"("orgId", "assignedTo", "status");

-- CreateIndex
CREATE INDEX "Timesheet_orgId_projectId_workDate_idx" ON "Timesheet"("orgId", "projectId", "workDate");

-- CreateIndex
CREATE INDEX "Timesheet_orgId_status_workDate_idx" ON "Timesheet"("orgId", "status", "workDate");

-- CreateIndex
CREATE INDEX "Timesheet_orgId_salesInvoiceId_idx" ON "Timesheet"("orgId", "salesInvoiceId");

-- CreateIndex
CREATE INDEX "SupportQueue_orgId_status_idx" ON "SupportQueue"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupportQueue_orgId_name_key" ON "SupportQueue"("orgId", "name");

-- CreateIndex
CREATE INDEX "SlaPolicy_orgId_status_idx" ON "SlaPolicy"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SlaPolicy_orgId_name_key" ON "SlaPolicy"("orgId", "name");

-- CreateIndex
CREATE INDEX "Ticket_orgId_status_priority_openedAt_idx" ON "Ticket"("orgId", "status", "priority", "openedAt");

-- CreateIndex
CREATE INDEX "Ticket_orgId_queueId_status_idx" ON "Ticket"("orgId", "queueId", "status");

-- CreateIndex
CREATE INDEX "Ticket_orgId_assignedTo_status_idx" ON "Ticket"("orgId", "assignedTo", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_orgId_number_key" ON "Ticket"("orgId", "number");

-- CreateIndex
CREATE INDEX "TicketEvent_ticketId_createdAt_idx" ON "TicketEvent"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationWindow_orgId_queueId_channel_isActive_idx" ON "CommunicationWindow"("orgId", "queueId", "channel", "isActive");

-- CreateIndex
CREATE INDEX "CommunicationLog_orgId_queueId_occurredAt_idx" ON "CommunicationLog"("orgId", "queueId", "occurredAt");

-- CreateIndex
CREATE INDEX "CommunicationLog_orgId_ticketId_occurredAt_idx" ON "CommunicationLog"("orgId", "ticketId", "occurredAt");

-- CreateIndex
CREATE INDEX "CommunicationLog_orgId_customerId_occurredAt_idx" ON "CommunicationLog"("orgId", "customerId", "occurredAt");

-- CreateIndex
CREATE INDEX "CallLog_orgId_queueId_startedAt_idx" ON "CallLog"("orgId", "queueId", "startedAt");

-- CreateIndex
CREATE INDEX "CallLog_orgId_ticketId_startedAt_idx" ON "CallLog"("orgId", "ticketId", "startedAt");

-- CreateIndex
CREATE INDEX "CallLog_orgId_customerId_startedAt_idx" ON "CallLog"("orgId", "customerId", "startedAt");

-- CreateIndex
CREATE INDEX "Employee_orgId_status_dateOfJoining_idx" ON "Employee"("orgId", "status", "dateOfJoining");

-- CreateIndex
CREATE INDEX "Employee_orgId_departmentId_designationId_idx" ON "Employee"("orgId", "departmentId", "designationId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_orgId_employeeNo_key" ON "Employee"("orgId", "employeeNo");

-- CreateIndex
CREATE INDEX "LeaveAllocation_orgId_employeeId_leaveType_idx" ON "LeaveAllocation"("orgId", "employeeId", "leaveType");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveAllocation_orgId_employeeId_leaveType_periodStart_peri_key" ON "LeaveAllocation"("orgId", "employeeId", "leaveType", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "LeaveApplication_orgId_employeeId_fromDate_toDate_idx" ON "LeaveApplication"("orgId", "employeeId", "fromDate", "toDate");

-- CreateIndex
CREATE INDEX "LeaveApplication_orgId_status_fromDate_idx" ON "LeaveApplication"("orgId", "status", "fromDate");

-- CreateIndex
CREATE INDEX "Attendance_orgId_attendanceDate_status_idx" ON "Attendance"("orgId", "attendanceDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_orgId_employeeId_attendanceDate_key" ON "Attendance"("orgId", "employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "SalaryStructure_orgId_status_effectiveFrom_idx" ON "SalaryStructure"("orgId", "status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_orgId_name_key" ON "SalaryStructure"("orgId", "name");

-- CreateIndex
CREATE INDEX "PayrollEntry_orgId_status_payDate_idx" ON "PayrollEntry"("orgId", "status", "payDate");

-- CreateIndex
CREATE INDEX "PayrollEntry_orgId_periodStart_periodEnd_idx" ON "PayrollEntry"("orgId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_orgId_number_key" ON "PayrollEntry"("orgId", "number");

-- CreateIndex
CREATE INDEX "PayrollEntryEmployee_employeeId_idx" ON "PayrollEntryEmployee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntryEmployee_payrollEntryId_employeeId_key" ON "PayrollEntryEmployee"("payrollEntryId", "employeeId");

-- CreateIndex
CREATE INDEX "Payslip_orgId_employeeId_periodStart_periodEnd_idx" ON "Payslip"("orgId", "employeeId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Payslip_orgId_status_payDate_idx" ON "Payslip"("orgId", "status", "payDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_orgId_number_key" ON "Payslip"("orgId", "number");

-- CreateIndex
CREATE INDEX "ExpenseClaim_orgId_employeeId_claimDate_idx" ON "ExpenseClaim"("orgId", "employeeId", "claimDate");

-- CreateIndex
CREATE INDEX "ExpenseClaim_orgId_status_claimDate_idx" ON "ExpenseClaim"("orgId", "status", "claimDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseClaim_orgId_number_key" ON "ExpenseClaim"("orgId", "number");

-- CreateIndex
CREATE INDEX "AssetCategory_orgId_isActive_idx" ON "AssetCategory"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_orgId_name_key" ON "AssetCategory"("orgId", "name");

-- CreateIndex
CREATE INDEX "Asset_orgId_status_acquiredOn_idx" ON "Asset"("orgId", "status", "acquiredOn");

-- CreateIndex
CREATE INDEX "Asset_orgId_categoryId_status_idx" ON "Asset"("orgId", "categoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_orgId_assetNo_key" ON "Asset"("orgId", "assetNo");

-- CreateIndex
CREATE INDEX "AssetDepreciationEntry_orgId_assetId_postingDate_idx" ON "AssetDepreciationEntry"("orgId", "assetId", "postingDate");

-- CreateIndex
CREATE INDEX "AssetDepreciationEntry_orgId_status_postingDate_idx" ON "AssetDepreciationEntry"("orgId", "status", "postingDate");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_orgId_assetId_status_scheduledOn_idx" ON "MaintenanceSchedule"("orgId", "assetId", "status", "scheduledOn");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_orgId_status_scheduledOn_idx" ON "MaintenanceSchedule"("orgId", "status", "scheduledOn");

-- CreateIndex
CREATE INDEX "MaintenanceVisit_orgId_assetId_visitDate_idx" ON "MaintenanceVisit"("orgId", "assetId", "visitDate");

-- CreateIndex
CREATE INDEX "MaintenanceVisit_orgId_scheduleId_visitDate_idx" ON "MaintenanceVisit"("orgId", "scheduleId", "visitDate");

-- CreateIndex
CREATE INDEX "RegionalProfile_orgId_status_countryCode_idx" ON "RegionalProfile"("orgId", "status", "countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "RegionalProfile_orgId_countryCode_profileKey_key" ON "RegionalProfile"("orgId", "countryCode", "profileKey");

-- CreateIndex
CREATE INDEX "PosProfile_orgId_isActive_idx" ON "PosProfile"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PosProfile_orgId_name_key" ON "PosProfile"("orgId", "name");

-- CreateIndex
CREATE INDEX "PosShift_orgId_profileId_status_idx" ON "PosShift"("orgId", "profileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PosShift_orgId_number_key" ON "PosShift"("orgId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PosSale_salesInvoiceId_key" ON "PosSale"("salesInvoiceId");

-- CreateIndex
CREATE INDEX "PosSale_orgId_profileId_saleDate_idx" ON "PosSale"("orgId", "profileId", "saleDate");

-- CreateIndex
CREATE INDEX "PosSale_orgId_shiftId_status_idx" ON "PosSale"("orgId", "shiftId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PosSale_orgId_number_key" ON "PosSale"("orgId", "number");

-- CreateIndex
CREATE INDEX "PosSaleLine_saleId_lineNo_idx" ON "PosSaleLine"("saleId", "lineNo");

-- CreateIndex
CREATE INDEX "PosSalePayment_saleId_method_idx" ON "PosSalePayment"("saleId", "method");

-- CreateIndex
CREATE INDEX "PortalConfig_orgId_status_partyType_idx" ON "PortalConfig"("orgId", "status", "partyType");

-- CreateIndex
CREATE UNIQUE INDEX "PortalConfig_orgId_partyType_key_key" ON "PortalConfig"("orgId", "partyType", "key");

-- CreateIndex
CREATE INDEX "IntegrationEmailTemplate_orgId_isActive_idx" ON "IntegrationEmailTemplate"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationEmailTemplate_orgId_key_key" ON "IntegrationEmailTemplate"("orgId", "key");

-- CreateIndex
CREATE INDEX "IntegrationEmailQueue_orgId_status_scheduledAt_idx" ON "IntegrationEmailQueue"("orgId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "IntegrationEmailQueue_orgId_toEmail_createdAt_idx" ON "IntegrationEmailQueue"("orgId", "toEmail", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationApiToken_orgId_status_expiresAt_idx" ON "IntegrationApiToken"("orgId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationApiToken_orgId_name_key" ON "IntegrationApiToken"("orgId", "name");

-- CreateIndex
CREATE INDEX "EdiCodeList_orgId_listType_isActive_idx" ON "EdiCodeList"("orgId", "listType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EdiCodeList_orgId_listType_code_key" ON "EdiCodeList"("orgId", "listType", "code");

-- CreateIndex
CREATE INDEX "EdiTransport_orgId_type_status_idx" ON "EdiTransport"("orgId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EdiTransport_orgId_name_key" ON "EdiTransport"("orgId", "name");

-- CreateIndex
CREATE INDEX "BulkJob_orgId_status_createdAt_idx" ON "BulkJob"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BulkJobItem_jobId_status_idx" ON "BulkJobItem"("jobId", "status");

-- CreateIndex
CREATE INDEX "UtilityTask_orgId_status_createdAt_idx" ON "UtilityTask"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_orgId_customerId_date_idx" ON "Activity"("orgId", "customerId", "date");

-- CreateIndex
CREATE INDEX "Activity_orgId_opportunityId_date_idx" ON "Activity"("orgId", "opportunityId", "date");

-- CreateIndex
CREATE INDEX "IamOtpChallenge_companyId_createdAt_idx" ON "IamOtpChallenge"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Opportunity_orgId_stage_updatedAt_idx" ON "Opportunity"("orgId", "stage", "updatedAt");

-- CreateIndex
CREATE INDEX "Opportunity_orgId_customerId_stage_idx" ON "Opportunity"("orgId", "customerId", "stage");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityStageHistory" ADD CONSTRAINT "OpportunityStageHistory_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingOperation" ADD CONSTRAINT "RoutingOperation_routingId_fkey" FOREIGN KEY ("routingId") REFERENCES "Routing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingOperation" ADD CONSTRAINT "RoutingOperation_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bom" ADD CONSTRAINT "Bom_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_routingId_fkey" FOREIGN KEY ("routingId") REFERENCES "Routing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_reservationWarehouseId_fkey" FOREIGN KEY ("reservationWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractingOrder" ADD CONSTRAINT "SubcontractingOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractingOrder" ADD CONSTRAINT "SubcontractingOrder_issueWarehouseId_fkey" FOREIGN KEY ("issueWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractingOrderItem" ADD CONSTRAINT "SubcontractingOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SubcontractingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractingOrderItem" ADD CONSTRAINT "SubcontractingOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractingReceipt" ADD CONSTRAINT "SubcontractingReceipt_subcontractingOrderId_fkey" FOREIGN KEY ("subcontractingOrderId") REFERENCES "SubcontractingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractingReceipt" ADD CONSTRAINT "SubcontractingReceipt_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractingReceipt" ADD CONSTRAINT "SubcontractingReceipt_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractingReceiptItem" ADD CONSTRAINT "SubcontractingReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "SubcontractingReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractingReceiptItem" ADD CONSTRAINT "SubcontractingReceiptItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "SubcontractingOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractingReceiptItem" ADD CONSTRAINT "SubcontractingReceiptItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCapa" ADD CONSTRAINT "QualityCapa_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "QualityInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "SupportQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "SupportQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "SlaPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationWindow" ADD CONSTRAINT "CommunicationWindow_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "SupportQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "SupportQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "SupportQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "SetupDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "SetupDesignation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveAllocation" ADD CONSTRAINT "LeaveAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "AccountingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntryEmployee" ADD CONSTRAINT "PayrollEntryEmployee_payrollEntryId_fkey" FOREIGN KEY ("payrollEntryId") REFERENCES "PayrollEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntryEmployee" ADD CONSTRAINT "PayrollEntryEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollEntryId_fkey" FOREIGN KEY ("payrollEntryId") REFERENCES "PayrollEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationEntry" ADD CONSTRAINT "AssetDepreciationEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceVisit" ADD CONSTRAINT "MaintenanceVisit_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceVisit" ADD CONSTRAINT "MaintenanceVisit_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosProfile" ADD CONSTRAINT "PosProfile_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosShift" ADD CONSTRAINT "PosShift_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PosProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PosProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "PosShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleLine" ADD CONSTRAINT "PosSaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleLine" ADD CONSTRAINT "PosSaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSalePayment" ADD CONSTRAINT "PosSalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEmailQueue" ADD CONSTRAINT "IntegrationEmailQueue_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "IntegrationEmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkJobItem" ADD CONSTRAINT "BulkJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BulkJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IamOtpChallenge" ADD CONSTRAINT "IamOtpChallenge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AutomationRule_tenantId_companyId_entityType_trigger_isActive_i" RENAME TO "AutomationRule_tenantId_companyId_entityType_trigger_isActi_idx";

-- RenameIndex
ALTER INDEX "InventoryBatch_orgId_itemId_warehouseId_locationId_batchCode_ke" RENAME TO "InventoryBatch_orgId_itemId_warehouseId_locationId_batchCod_key";

-- RenameIndex
ALTER INDEX "PermissionRule_roleProfileId_module_resource_action_scopeLevel_" RENAME TO "PermissionRule_roleProfileId_module_resource_action_scopeLe_key";

