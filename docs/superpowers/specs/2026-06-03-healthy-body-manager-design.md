# Healthy Body Manager Design

## Overview

Healthy Body Manager is a personal body management product prototype. It combines a Web App with a conversational Agent to help a user maintain a body profile, set long-term and short-term goals, sync exercise, sleep, recovery, and calendar data, then generate weekly and daily training and nutrition plans.

The first version uses a Hybrid Product Shell approach:

- The Web App is the stable product surface for login, profile management, goals, plans, daily checklist, and plan confirmation.
- The App Backend owns internal data models, persistence, APIs, provider interfaces, and planning engine orchestration.
- COROS and Feishu Calendar data can be synced by an external Agent/MCP workflow during the first version.
- The backend exposes clean sync/import APIs and consumes only normalized internal data models.
- Meal menu data uses a mock provider in the first version, while keeping a provider shape that can later connect to a real MCP source.

The system targets individual personal use across devices, with email/password login, cookie-based sessions, and user-scoped data. It is not a coach/team product in the first version.

## Goals

- Maintain a personal body profile with physical data, training background, injuries, restrictions, and preferences.
- Support a goal model with long-term goals, one current primary goal, and short-term event goals such as marathon or cycling plans.
- Sync or import COROS exercise, sleep, recovery, and fitness assessment data through a provider boundary.
- Sync or import Feishu Calendar schedule and free/busy data through a provider boundary.
- Generate weekly and daily training plans from goals, recovery status, sleep, training history, and calendar availability.
- Provide daily nutrition targets and menu recommendations based on mock breakfast, lunch, and dinner menu data.
- Display a daily training checklist and update training history when planned work is completed, partially completed, skipped, or reconciled with actual COROS workouts.
- Dynamically adjust the remaining weekly plan based on completed training, skipped sessions, excessive load, poor recovery, sleep changes, and calendar changes.
- Generate calendar event drafts and write them to Feishu Calendar only after user confirmation.
- Provide an Agent conversation page for replanning, explanation, adjustment, and confirmation flows.

## Non-Goals

- No medical diagnosis or treatment guidance.
- No replacement for a doctor, registered dietitian, or professional coach.
- No multi-user coach/team dashboard.
- No automatic edits to existing private calendar events.
- No automatic calendar write-back before user confirmation.
- No detailed meal recipes, shopping lists, or meal prep plans.
- No complete backend MCP host lifecycle in the first version.
- No multi-platform health data aggregation beyond COROS in the first version.

## Product Shape

The first version is a Web App plus conversational Agent.

The Web App handles durable user workflows:

- Login and account access across devices.
- Body profile creation and updates.
- Goal management.
- Weekly and daily plan review.
- Daily training checklist completion.
- Nutrition target and menu recommendation review.
- Calendar write-back confirmation.
- Sync status visibility.

The Agent handles flexible workflows:

- Explain why a plan was generated.
- Answer whether a planned training session is appropriate today.
- Replan based on sleep, recovery, schedule changes, or user feedback.
- Help confirm and batch-write training events into Feishu Calendar.
- Interpret daily menu choices against training and nutrition goals.

The Agent must not bypass planning safety rules. It can request changes and explain options, but final structured plans are produced through the planning engine.

## Architecture

The system has four layers.

### Web App

The Web App contains the product UI:

- Login page.
- Body profile page.
- Goals page.
- Plan page with weekly and daily views.
- Daily training checklist.
- Agent conversation page.
- Calendar write-back review flow.

### App Backend

The backend owns:

- User and session data.
- Body profile data.
- Goals.
- Normalized activity, sleep, recovery, and calendar snapshots.
- Meal menu data.
- Weekly and daily plans.
- Training checklist state.
- Plan adjustment history.
- Calendar write-back drafts and results.
- APIs used by the Web App and Agent sync workflows.

### Provider Layer

Providers normalize external data into internal models:

- `CorosProvider`: exercise, sleep, recovery, HRV, resting heart rate, training load, fitness assessment.
- `CalendarProvider`: Feishu schedule snapshots, free/busy windows, calendar event draft creation, confirmed event write-back.
- `MealMenuProvider`: breakfast, lunch, and dinner menu options. The first version uses mock data.

The planning engine consumes only internal models. It must not depend on raw COROS, Feishu, or mock provider field names.

### Planning Engine And Agent

The planning engine is a deterministic TypeScript module that produces structured plans and plan adjustments from user profile, goals, health data, schedule availability, menu data, and completion feedback.

The Agent is the natural-language interface around that engine. It explains, asks for confirmation, summarizes options, and triggers approved operations.

## Data Models

### User

Stores account identity, password hash, session ownership, timezone, and product preferences. The first version uses email/password login with cookie-based sessions and user-scoped data isolation.

### BodyProfile

Stores:

- Height.
- Weight.
- Body fat percentage.
- Birthday or age.
- Sex.
- Resting heart rate when available.
- Training experience.
- Injury history and restrictions.
- Dietary preferences.
- Training preferences.

### Goal

Stores:

