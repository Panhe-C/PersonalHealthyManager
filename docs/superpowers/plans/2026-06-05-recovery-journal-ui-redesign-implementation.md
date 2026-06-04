# Recovery Journal UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Healthy Body Manager as a compact Recovery Journal experience, with a Week Ledger Plan page and a consistent modern visual system across Profile, Goals, Agent, and Login.

**Architecture:** Keep all existing APIs, Prisma models, and planning behavior unchanged. Add a small pure presentation module for week grouping and focused-task selection, introduce focused navigation and ledger components, then update existing page/component markup to consume the same server data with a new CSS design system.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma, Vitest, Testing Library, lucide-react, CSS.

---

## File Structure

Create these focused files:

```text
components/
  AppNavigation.tsx       # Route-aware top navigation and brand
  WeekLedger.tsx          # Seven-day weekly training summary
src/presentation/
  weekLedger.ts           # Pure local-date grouping and focused-task selection
tests/components/
  AppNavigation.test.tsx
  MetricCard.test.tsx
  WeeklyPlan.test.tsx
tests/presentation/
  weekLedger.test.ts
```

Modify these existing files:

```text
app/
  (auth)/login/page.tsx
  (dashboard)/agent/page.tsx
  (dashboard)/goals/page.tsx
  (dashboard)/layout.tsx
  (dashboard)/plan/page.tsx
  (dashboard)/profile/page.tsx
  globals.css
components/
  ActionButton.tsx
  AgentPanel.tsx
  CalendarDraftList.tsx
  Checklist.tsx
  GeneratePlanButton.tsx
  GoalForm.tsx
  MetricCard.tsx
  NutritionPanel.tsx
  ProfileForm.tsx
  SyncDemoDataButton.tsx
  WeeklyPlan.tsx
```

Responsibilities:

- `src/presentation/weekLedger.ts` owns deterministic presentation-only date rules.
- `components/WeekLedger.tsx` owns the stable seven-column weekly summary.
- `components/WeeklyPlan.tsx` owns expanded training details and checklist placement.
- `components/AppNavigation.tsx` owns route-aware navigation state.
- `app/globals.css` owns shared tokens, layout, component states, and responsive rules.
- Dashboard pages continue to own their server-side queries and composition.

---

### Task 1: Add Week Ledger Presentation Rules

**Files:**
- Create: `src/presentation/weekLedger.ts`
- Create: `tests/presentation/weekLedger.test.ts`

- [ ] **Step 1: Write the failing grouping and focus-selection tests**

Create `tests/presentation/weekLedger.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildWeekLedger, selectFocusedTaskId } from "@/src/presentation/weekLedger";

const task = (id: string, date: Date) => ({
  id,
  date,
  title: id,
  trainingType: "run",
  durationMinutes: 45,
  intensity: "moderate",
  status: "planned"
});

describe("week ledger presentation", () => {
  it("builds seven local-date columns and groups tasks into their day", () => {
    const monday = new Date(2026, 5, 1);
    const ledger = buildWeekLedger(
      [task("tuesday-a", new Date(2026, 5, 2, 7)), task("tuesday-b", new Date(2026, 5, 2, 18))],
      monday,
      new Date(2026, 5, 4)
    );

    expect(ledger).toHaveLength(7);
    expect(ledger[1].tasks.map((item) => item.id)).toEqual(["tuesday-a", "tuesday-b"]);
    expect(ledger[3].isToday).toBe(true);
  });

  it("focuses today's first task", () => {
    expect(
      selectFocusedTaskId(
        [task("yesterday", new Date(2026, 5, 3)), task("today", new Date(2026, 5, 4, 18))],
        new Date(2026, 5, 4, 8)
      )
    ).toBe("today");
  });

  it("focuses the nearest upcoming task when today is empty", () => {
    expect(
      selectFocusedTaskId(
        [task("later", new Date(2026, 5, 6)), task("next", new Date(2026, 5, 5))],
        new Date(2026, 5, 4)
      )
    ).toBe("next");
  });

  it("focuses the most recent task when no upcoming task exists", () => {
    expect(
      selectFocusedTaskId(
        [task("older", new Date(2026, 5, 1)), task("recent", new Date(2026, 5, 3))],
        new Date(2026, 5, 4)
      )
    ).toBe("recent");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/presentation/weekLedger.test.ts
```

