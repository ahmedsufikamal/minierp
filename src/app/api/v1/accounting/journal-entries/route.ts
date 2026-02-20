import { createJournalEntryDraft, listJournalEntries, submitJournalEntry } from "@/modules/accounting/application/gl-posting.service";
import {
  journalEntryCreateSchema,
  journalEntryListQuerySchema,
  journalEntrySubmitSchema,
} from "@/modules/accounting/domain/schemas";
import { accountingPermissions } from "@/modules/accounting/domain/types";
import { jsonOk, parseJson, parseQuery, withAccountingAuth } from "@/modules/accounting/interface/http";

export async function GET(request: Request) {
  return withAccountingAuth(request, accountingPermissions.journalRead, async (ctx) => {
    const query = parseQuery(request, journalEntryListQuerySchema);
    return jsonOk(await listJournalEntries(ctx, query));
  });
}

export async function POST(request: Request) {
  return withAccountingAuth(request, accountingPermissions.journalWrite, async (ctx) => {
    const payload = await parseJson(request, journalEntryCreateSchema);
    return jsonOk(await createJournalEntryDraft(ctx, payload), { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return withAccountingAuth(request, accountingPermissions.journalSubmit, async (ctx) => {
    const payload = await parseJson(request, journalEntrySubmitSchema);
    return jsonOk(await submitJournalEntry(ctx, payload));
  });
}
