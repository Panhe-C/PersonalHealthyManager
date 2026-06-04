-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActivityRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sportType" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "distanceKm" REAL,
    "averagePaceSecPerKm" INTEGER,
    "averageSpeedKph" REAL,
    "averageHeartRateBpm" INTEGER,
    "calories" INTEGER,
    "trainingLoad" REAL,
    "intensity" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ActivityRecord" ("averageHeartRateBpm", "averagePaceSecPerKm", "averageSpeedKph", "calories", "createdAt", "distanceKm", "durationMinutes", "endedAt", "id", "intensity", "metadataJson", "source", "sourceId", "sportType", "startedAt", "trainingLoad", "userId") SELECT "averageHeartRateBpm", "averagePaceSecPerKm", "averageSpeedKph", "calories", "createdAt", "distanceKm", "durationMinutes", "endedAt", "id", "intensity", "metadataJson", "source", "sourceId", "sportType", "startedAt", "trainingLoad", "userId" FROM "ActivityRecord";
DROP TABLE "ActivityRecord";
ALTER TABLE "new_ActivityRecord" RENAME TO "ActivityRecord";
CREATE INDEX "ActivityRecord_userId_startedAt_idx" ON "ActivityRecord"("userId", "startedAt");
CREATE UNIQUE INDEX "ActivityRecord_userId_source_sourceId_key" ON "ActivityRecord"("userId", "source", "sourceId");
CREATE UNIQUE INDEX "ActivityRecord_id_userId_key" ON "ActivityRecord"("id", "userId");
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
    CONSTRAINT "TrainingCompletion_linkedActivityId_userId_fkey" FOREIGN KEY ("linkedActivityId", "userId") REFERENCES "ActivityRecord" ("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE
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
    CONSTRAINT "TrainingTask_goalId_userId_fkey" FOREIGN KEY ("goalId", "userId") REFERENCES "Goal" ("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE
);
INSERT INTO "new_TrainingTask" ("createdAt", "date", "durationMinutes", "goalId", "id", "intensity", "planId", "scheduledEnd", "scheduledStart", "status", "targetJson", "title", "trainingType", "updatedAt", "userId") SELECT "createdAt", "date", "durationMinutes", "goalId", "id", "intensity", "planId", "scheduledEnd", "scheduledStart", "status", "targetJson", "title", "trainingType", "updatedAt", "userId" FROM "TrainingTask";
DROP TABLE "TrainingTask";
ALTER TABLE "new_TrainingTask" RENAME TO "TrainingTask";
CREATE INDEX "TrainingTask_userId_date_idx" ON "TrainingTask"("userId", "date");
CREATE UNIQUE INDEX "TrainingTask_id_userId_key" ON "TrainingTask"("id", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
