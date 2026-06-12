# Chinese Model Providers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DeepSeek, MiniMax, Kimi/Moonshot, and GLM/Zhipu to the Settings model provider picker.

**Architecture:** Extend the settings provider union and provider defaults in `src/settings/defaults.ts`. Keep the existing OpenAI-compatible `/chat/completions` test path for the new China providers, while preserving Anthropic and Custom special handling.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library.

---

## File Structure

Modify:

```text
src/settings/defaults.ts
src/settings/service.ts
tests/settings/defaults.test.ts
tests/settings/service.test.ts
tests/components/SettingsForm.test.tsx
```

Responsibilities:

- `src/settings/defaults.ts`: provider labels, default model names, default base URLs, and provider API family metadata.
- `src/settings/service.ts`: route model test requests by provider API family.
- Tests: lock provider availability, save validation, request endpoint behavior, and UI dropdown rendering.

---

### Task 1: Add Provider Defaults

- [ ] **Step 1: Write failing defaults tests**

Add `tests/settings/defaults.test.ts` with assertions that `modelProviders` contains `deepseek`, `minimax`, `kimi`, and `glm`, each with a default model and base URL.

- [ ] **Step 2: Run failing defaults test**

Run `npm test -- tests/settings/defaults.test.ts`.
Expected: FAIL because the new providers are not present.

- [ ] **Step 3: Extend defaults**

Update `ModelProvider` and `modelProviders` in `src/settings/defaults.ts`.

- [ ] **Step 4: Run defaults test**

Run `npm test -- tests/settings/defaults.test.ts`.
Expected: PASS.

### Task 2: Keep OpenAI-Compatible Model Test Behavior

- [ ] **Step 1: Write failing service tests**

Extend `tests/settings/service.test.ts` so saving each new provider is accepted and `testUserSettings` posts to `{baseUrl}/chat/completions`.

- [ ] **Step 2: Run failing service tests**

Run `npm test -- tests/settings/service.test.ts`.
Expected: FAIL before implementation.

- [ ] **Step 3: Implement provider family routing**

Update `src/settings/service.ts` so only Anthropic and Custom use special branches; OpenAI-compatible providers share chat completions logic and get provider-specific success copy.

- [ ] **Step 4: Run service tests**

Run `npm test -- tests/settings/service.test.ts`.
Expected: PASS.

### Task 3: Verify Settings UI Picker

- [ ] **Step 1: Write failing UI test**

Extend `tests/components/SettingsForm.test.tsx` to assert the new provider names are in the Provider select.

- [ ] **Step 2: Run failing UI test**

Run `npm test -- tests/components/SettingsForm.test.tsx`.
Expected: FAIL before implementation if the UI does not render the new options.

- [ ] **Step 3: Run targeted and full verification**

Run:

```bash
npm test -- tests/settings/defaults.test.ts tests/settings/service.test.ts tests/components/SettingsForm.test.tsx
npm test
npm run build
```

Expected: all pass.
