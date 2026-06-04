import { prisma } from "@/src/db/client";
import { goalSchema } from "@/src/domain/validation";

type SortableGoal = {
  title: string;
  type: string;
  priority: number;
};

export function sortGoalsByPriority<T extends SortableGoal>(goals: T[]): T[] {
  return [...goals].sort((left, right) => right.priority - left.priority);
}

export function parseGoalInput(input: unknown) {
  return goalSchema.parse(input);
}

export async function createGoal(userId: string, input: unknown) {
  const goal = parseGoalInput(input);

  return prisma.goal.create({
    data: {
      userId,
      title: goal.title,
      type: goal.type,
      priority: goal.priority,
      status: goal.status,
      targetDate: goal.targetDate ? new Date(goal.targetDate) : undefined,
      metricsJson: JSON.stringify(goal.metrics)
    }
  });
}

export async function listGoals(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId, status: "active" }
  });

  return sortGoalsByPriority(goals);
}
