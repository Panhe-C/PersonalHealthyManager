PRAGMA foreign_keys=OFF;

CREATE TABLE "AgentConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "AgentConversation" ("id", "userId", "title", "createdAt", "updatedAt")
SELECT
    'legacy-' || "userId",
    "userId",
    'Previous conversation',
    MIN("createdAt"),
    MAX("createdAt")
FROM "AgentMessage"
GROUP BY "userId";

CREATE TABLE "new_AgentMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentMessage_conversationId_userId_fkey" FOREIGN KEY ("conversationId", "userId") REFERENCES "AgentConversation" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_AgentMessage" ("id", "userId", "conversationId", "role", "content", "metadataJson", "createdAt")
SELECT "id", "userId", 'legacy-' || "userId", "role", "content", "metadataJson", "createdAt"
FROM "AgentMessage";

DROP TABLE "AgentMessage";
ALTER TABLE "new_AgentMessage" RENAME TO "AgentMessage";

CREATE INDEX "AgentConversation_userId_updatedAt_idx" ON "AgentConversation"("userId", "updatedAt");
CREATE UNIQUE INDEX "AgentConversation_id_userId_key" ON "AgentConversation"("id", "userId");
CREATE INDEX "AgentMessage_userId_createdAt_idx" ON "AgentMessage"("userId", "createdAt");
CREATE INDEX "AgentMessage_conversationId_createdAt_idx" ON "AgentMessage"("conversationId", "createdAt");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
