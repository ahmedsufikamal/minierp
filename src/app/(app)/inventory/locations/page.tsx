import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";
import { LocationsList } from "./components";

export const dynamic = "force-dynamic";

type MissingSchemaError = {
  code?: string;
  message?: string;
};

type LocationRow = {
  id: string;
  code: string;
  name: string | null;
};

type BalanceRow = {
  locationId: string | null;
  qtyOnHand: number;
  avgCostMinor: number | null;
  location: { code: string } | null;
};

type OverallBalanceRow = {
  qtyOnHand: number;
  avgCostMinor: number | null;
};

function isMissingSchemaError(error: unknown): boolean {
  const e = error as MissingSchemaError;
  return e?.code === "P2021" || e?.code === "P2022" || Boolean(e?.message?.includes("does not exist"));
}

export default async function InventoryLocationsPage() {
  const companyId = await getCompanyIdOrUserId();

  let locations: LocationRow[] = [];
  let balances: BalanceRow[] = [];
  let overallBalances: OverallBalanceRow[] = [];

  try {
    [locations, balances] = await Promise.all([
      prisma.stockLocation.findMany({
        where: { companyId },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      }).catch((error: unknown) => {
        if (isMissingSchemaError(error)) {
          return [];
        }
        throw error;
      }),
      prisma.stockBalance.findMany({
        where: {
          companyId,
          locationId: { not: null },
        },
        select: {
          locationId: true,
          qtyOnHand: true,
          avgCostMinor: true,
          location: {
            select: { code: true },
          },
        },
      }).catch((error: unknown) => {
        if (isMissingSchemaError(error)) {
          return [];
        }
        throw error;
      }),
    ]);

    // Calculate overall totals
    overallBalances = await prisma.stockBalance.findMany({
      where: {
        companyId,
        locationId: null,
      },
      select: {
        qtyOnHand: true,
        avgCostMinor: true,
      },
    }).catch((error: unknown) => {
      if (isMissingSchemaError(error)) {
        return [];
      }
      throw error;
    });
  } catch (error: unknown) {
    // If tables don't exist, show migration message
    if (isMissingSchemaError(error)) {
      locations = [];
      balances = [];
      overallBalances = [];
    } else {
      throw error;
    }
  }

  // Calculate totals per location
  const locationTotals = new Map<
    string,
    { qty: number; value: number; itemCount: number }
  >();

  for (const balance of balances) {
    if (!balance.locationId || !balance.location) continue;
    const locCode = balance.location.code;
    
    if (!locationTotals.has(locCode)) {
      locationTotals.set(locCode, { qty: 0, value: 0, itemCount: 0 });
    }
    
    const totals = locationTotals.get(locCode)!;
    totals.qty += balance.qtyOnHand;
    totals.value += balance.qtyOnHand * (balance.avgCostMinor ?? 0);
    totals.itemCount += balance.qtyOnHand > 0 ? 1 : 0;
  }

  const overallTotal = {
    qty: overallBalances.reduce((sum, b) => sum + b.qtyOnHand, 0),
    value: overallBalances.reduce((sum, b) => sum + b.qtyOnHand * (b.avgCostMinor ?? 0), 0),
    itemCount: overallBalances.filter((b) => b.qtyOnHand > 0).length,
  };

  const needsMigration = locations.length === 0 && balances.length === 0 && overallBalances.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Locations"
        subtitle="View inventory totals by location."
      />

      {needsMigration && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="font-medium text-amber-900 mb-1">Database Migration Required</div>
              <div className="text-sm text-amber-700">
                The inventory tables haven&apos;t been created yet. Please run the migration:
              </div>
              <code className="mt-2 block text-xs bg-amber-100 p-2 rounded">
                npx prisma migrate dev
              </code>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="rounded-2xl border p-5">
            <div className="font-medium mb-4">Overall Summary</div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Items:</span>
                <span className="font-medium">{overallTotal.itemCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Quantity:</span>
                <span className="font-medium">{overallTotal.qty.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Value:</span>
                <span className="font-medium">
                  {formatMoney(overallTotal.value, "BDT")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl border">
            <div className="p-4 border-b">
              <div className="font-medium">Locations ({locations.length})</div>
              <div className="text-sm text-muted-foreground">
                Stock levels by location
              </div>
            </div>

            {locations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No locations found. Import inventory data to create locations.
              </div>
            ) : (
              <LocationsList
                locations={locations}
                locationTotals={locationTotals}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
