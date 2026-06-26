ALTER TABLE "PlanAdjustment" ADD COLUMN "actionId" TEXT;
ALTER TABLE "PlanAdjustment" ADD COLUMN "messageId" TEXT;
ALTER TABLE "PlanAdjustment" ADD COLUMN "undoable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlanAdjustment" ADD COLUMN "undoneAt" DATETIME;