- Long-term body management goals.
- Current primary goal.
- Secondary goals.
- Short-term event goals.
- Goal priority.
- Target dates.
- Goal status.

Examples:

- Primary goal: fat loss.
- Short-term event goal: marathon on a specific date.
- Short-term event goal: monthly cycling distance target.
- Secondary goal: preserve strength training.
- Long-term goal: improve sleep quality and aerobic fitness.

When short-term event goals approach their target date, their priority can rise, but injury, recovery, and sleep constraints still override aggressive training.

### ActivityRecord

Stores normalized COROS workout data:

- Sport type.
- Start and end time.
- Duration.
- Distance.
- Pace or speed.
- Heart rate summary.
- Calories if available.
- Training load.
- Intensity classification.
- Location or source metadata when available.

### SleepRecord And RecoveryRecord

Stores:

- Sleep duration.
- Sleep window.
- Sleep quality or score.
- HRV.
- Resting heart rate.
- Stress level.
- Recovery percentage.
- Training load assessment.

### CalendarSnapshot

Stores the planning-relevant view of Feishu Calendar:

- Busy windows.
- Available training windows.
- Important event tags.
- Source event references when needed for traceability.
- Snapshot time.

The planning engine does not need full calendar business objects.

### MealMenu

Stores mock menu options for breakfast, lunch, and dinner:

- Dish name.
- Meal period.
- Estimated calories.
- Estimated protein, carbohydrate, and fat.
- Tags such as high-protein, high-carb, fried, light, vegetarian, or spicy.
- Recommendation notes.

### Plan

Stores weekly and daily plans:

- Week start and end.
- Planned training distribution.
- Daily training tasks.
- Recovery guidance.
- Nutrition targets.
- Menu recommendations.
- Calendar event drafts.
- Calendar write-back status.
- Explanation summary.

### TrainingTask

Stores one planned training session:

- Date.
- Training type.
- Duration.
- Intensity.
- Target heart rate, pace, speed, or effort range.
- Scheduled time window.
- Relationship to a goal.
- Status.

### TrainingChecklistItem

Stores executable steps inside a daily training task:

- Warmup.
- Main workout.
- Cooldown.
- Stretching.
- Subjective effort feedback.
- Completion state.

### TrainingCompletion

Stores completion feedback and reconciliation:

- Completed, partially completed, skipped, or over-completed.
- User-entered feedback.
- Linked COROS activity when available.
- Comparison against planned duration, distance, intensity, and training load.
- Completion timestamp.

### PlanAdjustment

Stores dynamic plan changes:

- Triggering event.
- Previous plan state.
- New plan state.
- Reason.
- User-visible explanation.

Examples:

- Skipped interval workout due to a packed calendar.
- Reduced next-day intensity after poor sleep.
- Added recovery day after excessive training load.
- Shortened training because the available window changed.

## Data Flow

### Weekly Plan Generation

1. Sync or import recent COROS activity, sleep, recovery, and fitness assessment data.
2. Sync or import Feishu Calendar schedule and free/busy data for the week.
3. Load user body profile, goal priority, and short-term event goals.
4. Load meal menu data for relevant days if available.
5. Planning engine generates the weekly training structure.
6. Planning engine generates daily plans, checklist items, nutrition targets, and calendar event drafts.
7. Agent produces a concise explanation and highlights conflicts or trade-offs.
8. User reviews the plan in the Web App or Agent conversation.
9. User confirms calendar write-back.
10. System writes approved training events to Feishu Calendar and stores results.

### Daily Plan Review

1. Load today's sleep, recovery, schedule, and training plan.
2. Check whether the planned training still fits the available schedule window.
3. Lower intensity or suggest recovery if sleep or recovery is poor.
4. Display today's checklist.
5. Display nutrition targets and mock menu recommendations.
6. Ask for confirmation before any calendar write-back if new or changed event drafts are produced.

### Training Checklist Completion

1. User marks checklist items completed, partially completed, or skipped.
2. System optionally reconciles planned training with actual COROS activity data.
3. System writes a `TrainingCompletion` record.
4. Planning engine recalculates weekly remaining training load.
5. Planning engine adjusts remaining daily plans when needed.
6. System stores a `PlanAdjustment` with a user-visible reason.
7. Web App updates weekly progress, daily status, and next training recommendations.

## Planning Logic

The planning engine uses a hybrid approach.

### Deterministic Rule Engine

The rule engine handles hard constraints:

- Injury and restriction rules override all goal pressure.
- Poor sleep or low recovery blocks high-intensity training.
- Consecutive high-intensity days require recovery spacing.
- Weekly training load growth is conservative.
- Calendar availability determines feasible training windows.
- Short-term event goals can raise priority as their date approaches.
- Actual over-completion reduces later load.
- Skipped or partial sessions can be rescheduled, downgraded, or canceled based on remaining weekly load and available windows.

The engine outputs structured plans, not free-form text.

### Agent Layer

The Agent handles:

- Explanation.
- Conversational adjustments.
- Trade-off presentation.
- User confirmation.
- Calendar write-back orchestration.
- Menu recommendation interpretation.

