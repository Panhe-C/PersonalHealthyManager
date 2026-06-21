# Agent Conversations And Context Design

## Goal

Upgrade the Agent page from one global chat stream into a multi-conversation assistant that can keep each user conversation isolated and answer with relevant app data.

The Agent should:

- Let the user create and switch between separate chat conversations.
- Scope message history by conversation, not by the whole user account.
- Detect what kind of health/product question the user is asking.
- Read relevant local app data before answering.
- Trigger a live COROS sync only when the user explicitly asks for latest or newly synced data.

## Scope

In scope:

- Add durable Agent conversation records.
- Link every Agent message to one conversation.
- Add a ChatGPT-style conversation list and `New chat` action on `/agent`.
- Update `/api/agent` so requests include a `conversationId`.
- Keep model dispatch through the existing Settings-configured runtime.
- Build a server-side Agent context builder that loads relevant local data by intent.
- Reuse the existing `syncCorosFromSettings(userId)` path when the user explicitly requests fresh COROS data.
- Preserve the existing rule fallback when the model is not configured or fails.

Out of scope:

- Voice input.
- Streaming responses.
- Conversation sharing.
- Automatic deletion or archival.
- Full tool-calling orchestration.
- Automatic calendar writes without confirmation.
- Running live COROS sync on every message.

## User Experience

The `/agent` page becomes a two-column workspace:

- A conversation rail with `New chat`, recent conversation titles, and timestamps.
- A main chat window for the selected conversation.

When the user opens `/agent`:

1. The server loads the user's recent conversations.
2. If a conversation exists, the newest conversation is selected.
3. If no conversation exists, the app creates an initial empty conversation.
4. The selected conversation's messages render in the chat window.

When the user clicks `New chat`:

1. The client calls a create-conversation API.
2. The server creates an empty conversation scoped to the current user.
3. The UI switches to the new conversation.
4. Messages sent after that point use the new `conversationId`.

Conversation titles should be generated conservatively:

- Empty conversations show `New conversation`.
- After the first user message, the title becomes a compact version of that message.
- Titles can be truncated in the UI; manual rename is not required for this version.

## Data Model

Add a new `AgentConversation` model:

```prisma
model AgentConversation {
  id        String   @id @default(cuid())
  userId    String
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages AgentMessage[]

  @@index([userId, updatedAt])
  @@unique([id, userId])
}
```

Update `User`:

```prisma
agentConversations AgentConversation[]
```

Update `AgentMessage`:

```prisma
conversationId String
conversation   AgentConversation @relation(fields: [conversationId, userId], references: [id, userId], onDelete: Cascade)

@@index([conversationId, createdAt])
```

Existing messages can be migrated into one default conversation per user. In this prototype, the migration can create a default title such as `Previous conversation`.

## API Design

### `GET /api/agent/conversations`

Returns the current user's conversations in newest-first order:

```ts
type AgentConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};
```

### `POST /api/agent/conversations`

Creates an empty conversation:

```ts
type CreateConversationResponse = {
  id: string;
  title: string;
  updatedAt: string;
  messages: [];
};
```

### `GET /api/agent/conversations/[id]`

Returns one conversation and its messages. The route must require both `id` and `userId`, so a user cannot load another user's conversation.

### `POST /api/agent`

Request:

```ts
type AgentRequest = {
  conversationId: string;
  message: string;
};
```

Behavior:

1. Validate `message` and `conversationId`.
2. Confirm the conversation belongs to the current user.
3. Load recent history only from that conversation.
4. Build intent-aware context for the current message.
5. Call `createAgentResponseForUser(userId, message, history, context)`.
6. Persist the user and assistant messages under the same conversation.
7. Update the conversation title when this is the first user message.
8. Return the assistant response plus conversation metadata.

## Intent And Context

Keep the existing intent names and add context loading behind them:

