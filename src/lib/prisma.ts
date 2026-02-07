import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function getPool() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:getPool:entry',message:'getPool called',data:{hasEnvVar:!!process.env.DATABASE_URL,envVarLength:process.env.DATABASE_URL?.length||0},timestamp:Date.now(),runId:'run2',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (!process.env.DATABASE_URL) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:getPool:error',message:'DATABASE_URL missing',data:{},timestamp:Date.now(),runId:'run2',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    throw new Error("DATABASE_URL is not set");
  }
  // #region agent log
  const dbUrl = process.env.DATABASE_URL;
  const sanitizedUrl = dbUrl ? dbUrl.replace(/:[^:@]+@/, ':****@') : 'missing';
  const urlMatch = dbUrl ? dbUrl.match(/@([^:]+):(\d+)\//) : null;
  fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:getPool:url',message:'DATABASE_URL found',data:{urlLength:dbUrl?.length||0,urlPreview:sanitizedUrl.substring(0,100),hasPool:!!globalForPrisma.pgPool,host:urlMatch?.[1],port:urlMatch?.[2]},timestamp:Date.now(),runId:'run2',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (!globalForPrisma.pgPool) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:getPool:create',message:'Creating new Pool',data:{max:20},timestamp:Date.now(),runId:'run2',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    globalForPrisma.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:getPool:created',message:'Pool created',data:{poolId:globalForPrisma.pgPool?.id},timestamp:Date.now(),runId:'run2',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:getPool:exit',message:'Returning pool',data:{hasPool:!!globalForPrisma.pgPool},timestamp:Date.now(),runId:'run2',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  return globalForPrisma.pgPool;
}

// #region agent log
const hasDbUrl = !!process.env.DATABASE_URL;
const dbUrlPreview = process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@').substring(0, 100) : 'missing';
const hasExisting = !!globalForPrisma.prisma;
const existingHasBrand = hasExisting ? !!globalForPrisma.prisma?.brand : false;
const existingHasCategory = hasExisting ? !!globalForPrisma.prisma?.category : false;
fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:init',message:'Initializing Prisma client',data:{hasExisting,nodeEnv:process.env.NODE_ENV,hasDbUrl,dbUrlPreview,existingHasBrand,existingHasCategory},timestamp:Date.now(),runId:'run3',hypothesisId:'C'})}).catch(()=>{});
// #endregion

// Check if cached client has new models, if not clear it
if (globalForPrisma.prisma && (!globalForPrisma.prisma.brand || !globalForPrisma.prisma.category)) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:clearCache',message:'Clearing stale Prisma client cache',data:{},timestamp:Date.now(),runId:'run3',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  globalForPrisma.prisma = undefined;
}

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:create',message:'Creating new PrismaClient',data:{},timestamp:Date.now(),runId:'run2',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    try {
      const pool = getPool();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:adapter',message:'Creating adapter',data:{hasPool:!!pool},timestamp:Date.now(),runId:'run2',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const adapter = new PrismaPg(pool);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:client',message:'Creating PrismaClient with adapter',data:{},timestamp:Date.now(),runId:'run2',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const client = new PrismaClient({ adapter });
      // #region agent log
      const clientHasBrand = !!client.brand;
      const clientHasCategory = !!client.category;
      const clientHasStockLocation = !!client.stockLocation;
      const clientHasStockBalance = !!client.stockBalance;
      fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:clientCreated',message:'PrismaClient created',data:{hasBrand:clientHasBrand,hasCategory:clientHasCategory,hasStockLocation:clientHasStockLocation,hasStockBalance:clientHasStockBalance},timestamp:Date.now(),runId:'run3',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return client;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:error',message:'Error creating PrismaClient',data:{errorMessage:error instanceof Error?error.message:'unknown',errorName:error instanceof Error?error.name:'unknown'},timestamp:Date.now(),runId:'run3',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      throw error;
    }
  })();

if (process.env.NODE_ENV !== "production") {
  // #region agent log
  const finalHasBrand = !!prisma.brand;
  const finalHasCategory = !!prisma.category;
  fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:finalCheck',message:'Final Prisma client check',data:{hasBrand:finalHasBrand,hasCategory:finalHasCategory},timestamp:Date.now(),runId:'run3',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  globalForPrisma.prisma = prisma;
}
