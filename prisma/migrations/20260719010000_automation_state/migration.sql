CREATE TABLE "AutomationState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastStartedAt" DATETIME,
    "lastCompletedAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastError" TEXT,
    "detailsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AutomationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AutomationState_userId_kind_key" ON "AutomationState"("userId", "kind");
CREATE INDEX "AutomationState_userId_idx" ON "AutomationState"("userId");

CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "deliveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NotificationDelivery_userId_kind_dedupeKey_key" ON "NotificationDelivery"("userId", "kind", "dedupeKey");
CREATE INDEX "NotificationDelivery_userId_deliveredAt_idx" ON "NotificationDelivery"("userId", "deliveredAt");