The Agent can propose options, but it must respect rule engine constraints.

## Nutrition Logic

The first version provides nutrition targets and menu selection advice, not complete meal recipes.

For each day, the system should provide:

- Estimated calorie target or range.
- Protein target.
- Carbohydrate guidance based on training intensity and timing.
- Fat guidance.
- Hydration or recovery notes when relevant.
- Recommended and cautious choices from mock breakfast, lunch, and dinner menus.

Menu recommendation examples:

- Prefer higher protein options on strength training days.
- Prefer moderate carbohydrate before endurance sessions.
- Avoid very heavy or fried options before high-intensity training.
- Add recovery-focused carbohydrate and protein after long endurance sessions.

## Calendar Write-Back

Calendar write-back follows a confirmation-first flow.

1. Planning engine creates calendar event drafts.
2. Web App displays event title, date, start time, end time, training type, and notes.
3. User confirms the batch.
4. Agent/MCP or future backend provider creates Feishu Calendar events.
5. System records success or failure per event.
6. Failed events can be retried.

The first version writes only training arrangements. It does not automatically write nutrition reminders. It does not modify existing private events.

## Pages

### Login Page

Supports email/password login for a personal product prototype. Authenticated sessions are stored server-side or as signed cookies, and every profile, goal, health record, plan, checklist, and calendar draft is scoped to the authenticated user.

### Body Profile Page

Allows creating and editing body profile data. Also displays recent COROS sync status such as latest workout, last-night sleep, and recovery state.

### Goals Page

Allows managing:

- Long-term goals.
- Current primary goal.
- Short-term event goals.
- Goal priority.
- Target dates.

### Plan Page

Includes weekly and daily views.

Weekly view shows:

- Training distribution.
- Key sessions.
- Rest days.
- Planned versus actual completion.
- Weekly training load progress.
- Adjustments made and reasons.

Daily view shows:

- Today's training.
- Checklist.
- Recovery guidance.
- Nutrition targets.
- Meal menu recommendations.
- Calendar write-back status.

### Agent Conversation Page

Supports prompts such as:

- "根据我这周日程重新排一下训练。"
- "我昨晚没睡好，今天还适合跑吗？"
- "帮我把本周训练写入飞书日历。"
- "今天午餐这些菜怎么选？"
- "我今天只完成了一半训练，后面几天怎么调整？"

## First-Version Technical Direction

Recommended stack:

- Next.js.
- TypeScript.
- SQLite.
- Prisma.
- A standalone TypeScript planning engine module.
- Provider interfaces with mock implementations and Agent sync/import entrypoints.

This stack keeps the first version compact while supporting Web App pages, backend APIs, persistence, and future provider upgrades in one repository.

## Testing Strategy

### Rule Engine Unit Tests

Cover:

- Poor sleep blocks high-intensity training.
- Low recovery lowers next-day intensity.
- Consecutive high-intensity sessions require spacing.
- Short-term event goals affect weekly plan priority.
- Skipped training triggers reschedule, downgrade, or cancellation.
- Over-completed training reduces remaining weekly load.
- Calendar windows constrain training duration and timing.

### Provider Contract Tests

Cover:

- COROS-like activity data normalizes into `ActivityRecord`.
- COROS-like sleep and recovery data normalizes into `SleepRecord` and `RecoveryRecord`.
- Feishu Calendar-like busy data normalizes into `CalendarSnapshot`.
- Mock menu data normalizes into `MealMenu`.

### Checklist Loop Tests

Cover:

- Completing all checklist items marks a task completed.
- Partial completion records missing items and updates training history.
- Skipping a training task triggers plan adjustment.
- Actual COROS activity can reconcile with planned training.

### Calendar Write-Back Tests

Cover:

- Plan creates event drafts.
- User confirmation is required.
- Successful write-back updates event status.
- Per-event failure is recorded and can be retried.

### Page Interaction Tests

Cover:

- Body profile creation.
- Goal creation and priority setting.
- Weekly plan review.
- Daily checklist completion.
- Nutrition recommendation display.
- Calendar write-back confirmation flow.

## Acceptance Criteria

The first version is complete when a user can:

- Log in and access their own data across devices.
- Create and edit a body profile.
- Set long-term goals, a primary goal, and short-term event goals.
- Sync or import COROS activity, sleep, and recovery data through normalized APIs.
- Sync or import Feishu Calendar schedule/free-busy data through normalized APIs.
- Generate a weekly training plan and daily training plan.
- View a daily training checklist.
- Mark training completed, partially completed, skipped, or reconcile it with actual COROS activity.
- See the remaining weekly plan dynamically adjust after completion feedback or recovery changes.
- View daily nutrition targets and mock menu recommendations.
- Review calendar event drafts and confirm batch write-back to Feishu Calendar.
- See write-back success or failure per calendar event.

## Future Extensions

- Backend directly becomes an MCP host.
- Real meal menu MCP integration.
- More health platforms.
- More precise nutrition planning.
- More complete event-goal training templates.
- Multi-user support.
- Coach or team views.
- Automated but user-configurable replanning and calendar updates.
