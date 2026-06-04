-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CalendarEventDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "trainingTaskId" TEXT,
    "title" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "notes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "externalEventId" TEXT,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CalendarEventDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CalendarEventDraft_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "Plan" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CalendarEventDraft_trainingTaskId_userId_fkey" FOREIGN KEY ("trainingTaskId", "userId") REFERENCES "TrainingTask" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CalendarEventDraft" ("createdAt", "endsAt", "externalEventId", "failureReason", "id", "notes", "planId", "startsAt", "status", "title", "trainingTaskId", "updatedAt", "userId") SELECT "createdAt", "endsAt", "externalEventId", "failureReason", "id", "notes", "planId", "startsAt", "status", "title", "trainingTaskId", "updatedAt", "userId" FROM "CalendarEventDraft";
DROP TABLE "CalendarEventDraft";
ALTER TABLE "new_CalendarEventDraft" RENAME TO "CalendarEventDraft";
CREATE UNIQUE INDEX "CalendarEventDraft_trainingTaskId_key" ON "CalendarEventDraft"("trainingTaskId");
CREATE INDEX "CalendarEventDraft_userId_startsAt_idx" ON "CalendarEventDraft"("userId", "startsAt");
CREATE UNIQUE INDEX "CalendarEventDraft_trainingTaskId_userId_key" ON "CalendarEventDraft"("trainingTaskId", "userId");
CREATE TABLE "new_PlanAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "previousStateJson" TEXT NOT NULL,
    "newStateJson" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanAdjustment_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "Plan" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlanAdjustment" ("createdAt", "explanation", "id", "newStateJson", "planId", "previousStateJson", "reason", "trigger", "userId") SELECT "createdAt", "explanation", "id", "newStateJson", "planId", "previousStateJson", "reason", "trigger", "userId" FROM "PlanAdjustment";
DROP TABLE "PlanAdjustment";
ALTER TABLE "new_PlanAdjustment" RENAME TO "PlanAdjustment";
CREATE INDEX "PlanAdjustment_userId_createdAt_idx" ON "PlanAdjustment"("userId", "createdAt");
CREATE TABLE "new_TrainingCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "perceivedEffort" TEXT,
    "notes" TEXT,
    "linkedActivityId" TEXT,
    "plannedVsActualJson" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingCompletion_taskId_userId_fkey" FOREIGN KEY ("taskId", "userId") REFERENCES "TrainingTask" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingCompletion_linkedActivityId_fkey" FOREIGN KEY ("linkedActivityId") REFERENCES "ActivityRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TrainingCompletion" ("completedAt", "id", "linkedActivityId", "notes", "perceivedEffort", "plannedVsActualJson", "status", "taskId", "userId") SELECT "completedAt", "id", "linkedActivityId", "notes", "perceivedEffort", "plannedVsActualJson", "status", "taskId", "userId" FROM "TrainingCompletion";
DROP TABLE "TrainingCompletion";
ALTER TABLE "new_TrainingCompletion" RENAME TO "TrainingCompletion";
CREATE UNIQUE INDEX "TrainingCompletion_taskId_key" ON "TrainingCompletion"("taskId");
CREATE UNIQUE INDEX "TrainingCompletion_taskId_userId_key" ON "TrainingCompletion"("taskId", "userId");
CREATE TABLE "new_TrainingTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "trainingType" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "intensity" TEXT NOT NULL,
    "targetJson" TEXT NOT NULL,
    "scheduledStart" DATETIME,
    "scheduledEnd" DATETIME,
    "goalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingTask_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "Plan" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingTask_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TrainingTask" ("createdAt", "date", "durationMinutes", "goalId", "id", "intensity", "planId", "scheduledEnd", "scheduledStart", "status", "targetJson", "title", "trainingType", "updatedAt", "userId") SELECT "createdAt", "date", "durationMinutes", "goalId", "id", "intensity", "planId", "scheduledEnd", "scheduledStart", "status", "targetJson", "title", "trainingType", "updatedAt", "userId" FROM "TrainingTask";
DROP TABLE "TrainingTask";
ALTER TABLE "new_TrainingTask" RENAME TO "TrainingTask";
CREATE INDEX "TrainingTask_userId_date_idx" ON "TrainingTask"("userId", "date");
CREATE UNIQUE INDEX "TrainingTask_id_userId_key" ON "TrainingTask"("id", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ActivityRecord_userId_source_sourceId_key" ON "ActivityRecord"("userId", "source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Goal_id_userId_key" ON "Goal"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_id_userId_key" ON "Plan"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryRecord_userId_source_date_key" ON "RecoveryRecord"("userId", "source", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SleepRecord_userId_source_date_key" ON "SleepRecord"("userId", "source", "date");
