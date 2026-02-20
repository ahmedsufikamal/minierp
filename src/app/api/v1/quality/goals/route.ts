import {
  createQualityGoal,
  listQualityGoals,
} from "@/modules/quality/application/goals.service";
import {
  qualityGoalCreateSchema,
  qualityGoalListQuerySchema,
} from "@/modules/quality/domain/schemas";
import { qualityPermissions } from "@/modules/quality/domain/types";
import { jsonOk, parseJson, parseQuery, withQualityAuth } from "@/modules/quality/interface/http";

export async function GET(request: Request) {
  return withQualityAuth(request, qualityPermissions.goalRead, async (ctx) => {
    const query = parseQuery(request, qualityGoalListQuerySchema);
    return jsonOk(await listQualityGoals(ctx, query));
  });
}

export async function POST(request: Request) {
  return withQualityAuth(request, qualityPermissions.goalWrite, async (ctx) => {
    const payload = await parseJson(request, qualityGoalCreateSchema);
    return jsonOk(await createQualityGoal(ctx, payload), { status: 201 });
  });
}