Expected: FAIL because `@/src/presentation/weekLedger` does not exist.

- [ ] **Step 3: Implement the pure presentation module**

Create `src/presentation/weekLedger.ts`:

```ts
export type WeekLedgerTask = {
  id: string;
  date: Date;
  title: string;
  trainingType: string;
  durationMinutes: number;
  intensity: string;
  status: string;
};

export type WeekLedgerDay = {
  date: Date;
  dateKey: string;
  isToday: boolean;
  tasks: WeekLedgerTask[];
};

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildWeekLedger(tasks: WeekLedgerTask[], weekStart: Date, today: Date): WeekLedgerDay[] {
  const taskGroups = new Map<string, WeekLedgerTask[]>();
  const sortedTasks = [...tasks].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const task of sortedTasks) {
    const key = localDateKey(task.date);
    taskGroups.set(key, [...(taskGroups.get(key) ?? []), task]);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startOfDay(weekStart), index);
    const dateKey = localDateKey(date);
    return {
      date,
      dateKey,
      isToday: dateKey === localDateKey(today),
      tasks: taskGroups.get(dateKey) ?? []
    };
  });
}

export function selectFocusedTaskId(tasks: WeekLedgerTask[], today: Date) {
  if (tasks.length === 0) return null;

  const sortedTasks = [...tasks].sort((a, b) => a.date.getTime() - b.date.getTime());
  const todayKey = localDateKey(today);
  const todayTask = sortedTasks.find((task) => localDateKey(task.date) === todayKey);
  if (todayTask) return todayTask.id;

  const todayStart = startOfDay(today).getTime();
  const upcomingTask = sortedTasks.find((task) => task.date.getTime() >= todayStart);
  return upcomingTask?.id ?? sortedTasks[sortedTasks.length - 1].id;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- tests/presentation/weekLedger.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/weekLedger.ts tests/presentation/weekLedger.test.ts
git commit -m "feat: add week ledger presentation rules"
```

---

### Task 2: Build the Week Ledger and Focused Training Details

**Files:**
- Create: `components/WeekLedger.tsx`
- Create: `tests/components/WeeklyPlan.test.tsx`
- Modify: `components/WeeklyPlan.tsx`

- [ ] **Step 1: Write the failing WeeklyPlan component test**

Create `tests/components/WeeklyPlan.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeeklyPlan } from "@/components/WeeklyPlan";

const plan = {
  summary: "Marathon build",
  explanation: "Balanced load for race preparation.",
  trainingTasks: [
    {
      id: "today",
      date: new Date(2026, 5, 4),
      title: "Tempo run",
      trainingType: "run",
      status: "planned",
      intensity: "moderate",
      durationMinutes: 45,
      scheduledStart: new Date(2026, 5, 4, 18),
      checklistItems: [{ id: "warmup", label: "Warm up", status: "pending" }]
    },
    {
      id: "saturday",
      date: new Date(2026, 5, 6),
      title: "Long run",
      trainingType: "run",
      status: "planned",
      intensity: "easy",
      durationMinutes: 90,
      scheduledStart: null,
      checklistItems: []
    }
  ]
};

describe("WeeklyPlan", () => {
  it("renders a seven-day ledger and expands today's task", () => {
    const { container } = render(
      <WeeklyPlan
        plan={plan}
        activities={[]}
        today={new Date(2026, 5, 4)}
        weekStart={new Date(2026, 5, 1)}
      />
    );

    const ledger = screen.getByLabelText("Week ledger");
    expect(within(ledger).getAllByRole("article")).toHaveLength(7);
    expect(container.querySelector("#task-today")).toHaveAttribute("open");
    expect(container.querySelector("#task-saturday")).not.toHaveAttribute("open");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/components/WeeklyPlan.test.tsx
```

Expected: FAIL because `WeeklyPlan` does not accept `today` or `weekStart` and does not render a Week Ledger.

- [ ] **Step 3: Create the Week Ledger component**

Create `components/WeekLedger.tsx`:

