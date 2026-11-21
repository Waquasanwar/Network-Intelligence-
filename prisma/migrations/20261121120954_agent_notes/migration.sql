-- CreateEnum
CREATE TYPE "NoteAudience" AS ENUM ('OWNER', 'MEMBER', 'ACCOUNT');

-- CreateTable
CREATE TABLE "AgentNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "audience" "NoteAudience" NOT NULL,
    "personId" TEXT,
    "accountId" TEXT,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "briefId" TEXT,
    "aboutId" TEXT,
    "answer" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentNote_tenantId_audience_createdAt_idx" ON "AgentNote"("tenantId", "audience", "createdAt");

-- CreateIndex
CREATE INDEX "AgentNote_personId_createdAt_idx" ON "AgentNote"("personId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentNote_accountId_createdAt_idx" ON "AgentNote"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentNote_tenantId_key_key" ON "AgentNote"("tenantId", "key");

-- AddForeignKey
ALTER TABLE "AgentNote" ADD CONSTRAINT "AgentNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
