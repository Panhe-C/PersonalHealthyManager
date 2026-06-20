# COROS Settings Region Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the COROS Settings card visibly support the official COROS remote MCP URLs by region.

**Architecture:** Add a tiny typed region mapping in Settings defaults, persist optional COROS-specific metadata in the existing `dataMcpConnectionsJson`, and render a COROS connection assistant in `SettingsForm`. This is the first visible layer of the larger remote MCP integration; it does not yet implement the full MCP tool transport.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library.

---

### Task 1: Add COROS Region Metadata

**Files:**
- Modify: `src/settings/defaults.ts`
- Modify: `src/settings/service.ts`
- Test: `tests/settings/service.test.ts`

- [x] **Step 1: Write failing tests**

Add tests proving that a COROS connection can save and return `corosRegion` and that malformed `loginUrl` is rejected while a valid one is preserved.

- [x] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/settings/service.test.ts`

Expected: FAIL because `DataMcpConnection` does not yet normalize `corosRegion` or `loginUrl`.

- [x] **Step 3: Implement metadata normalization**

Add `CorosMcpRegion`, `corosMcpRegionOptions`, and `corosMcpUrlByRegion`. Normalize `corosRegion` only for the COROS connection and preserve a valid optional `loginUrl`.

- [x] **Step 4: Run service tests**

Run: `npm test -- tests/settings/service.test.ts`

Expected: PASS.

### Task 2: Render COROS Connection Assistant

**Files:**
- Modify: `components/SettingsForm.tsx`
- Test: `tests/components/SettingsForm.test.tsx`

- [x] **Step 1: Write failing component tests**

Add tests for rendering the COROS region selector and for changing Europe to auto-fill `https://mcpeu.coros.com/mcp`.

- [x] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/components/SettingsForm.test.tsx`

Expected: FAIL because the region selector is not rendered.

- [x] **Step 3: Implement the assistant UI**

Render a COROS-only block inside the card with a region select, URL preview, and guidance copy. On region change, update `corosRegion`, `endpoint`, `serverName`, and `capabilityName`.

- [x] **Step 4: Run component tests**

Run: `npm test -- tests/components/SettingsForm.test.tsx`

Expected: PASS.

### Task 3: Verify Browser Visibility

**Files:**
- No source files beyond Tasks 1-2.

- [x] **Step 1: Run focused tests**

Run: `npm test -- tests/settings/service.test.ts tests/components/SettingsForm.test.tsx`

Expected: PASS.

- [x] **Step 2: Verify `/settings` in browser**

Reload `http://127.0.0.1:3001/settings` and confirm the COROS card shows the region selector and official MCP URL choices.