```tsx
import clsx from "clsx";
import { Clock3 } from "lucide-react";
import { buildWeekLedger, type WeekLedgerTask } from "@/src/presentation/weekLedger";

function statusClass(status: string) {
  if (status === "completed" || status === "over_completed") return "ledger-task ledger-task-positive";
  if (status === "partial" || status === "skipped") return "ledger-task ledger-task-warn";
  return "ledger-task";
}

export function WeekLedger({
  tasks,
  today,
  weekStart
}: {
  tasks: WeekLedgerTask[];
  today: Date;
  weekStart: Date;
}) {
  const days = buildWeekLedger(tasks, weekStart, today);

  return (
    <div className="week-ledger-scroll">
      <div className="week-ledger" aria-label="Week ledger">
        {days.map((day) => (
          <article className={clsx("ledger-day", day.isToday && "ledger-day-today")} key={day.dateKey}>
            <div className="ledger-day-heading">
              <span>{day.date.toLocaleDateString([], { weekday: "short" })}</span>
              <strong>{day.date.getDate()}</strong>
            </div>
            <div className="ledger-task-list">
              {day.tasks.length === 0 ? (
                <span className="ledger-rest">Rest / open</span>
              ) : (
                day.tasks.map((task) => (
                  <a className={statusClass(task.status)} href={`#task-${task.id}`} key={task.id}>
                    <strong>{task.title}</strong>
                    <span>
                      <Clock3 aria-hidden="true" size={12} /> {task.durationMinutes} min
                    </span>
                  </a>
                ))
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update WeeklyPlan to use disclosure-based task details**

Update `components/WeeklyPlan.tsx` so its task type includes `trainingType`, its props include `today` and `weekStart`, and its body follows this structure:

```tsx
import { WeekLedger } from "@/components/WeekLedger";
import { selectFocusedTaskId } from "@/src/presentation/weekLedger";

const focusedTaskId = selectFocusedTaskId(plan.trainingTasks, today);

return (
  <section className="training-journal">
    <div className="journal-heading">
      <div>
        <span className="eyebrow">Weekly rhythm</span>
        <h2>{plan.summary}</h2>
        <p className="page-subtitle">{plan.explanation}</p>
      </div>
    </div>

    <WeekLedger tasks={plan.trainingTasks} today={today} weekStart={weekStart} />

    <div className="training-details">
      {plan.trainingTasks.map((task) => (
        <details className="training-detail surface" id={`task-${task.id}`} key={task.id} open={task.id === focusedTaskId}>
          <summary className="training-detail-summary">
            <span>
              <strong>{task.title}</strong>
              <span className="task-meta">
                {task.date.toLocaleDateString()} · {task.durationMinutes} min · {task.intensity}
              </span>
            </span>
            <span className={taskStatusClass(task.status)}>{task.status.replace("_", " ")}</span>
          </summary>
          <Checklist taskId={task.id} items={task.checklistItems} activities={activities} readOnly={task.status !== "planned"} />
        </details>
      ))}
    </div>
  </section>
);
```

Keep the existing empty-plan message and `taskStatusClass` behavior.

- [ ] **Step 5: Run the focused tests**

Run:

```bash
npm test -- tests/presentation/weekLedger.test.ts tests/components/WeeklyPlan.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/WeekLedger.tsx components/WeeklyPlan.tsx tests/components/WeeklyPlan.test.tsx
git commit -m "feat: add week ledger plan view"
```

---

### Task 3: Add Route-Aware Top Navigation

**Files:**
- Create: `components/AppNavigation.tsx`
- Create: `tests/components/AppNavigation.test.tsx`
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Write the failing active-route navigation test**

Create `tests/components/AppNavigation.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppNavigation } from "@/components/AppNavigation";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

describe("AppNavigation", () => {
  beforeEach(() => usePathname.mockReturnValue("/profile"));

  it("marks the current route and leaves other links inactive", () => {
    render(<AppNavigation />);

    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Plan" })).not.toHaveAttribute("aria-current");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/components/AppNavigation.test.tsx
```

Expected: FAIL because `AppNavigation` does not exist.

- [ ] **Step 3: Implement AppNavigation**

Create `components/AppNavigation.tsx`:

