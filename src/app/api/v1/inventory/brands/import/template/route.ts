import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.importRead, async () => {
    const workbook = XLSX.utils.book_new();

    const brandSheet = XLSX.utils.aoa_to_sheet([
      ["Brand Name"],
      ["Example Brand"],
    ]);
    const instructionSheet = XLSX.utils.aoa_to_sheet([
      ["Step", "Guidance"],
      ["1", "Keep one brand per row in the Brands sheet."],
      ["2", "Use the Brand Name column exactly once."],
      ["3", "Duplicate or blank brand names will be skipped during import."],
    ]);

    XLSX.utils.book_append_sheet(workbook, brandSheet, "Brands");
    XLSX.utils.book_append_sheet(workbook, instructionSheet, "Instructions");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="brand-import-template.xlsx"',
      },
    });
  });
}
