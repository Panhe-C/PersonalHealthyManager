# Recovery Journal UI Redesign

## Summary

Healthy Body Manager will adopt a compact "Recovery Journal" visual language: personal and calm enough to invite daily use, but still efficient for repeated planning, tracking, and confirmation workflows.

The Plan page will receive the largest structural change through a "Week Ledger" layout. Profile, Goals, Agent, and Login will keep their existing workflows while receiving a consistent visual and information-hierarchy upgrade.

This redesign does not change APIs, Prisma models, provider integrations, training-plan generation logic, or completion behavior.

## Confirmed Direction

- Visual direction: Recovery Journal
- Plan-page layout: Week Ledger
- Information density: compact
- Scope: substantially restructure Plan; visually upgrade the other pages
- Navigation: retain the top navigation rather than introducing a sidebar

## Design Principles

1. Make the product feel like a personal body journal, not a generic admin form.
2. Keep important health and training information easy to scan in a few seconds.
3. Use visual hierarchy and semantic color to communicate status without relying on text alone.
4. Preserve efficient workflows for plan generation, checklist completion, nutrition review, and calendar confirmation.
5. Avoid marketing-page composition, decorative gradients, ornamental blobs, excessive cards, and oversized headings.
6. Keep card radii at 8px or less and use cards only for repeated items or genuinely framed tools.

## Visual System

### Color

The interface will use a light neutral foundation rather than a beige-dominant palette:

- Background: soft cool-warm off-white
- Surfaces: white
- Primary ink: deep green-charcoal
- Muted text and borders: gray-green neutrals
- Primary action and recovery status: sage green
- Sleep and informational status: muted blue
- Training load, caution, and event emphasis: restrained clay
- Error and destructive status: muted red

Color will be used sparingly and semantically. The design will not use gradients.

### Typography

- Page titles and selected editorial headings use a restrained serif stack to create the journal character.
- Navigation, metrics, body copy, form controls, buttons, and dense operational content use the existing system sans-serif stack.
- Headings remain compact and appropriate to their container.
- Letter spacing remains zero.

### Surfaces and Controls

- Borders become lighter and shadows become softer than the current implementation.
- Buttons, inputs, selects, textareas, status labels, messages, and empty states share one consistent visual language.
- Lucide icons identify navigation items, metrics, and actions where useful.
- Hover, focus-visible, disabled, loading, success, warning, and error states remain clear.
- Inputs stay comfortably sized without making forms visually heavy.

## Navigation and App Shell

The app keeps its sticky top navigation so the Plan page retains enough width for the weekly ledger.

The navigation will include:

- A refined Healthy Body Manager brand mark and wordmark
- Icon-and-label links for Plan, Profile, Goals, and Agent
- A clear active-page state based on the current route
- A compact sign-out icon button with an accessible label and tooltip

On smaller screens, navigation remains horizontally usable without overlapping or compressing labels.

## Plan Page: Week Ledger

### Information Order

The Plan page will be organized as:

1. Week context, active goal, and primary actions
2. Compact health and plan metric band
3. Seven-day Week Ledger
4. Training detail and checklist area
5. Nutrition and calendar-support panels

This order lets the user scan the whole week first, then act on today's session, then review supporting decisions.

### Header and Metric Band

The header shows the week date range and current plan summary. Sync and plan-generation actions remain available without dominating the page.

The metric band displays:

- Recovery
- Sleep
- Planned training volume
- Calendar confirmation status

Metrics use icons and semantic accents, but stay compact enough to fit comfortably above the ledger.

### Seven-Day Ledger

The Week Ledger displays one stable column for each day of the current week.

Each day shows:

- Day name and date
- Training title or rest state
- Duration
- Intensity
- Completion or adjustment status

Today's day is visually emphasized with a soft sage background and stronger border. Completed, skipped, partial, adjusted, and planned tasks receive distinct semantic styling.

If multiple training tasks occur on one day, the day column lists them without changing the column width. On mobile, the ledger becomes a horizontally scrollable region with stable column dimensions rather than collapsing into unreadable narrow columns.

### Training Detail and Checklist

The task for today is expanded by default. If there is no task today, the nearest upcoming task is expanded. If the week has no upcoming task, the most recent task is expanded.

Other tasks stay compact but can be expanded to view their checklist and completion details. Native disclosure behavior is preferred so the interaction remains simple and accessible.

Existing checklist behavior remains unchanged:

