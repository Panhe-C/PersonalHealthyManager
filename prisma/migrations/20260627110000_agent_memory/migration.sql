-- AgentMemory table for cross-conversation long-term user facts/preferences
CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "originMessageId" TEXT,
    "originConversationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AgentMemory_userId_status_idx" ON "AgentMemory"("userId", "status");
CREATE UNIQUE INDEX "AgentMemory_id_userId_key" ON "AgentMemory"("id", "userId");

-- Conversation rolling summary fields
ALTER TABLE "AgentConversation" ADD COLUMN "summary" TEXT;
ALTER TABLE "AgentConversation" ADD COLUMN "summaryUpdatedAt" DATETIME;
ALTER TABLE "AgentConversation" ADD COLUMN "summaryMessageCount" INTEGER NOT NULL DEFAULT 0;
