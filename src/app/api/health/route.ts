import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logWarn } from "@/lib/logger";
import { detectQueueCapability } from "@/modules/inventory/infrastructure/queue";

type DependencyStatus = {
  ok: boolean;
  details?: Record<string, unknown>;
};

function resolveRequestId(request: Request): string {
  return request.headers.get("x-request-id") || crypto.randomUUID();
}

async function checkDatabase(requestId: string): Promise<DependencyStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch {
    logWarn("health check dependency failed", {
      requestId,
      module: "health.db",
      details: { code: "DB_UNAVAILABLE" },
    });
    return {
      ok: false,
      details: {
        code: "DB_UNAVAILABLE",
      },
    };
  }
}

async function checkQueue(requestId: string): Promise<DependencyStatus> {
  try {
    const capability = await detectQueueCapability();
    return {
      ok: true,
      details: capability,
    };
  } catch {
    logWarn("health check dependency failed", {
      requestId,
      module: "health.queue",
      details: { code: "QUEUE_STATUS_ERROR" },
    });
    return {
      ok: false,
      details: {
        code: "QUEUE_STATUS_ERROR",
      },
    };
  }
}

export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const [db, queue] = await Promise.all([checkDatabase(requestId), checkQueue(requestId)]);
  const ok = db.ok;

  const response = NextResponse.json(
    {
      ok,
      ts: new Date().toISOString(),
      requestId,
      service: {
        name: "minierp-web",
        env: process.env.NODE_ENV ?? "development",
        version: process.env.npm_package_version ?? null,
      },
      build: {
        commit:
          process.env.VERCEL_GIT_COMMIT_SHA ??
          process.env.GITHUB_SHA ??
          process.env.SOURCE_COMMIT ??
          null,
      },
      dependencies: {
        db,
        queue,
      },
      metrics: {
        hook: "stub",
      },
    },
    { status: ok ? 200 : 503 },
  );

  response.headers.set("x-request-id", requestId);
  return response;
}