- Mark checklist items complete or skipped
- Record actual minutes, perceived effort, linked COROS activity, and notes
- Submit training feedback
- Display recorded and read-only states
- Reflect dynamically adjusted remaining-week plans after completion

### Supporting Panels

On desktop, Nutrition and Calendar Drafts form a compact supporting column beside the training-detail area. On mobile, they stack below the ledger and checklist.

Nutrition recommendations distinguish recommended choices from caution items using semantic accents rather than heavy framing.

Calendar drafts clearly distinguish create and cancellation operations, draft and confirmed states, and individual versus bulk confirmation actions.

## Profile Page

Profile retains its existing save workflow but is reorganized into more readable groups:

- Recent body and health signals
- Body measurements
- Training background
- Preferences and restrictions

The three recent-health metrics gain icons and semantic accents. The form remains compact, with full-width fields used only where longer input is expected.

## Goals Page

The active primary goal receives the strongest visual priority. Short-term event goals show target date and priority clearly, while longer-term and secondary goals remain easy to scan.

The Add Goal form stays alongside the active goal list on desktop and stacks below it on mobile. The page does not introduce new goal-management behavior.

## Agent Page

The Agent becomes a calm personal health-advisor workspace:

- Assistant and user messages use distinct but soft styling
- Suggested prompts are easy to scan and select
- The composer remains anchored at the bottom of the framed conversation tool
- Empty, sending, and error states remain clear

The redesign does not change agent routing or response behavior.

## Login Page

Login uses the same brand mark, typography, control styling, and color system as the authenticated app. It remains a focused sign-in screen rather than becoming a marketing landing page.

## Component and Architecture Impact

The redesign will build on the existing component structure.

Expected component changes include:

- Dashboard layout and a route-aware navigation component
- MetricCard
- WeeklyPlan and a Week Ledger presentation
- Checklist
- NutritionPanel
- CalendarDraftList
- ProfileForm
- GoalForm
- AgentPanel
- Login page

Shared layout, typography, semantic color, responsive behavior, and component states will be defined in `app/globals.css`. New abstractions should be introduced only where they remove meaningful duplication or clarify a component boundary.

## Data Flow

No server-side data flow changes are required.

- Plan continues to receive the existing plan, training tasks, checklist items, activities, nutrition targets, and calendar drafts.
- Week Ledger groups the existing `trainingTasks` by local calendar date for presentation only.
- The emphasized task is selected from the existing task dates using today's local date, then nearest upcoming date, then most recent date.
- Profile, Goals, and Agent continue to use their current API endpoints and persistence behavior.

## Error and Empty States

All existing error and empty states remain present and gain consistent visual treatment:

- Missing profile or schedule data before plan generation
- No plan generated
- No active goals
- No calendar drafts
- No nutrition recommendation
- Profile or goal save failure
- Training completion failure
- Agent empty and sending states

Messages use semantic icons, color, and text while preserving accessible contrast.

## Responsive Behavior

- Desktop Plan uses the full available content width without a sidebar.
- The Week Ledger remains a seven-column horizontal track and scrolls on narrow screens.
- Training detail, nutrition, and calendar sections stack cleanly on mobile.
- Forms collapse from two columns to one column.
- Buttons and text must not overflow, overlap, or resize surrounding layout unexpectedly.
- Navigation remains usable at the minimum supported width of 320px.

## Accessibility

- Active navigation is communicated visually and with `aria-current`.
- Icon-only buttons retain accessible names and tooltips.
- Status is never communicated by color alone.
- Focus-visible states are clear for links, buttons, fields, checkboxes, and disclosure controls.
- Native semantic elements are preferred for forms, lists, buttons, and expandable task details.

## Testing and Verification

Automated tests will cover new presentation behavior that has user-visible logic:

- Week Ledger groups and labels tasks correctly
- Today's task is emphasized and expanded by default
- Fallback emphasis selects the nearest upcoming task, then the most recent task
- Navigation applies the correct active route state

Existing service and API tests must continue to pass.

Final verification will include:

- `npm test`
- `npm run build`
- Browser review of Plan, Profile, Goals, Agent, and Login
- Desktop and mobile screenshots
- Checks for nonblank rendering, overflow, text overlap, responsive ledger behavior, active navigation, and existing interactive workflows

## Out of Scope

- API or database-schema changes
- New health metrics or provider integrations
- New goal-management actions
- Changes to training-plan generation or dynamic replanning logic
- Dark mode
- A marketing landing page