- `recovery_check`: recent sleep, recovery, activity records, body profile, active goals.
- `calendar_confirmation`: latest plan, training tasks, calendar drafts, recent calendar snapshot.
- `menu_advice`: latest plan nutrition targets, menu recommendations, active goals, planned training intensity.
- `replan`: body profile, active goals, recent activities, sleep, recovery, latest calendar snapshot, latest plan/tasks.
- `general`: lightweight body profile, goals, latest plan summary, newest sync timestamps.

The context builder should return concise text blocks, not raw database records:

```ts
type AgentContext = {
  intent: AgentIntent;
  freshSync: {
    attempted: boolean;
    succeeded: boolean;
    error?: string;
  };
  sections: Array<{
    title: string;
    content: string;
  }>;
};
```

The model prompt should include these context sections and instruct the model to avoid inventing unavailable data. If a section is empty, the prompt should state that the app has no synced data for that category.

## Live COROS Sync Policy

Use a hybrid policy:

- Default: answer from local synced database records.
- Live sync: call `syncCorosFromSettings(userId)` only when the user explicitly asks for fresh data.

Fresh-data triggers include phrases such as:

- `最新`
- `同步`
- `拉取`
- `刚刚`
- `现在的数据`
- `latest`
- `sync`
- `refresh`
- `pull latest`

After live sync:

- If sync succeeds, rebuild context from the updated local database and tell the model the data was just refreshed.
- If sync fails, still answer from existing local data and include the sync error in the response metadata and fallback guidance.

The Agent must not automatically sync COROS on every health-related question. That keeps chat latency predictable and avoids surprising OAuth or MCP errors.

## Model Prompting

The existing Settings-configured model runtime remains the only model path.

`systemPrompt` should be expanded with:

- Conversation-scoped history only.
- Intent label.
- Context sections.
- Fresh-sync status.
- Confirmation-before-write rule for calendar operations.
- Safety language for health advice.

The prompt must say:

- The Agent can explain and suggest.
- The Agent cannot claim to have written calendar events unless a confirmed calendar API result is provided.
- The Agent cannot claim latest COROS data unless a live sync succeeded during this request.
- The Agent should answer in the user's language.

## Error Handling

User-facing behavior:

- Missing message: return `400 Message is required`.
- Missing conversation ID: return `400 Conversation is required`.
- Unknown or unauthorized conversation: return `404 Conversation not found`.
- Model failure: keep the current fallback behavior and expose the provider error.
- COROS sync failure: return an assistant answer using existing data and include the sync failure in metadata.

Empty data should not be treated as an exception. The Agent should say what is missing and suggest the next action, such as syncing COROS or generating a plan.

## Testing

Add or update service tests for:

- Intent routing still works.
- Context builder loads recovery data for sleep/recovery questions.
- Context builder loads plan and calendar draft data for calendar questions.
- Explicit fresh-data phrases call `syncCorosFromSettings(userId)`.
- Normal recovery questions do not call live sync.
- Sync failures are included in context metadata and do not prevent an answer.

Add or update API tests for:

- `POST /api/agent` rejects missing `conversationId`.
- `POST /api/agent` rejects another user's conversation.
- `POST /api/agent` reads history only from the requested conversation.
- First user message updates the conversation title.
- Messages are persisted with `conversationId`.

Add or update component tests for:

- The Agent page renders conversation summaries.
- `New chat` creates and selects a new conversation.
- Sending a message posts the selected `conversationId`.
- Switching conversations swaps the rendered messages.

## Acceptance Criteria

- `/agent` supports multiple durable conversations for the current user.
- A user can create a new conversation and switch between conversations without mixing histories.
- `POST /api/agent` requires and validates `conversationId`.
- Agent responses include relevant local app context for recovery, calendar, menu, replanning, and general questions.
- Live COROS sync runs only when the user explicitly asks for fresh data.
- COROS sync failures do not break chat; the Agent falls back to existing local data and shows a useful explanation.
- The configured model runtime remains the primary model path, with rule fallback preserved.