```tsx
"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, CalendarDays, Target, UserRound } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";

const links = [
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/agent", label: "Agent", icon: Bot }
];

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="page app-nav" aria-label="Primary navigation">
      <Link className="brand" href="/plan">
        <span className="brand-mark"><Activity aria-hidden="true" size={17} /></span>
        <span>Healthy Body Manager</span>
      </Link>
      <div className="nav-links">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link aria-current={active ? "page" : undefined} className={clsx("nav-link", active && "nav-link-active")} href={href} key={href}>
              <Icon aria-hidden="true" size={16} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
      <LogoutButton />
    </nav>
  );
}
```

- [ ] **Step 4: Replace inline navigation in the dashboard layout**

Update `app/(dashboard)/layout.tsx` to retain the auth redirect and render:

```tsx
import { AppNavigation } from "@/components/AppNavigation";

return (
  <div className="app-shell">
    <header className="app-header">
      <AppNavigation />
    </header>
    {children}
  </div>
);
```

Remove the old `Link`, `Activity`, and `LogoutButton` imports.

- [ ] **Step 5: Run the navigation test**

Run:

```bash
npm test -- tests/components/AppNavigation.test.tsx
```

Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add components/AppNavigation.tsx app/\(dashboard\)/layout.tsx tests/components/AppNavigation.test.tsx
git commit -m "feat: add active dashboard navigation"
```

---

### Task 4: Enrich Plan Metrics and Page Composition

**Files:**
- Create: `tests/components/MetricCard.test.tsx`
- Modify: `components/MetricCard.tsx`
- Modify: `app/(dashboard)/plan/page.tsx`

- [ ] **Step 1: Write the failing MetricCard semantic-tone test**

Create `tests/components/MetricCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { HeartPulse } from "lucide-react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "@/components/MetricCard";

describe("MetricCard", () => {
  it("renders an icon and semantic tone class", () => {
    render(<MetricCard icon={HeartPulse} label="Recovery" value="82%" tone="sage" />);

    expect(screen.getByText("Recovery").closest("section")).toHaveClass("metric-card-sage");
    expect(screen.getByText("Recovery").closest("section")?.querySelector("svg")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/components/MetricCard.test.tsx
```

Expected: FAIL because `MetricCard` does not accept `icon` or `tone`.

- [ ] **Step 3: Extend MetricCard**

Replace `components/MetricCard.tsx` with:

```tsx
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "sage"
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "sage" | "blue" | "clay" | "neutral";
}) {
  return (
    <section className={clsx("surface metric-card", `metric-card-${tone}`)}>
      <div className="metric-card-heading">
        {Icon ? <Icon aria-hidden="true" size={16} /> : null}
        <span className="metric-label">{label}</span>
      </div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </section>
  );
}
```

- [ ] **Step 4: Update Plan page queries and composition**

In `app/(dashboard)/plan/page.tsx`:

1. Add `CalendarCheck2`, `Clock3`, `HeartPulse`, and `Moon` imports from `lucide-react`.
2. Extend the main `Promise.all` with:

```ts
prisma.goal.findFirst({
  where: { userId: user.id, status: "active" },
  orderBy: { priority: "desc" }
}),
prisma.sleepRecord.findFirst({ where: { userId: user.id }, orderBy: { date: "desc" } }),
prisma.recoveryRecord.findFirst({ where: { userId: user.id }, orderBy: { date: "desc" } })
```

3. Destructure those values as `primaryGoal`, `latestSleep`, and `latestRecovery`.
4. Replace the header title block with:

```tsx
<div>
  <span className="eyebrow">{weekStart.toLocaleDateString()} – {weekEnd.toLocaleDateString()}</span>
  <h1>{primaryGoal ? primaryGoal.title : "This week's rhythm"}</h1>
  <p className="page-subtitle">{plan?.summary ?? "Weekly training, recovery, nutrition, and calendar decisions."}</p>
</div>
```

5. Replace the metric section with four cards:

```tsx
<section className="grid metric-grid metric-grid-plan">
  <MetricCard icon={HeartPulse} label="Recovery" value={latestRecovery?.recoveryPercent ? `${latestRecovery.recoveryPercent}%` : "—"} hint="Latest readiness signal" tone="sage" />
  <MetricCard icon={Moon} label="Sleep" value={latestSleep ? `${(latestSleep.durationMinutes / 60).toFixed(1)}h` : "—"} hint="Latest sleep duration" tone="blue" />
  <MetricCard icon={Clock3} label="Planned volume" value={plan ? `${plannedMinutes} min` : "—"} hint={`${completedCount} sessions updated`} tone="clay" />
  <MetricCard icon={CalendarCheck2} label="Calendar" value={`${confirmedDrafts}/${drafts.length}`} hint="Confirmed training events" tone="neutral" />
</section>
```

6. Pass `today`, `weekStart`, and the existing plan data into `WeeklyPlan`.
7. Use `className="plan-content-grid"` for the training/support layout and `className="support-stack"` for Nutrition plus Calendar Drafts.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- tests/components/MetricCard.test.tsx tests/components/WeeklyPlan.test.tsx tests/presentation/weekLedger.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/MetricCard.tsx app/\(dashboard\)/plan/page.tsx tests/components/MetricCard.test.tsx
git commit -m "feat: enrich plan journal metrics"
```

---

### Task 5: Establish the Recovery Journal Visual Foundation

**Files:**
- Modify: `app/globals.css`
- Modify: `components/GeneratePlanButton.tsx`
- Modify: `components/SyncDemoDataButton.tsx`
- Modify: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Replace the root tokens and shared typography**

Update the beginning of `app/globals.css` with these tokens and shared rules:

```css
:root {
  color-scheme: light;
  --bg: #f4f6f3;
  --panel: #ffffff;
  --panel-soft: #fafbf9;
  --ink: #223129;
  --ink-strong: #17251e;
  --muted: #6d7b73;
  --line: #dde5df;
  --line-strong: #cbd8d0;
  --sage: #5f826e;
  --sage-strong: #426451;
  --sage-soft: #edf4ef;
  --blue: #6787a3;
  --blue-soft: #eef4f8;
  --clay: #a56f58;
  --clay-soft: #f8f0ec;
  --danger: #a14c4c;
  --danger-soft: #fbefef;
  --shadow: 0 10px 28px rgba(33, 49, 41, 0.06);
  --shadow-soft: 0 4px 14px rgba(33, 49, 41, 0.045);
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

h1,
.journal-title {
  color: var(--ink-strong);
  font-family: Georgia, "Times New Roman", serif;
  font-weight: 700;
  letter-spacing: 0;
}

.eyebrow {
  display: block;
  margin-bottom: 6px;
  color: var(--clay);
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.surface {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow-soft);
}
```

- [ ] **Step 2: Add shared navigation, metric, button, form, and message rules**

Define exact shared states in `app/globals.css`:

```css
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid rgba(221, 229, 223, 0.92);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(14px);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-link {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 6px;
  padding: 0 10px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
}

.nav-link:hover,
.nav-link-active {
  color: var(--sage-strong);
  background: var(--sage-soft);
}

.metric-card {
  min-height: 104px;
  border-top: 2px solid var(--line-strong);
  padding: 15px;
}

.metric-card-sage { border-top-color: var(--sage); }
.metric-card-blue { border-top-color: var(--blue); }
.metric-card-clay { border-top-color: var(--clay); }

.metric-card-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
}

.button {
  min-height: 40px;
  border: 1px solid var(--sage);
  border-radius: 6px;
  color: #fff;
  background: var(--sage);
}

.button:hover:not(:disabled) {
  border-color: var(--sage-strong);
  background: var(--sage-strong);
}

.button-secondary {
  border-color: var(--line-strong);
  color: var(--ink);
  background: var(--panel);
}

.button-secondary:hover:not(:disabled) {
  border-color: var(--sage);
  color: var(--sage-strong);
  background: var(--sage-soft);
}

input:focus,
select:focus,
textarea:focus,
button:focus-visible,
a:focus-visible,
summary:focus-visible {
  outline: 2px solid rgba(95, 130, 110, 0.38);
  outline-offset: 2px;
}
```

Keep all existing semantic states, but remap positive to sage, info to blue, warning to clay, and error to muted red.

- [ ] **Step 3: Remove inline action-stack styling**

In `components/GeneratePlanButton.tsx` and `components/SyncDemoDataButton.tsx`, replace:

```tsx
<div className="grid" style={{ gap: 6 }}>
```

with:

```tsx
<div className="action-stack">
```

Add:

```css
.action-stack {
  display: grid;
  gap: 6px;
}
```

Keep `ActionButton` behavior unchanged; only preserve its existing class composition.

- [ ] **Step 4: Rebuild Login with shared classes**

Replace inline style objects in `app/(auth)/login/page.tsx` with a `login-shell`, `login-card`, `login-brand`, and shared `field`/`button` markup. Import both `Activity` and `LogIn` from `lucide-react`, then replace the return value with:

```tsx
<main className="login-shell">
  <form className="surface login-card" onSubmit={submit}>
    <div className="login-brand">
      <span className="brand-mark"><Activity aria-hidden="true" size={18} /></span>
      <div>
        <span className="eyebrow">Personal recovery journal</span>
        <h1>Healthy Body Manager</h1>
        <p className="page-subtitle">Sign in to continue</p>
      </div>
    </div>

    <label className="field">
      Email
      <input
        autoComplete="email"
        name="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
    </label>

    <label className="field">
      Password
      <input
        autoComplete="current-password"
        name="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
    </label>

    {error ? <p className="message message-error" role="alert">{error}</p> : null}

    <button className="button login-submit" type="submit" disabled={isSubmitting}>
      <LogIn aria-hidden="true" size={18} />
      {isSubmitting ? "Signing in..." : "Sign in"}
    </button>
  </form>
</main>
```

Add stable responsive dimensions:

```css
.login-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-card {
  width: min(100%, 430px);
  display: grid;
  gap: 20px;
  padding: 28px;
}
```

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: all tests and the production build pass.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/\(auth\)/login/page.tsx components/GeneratePlanButton.tsx components/SyncDemoDataButton.tsx
git commit -m "style: establish recovery journal visual system"
```

---

### Task 6: Style the Week Ledger, Checklist, Nutrition, and Calendar Panels

**Files:**
- Modify: `app/globals.css`
- Modify: `components/Checklist.tsx`
- Modify: `components/NutritionPanel.tsx`
- Modify: `components/CalendarDraftList.tsx`

- [ ] **Step 1: Add Plan layout and Week Ledger CSS**

Add these layout rules to `app/globals.css`:

```css
.metric-grid-plan {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.plan-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(300px, 0.8fr);
  gap: 18px;
  align-items: start;
}

.support-stack,
.training-journal,
.training-details {
  display: grid;
  gap: 14px;
}

.week-ledger-scroll {
  overflow-x: auto;
  padding-bottom: 4px;
}

.week-ledger {
  min-width: 770px;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.ledger-day {
  min-height: 132px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px;
  background: var(--panel);
}

.ledger-day-today {
  border-color: var(--sage);
  background: var(--sage-soft);
}

.ledger-day-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
}

.ledger-day-heading strong {
  color: var(--ink-strong);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 18px;
}

.ledger-task-list {
  display: grid;
  gap: 7px;
}

.ledger-task {
  display: grid;
  gap: 4px;
  border-left: 2px solid var(--blue);
  padding-left: 7px;
  color: var(--ink);
  font-size: 12px;
}

.ledger-task span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
}

.ledger-task-positive { border-left-color: var(--sage); }
.ledger-task-warn { border-left-color: var(--clay); }
.ledger-rest { color: var(--muted); font-size: 12px; }
```

- [ ] **Step 2: Style disclosure-based training details and checklist rows**

Add:

```css
.training-detail {
  overflow: hidden;
}

.training-detail-summary {
  min-height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  cursor: pointer;
  list-style: none;
}

.training-detail-summary::-webkit-details-marker {
  display: none;
}

.training-detail[open] .training-detail-summary {
  border-bottom: 1px solid var(--line);
  background: var(--panel-soft);
}

.training-detail .checklist {
  margin: 0;
  padding: 14px 16px 16px;
}

.checklist-row {
  min-height: 40px;
  border-top: 1px solid #edf1ee;
}

.checklist-row input {
  accent-color: var(--sage);
}
```

Remove inline margin styling from task headings and completion-detail grids where a named class can express the same layout. Keep all completion behavior unchanged.

- [ ] **Step 3: Add semantic panel headings**

In `components/NutritionPanel.tsx`, add heading classes that distinguish recommended and caution sections:

```tsx
<h3 className="section-title section-title-positive">Recommended menu choices</h3>
<h3 className="section-title section-title-warn">Use caution</h3>
```

In `components/CalendarDraftList.tsx`, show a status label beside each title before the action:

```tsx
<span className={draft.status === "confirmed" ? "status status-positive" : draft.operation === "cancel" ? "status status-warn" : "status status-info"}>
  {draft.status === "confirmed" ? "Confirmed" : draft.operation === "cancel" ? "Cancellation" : "Draft"}
</span>
```

Keep the existing confirmation button logic intact.

- [ ] **Step 4: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: all tests and build pass.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css components/Checklist.tsx components/NutritionPanel.tsx components/CalendarDraftList.tsx
git commit -m "style: polish plan journal details"
```

---

### Task 7: Upgrade Profile, Goals, and Agent Pages

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx`
- Modify: `app/(dashboard)/goals/page.tsx`
- Modify: `app/(dashboard)/agent/page.tsx`
- Modify: `components/ProfileForm.tsx`
- Modify: `components/GoalForm.tsx`
- Modify: `components/AgentPanel.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Upgrade Profile metrics and form grouping**

In `app/(dashboard)/profile/page.tsx`:

- Import `Activity`, `HeartPulse`, and `Moon`.
- Add `eyebrow` text above the page title.
- Pass icons and tones to each `MetricCard`.

In `components/ProfileForm.tsx`, keep the current submit function and replace the return value with:

```tsx
<form className="surface panel profile-form" onSubmit={submit}>
  <fieldset className="form-section">
    <legend>Body measurements</legend>
    <div className="grid form-grid">
      <label className="field">
        Height (cm)
        <input name="heightCm" type="number" min="80" max="250" defaultValue={initialProfile?.heightCm} required />
      </label>
      <label className="field">
        Weight (kg)
        <input name="weightKg" type="number" min="25" max="300" step="0.1" defaultValue={initialProfile?.weightKg} required />
      </label>
      <label className="field">
        Body fat (%)
        <input name="bodyFatPercent" type="number" min="2" max="70" step="0.1" defaultValue={initialProfile?.bodyFatPercent} />
      </label>
      <label className="field">
        Resting heart rate
        <input name="restingHeartRateBpm" type="number" min="30" max="130" defaultValue={initialProfile?.restingHeartRateBpm} />
      </label>
    </div>
  </fieldset>
  <fieldset className="form-section">
    <legend>Training background</legend>
    <div className="grid form-grid">
      <label className="field">
        Sex
        <select name="sex" defaultValue={initialProfile?.sex ?? "male"}>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="field">
        Training experience
        <select name="trainingExperience" defaultValue={initialProfile?.trainingExperience ?? "intermediate"}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </label>
    </div>
  </fieldset>
  <fieldset className="form-section">
    <legend>Preferences and restrictions</legend>
    <div className="grid form-grid">
      <label className="field field-span">
        Injuries or restrictions
        <input name="injuries" defaultValue={initialProfile?.injuries.join(", ")} placeholder="left knee sensitivity, shoulder restriction" />
      </label>
      <label className="field field-span">
        Dietary preferences
        <input name="dietaryPreferences" defaultValue={initialProfile?.dietaryPreferences.join(", ")} placeholder="high protein, no dairy" />
      </label>
      <label className="field field-span">
        Training preferences
        <input name="trainingPreferences" defaultValue={initialProfile?.trainingPreferences.join(", ")} placeholder="morning runs, indoor strength" />
      </label>
    </div>
  </fieldset>
  <div className="toolbar">
    <ActionButton type="submit">
      <Save aria-hidden="true" size={16} /> Save profile
    </ActionButton>
    {message ? <span className={message === "Profile saved" ? "message" : "message message-error"}>{message}</span> : null}
  </div>
</form>
```

Add `profile-form` and `form-section` CSS with zero fieldset border, a clear legend, and 18px section gaps.

- [ ] **Step 2: Emphasize the primary goal**

In `app/(dashboard)/goals/page.tsx`:

- Add an eyebrow above the title.
- Add `goal-list` and `goal-row-primary` classes.
- Use the first ordered active goal as the visually emphasized primary goal.
- Keep every title, type, date, and priority visible.

In `components/GoalForm.tsx`, replace the generic `surface panel grid form-grid` class with `surface panel goal-form`, retaining the same fields and submit behavior.

Add CSS:

```css
.goal-row-primary {
  border-left: 3px solid var(--sage);
  padding-left: 12px;
  background: var(--sage-soft);
}

.goal-form,
.profile-form {
  display: grid;
  gap: 18px;
}
```

- [ ] **Step 3: Refine the Agent workspace**

In `app/(dashboard)/agent/page.tsx`, add an eyebrow above the title.

In `components/AgentPanel.tsx`:

- Add `chat-avatar` spans for assistant and user rows.
- Keep suggested prompts and send behavior unchanged.
- Keep the composer in the same framed tool.

Use:

```tsx
<div className={item.role === "user" ? "chat-row chat-row-user" : "chat-row"} key={item.id}>
  <span className="chat-avatar" aria-hidden="true">{item.role === "user" ? "You" : "AI"}</span>
  <div className={item.role === "user" ? "chat-bubble chat-bubble-user" : "chat-bubble"}>{item.content}</div>
</div>
```

Add CSS so assistant messages use a neutral surface, user messages use sage, avatars remain compact, and mobile rows do not overlap.

- [ ] **Step 4: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: all tests and build pass.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/profile/page.tsx app/\(dashboard\)/goals/page.tsx app/\(dashboard\)/agent/page.tsx components/ProfileForm.tsx components/GoalForm.tsx components/AgentPanel.tsx app/globals.css
git commit -m "style: refine journal support pages"
```

---

### Task 8: Complete Responsive Rules and Browser Verification

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add responsive rules**

At the end of `app/globals.css`, ensure these breakpoints exist:

```css
@media (max-width: 980px) {
  .metric-grid-plan {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .plan-content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .metric-grid,
  .two-column-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .app-nav {
    gap: 10px;
    overflow-x: auto;
  }

  .nav-links {
    min-width: max-content;
  }

  .page-header,
  .training-detail-summary,
  .list-row {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (max-width: 560px) {
  .page {
    padding: 16px;
  }

  .brand span:last-child {
    display: none;
  }

  .metric-grid-plan {
    grid-template-columns: 1fr;
  }

  .toolbar {
    width: 100%;
  }

  .toolbar .button {
    flex: 1;
  }

  .chat-row {
    align-items: flex-start;
  }
}
```

Keep the Week Ledger horizontally scrollable at every narrow width. Do not collapse its seven day columns into tiny tracks.

- [ ] **Step 2: Run the full automated verification**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all tests pass, build succeeds, and `git diff --check` prints no output.

- [ ] **Step 3: Start the development server**

Run:

```bash
npm run dev
```

Expected: Next.js reports a ready local URL. Use an alternate port if `3000` is occupied.

- [ ] **Step 4: Verify desktop pages in the in-app browser**

Open and inspect:

```text
/plan
/profile
/goals
/agent
/login
```

Verify:

- Plan shows the four-metric band, seven-day ledger, today's expanded task, Nutrition, and Calendar Drafts.
- Active navigation follows each route and uses `aria-current`.
- Profile form groups are clear and all existing values remain editable.
- The primary goal is visually emphasized without hiding secondary goals.
- Agent messages, prompt suggestions, and composer remain usable.
- Login uses the same Recovery Journal visual language.
- No text overlaps, cards nest incoherently, or controls shift layout unexpectedly.

- [ ] **Step 5: Verify mobile behavior**

Use a narrow mobile viewport and verify:

- Navigation remains usable at 320px width.
- Week Ledger scrolls horizontally with stable day widths.
- Plan support panels stack below training details.
- Forms collapse to one column.
- Buttons, labels, status pills, and long task titles do not overflow.

- [ ] **Step 6: Capture final screenshots**

Capture desktop and mobile screenshots of at least Plan and Profile for final comparison and review.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css
git commit -m "style: complete responsive journal polish"
```

---

### Task 9: Final Verification and Review

**Files:**
- No planned file changes

- [ ] **Step 1: Run final verification from a clean worktree**

Run:

```bash
npm test
npm run build
git diff --check
git status --short
```

Expected:

- All tests pass.
- Production build succeeds.
- `git diff --check` prints no output.
- `git status --short` prints no output.

- [ ] **Step 2: Request code review**

Use `superpowers:requesting-code-review` to review the completed redesign against:

```text
docs/superpowers/specs/2026-06-05-recovery-journal-ui-redesign-design.md
```

Address any blocking findings before declaring completion.
