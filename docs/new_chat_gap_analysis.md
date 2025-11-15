## New Chat Experience Gap Analysis

### 1. Address Input, Duplicate Detection, and Research History
- `app/(app)/page.tsx` only checks for duplicates inside `handleAddressSubmit` and shows a toast before redirecting to an existing conversation; there is no persistent inline hint below the input as described in `NEW_CHAT_EXP.md`, nor is the duplicate state surfaced until submit time (`app/(app)/page.tsx` `handleAddressSubmit` block).
- No code path persists the selection to `v2_research_history` when the user picks an address; the only insert happens later in the enrichment worker (`lib/workers/conversationEnrichment.ts`, `createLightweightConversation` just stores metadata in `v2_conversations`).
- Because enrichment is responsible for creating both the project and the research history row, duplicate detection cannot rely on the up-to-date history table the spec expects.

### 2. Conversation Creation, Breadcrumb, and Transition State
- `ConversationBreadcrumb` always renders "Untitled Project" (English) when `project` is null and immediately shows the conversation title; there is no transitional skeleton header nor the `"Projet Sans Nom > {Address}"` copy from `NEW_CHAT_EXP.md`.
- When a conversation has no stored messages, the UI injects the initial address message but also immediately renders `LoadingAssistantMessage`, which already carries text; the spec calls for an assistant avatar with no text during the transition layer.
- Duplicate redirects push directly to `/chat/{conversationId}` without verifying that it is the "last conversation for that project" mentioned in 2a.

### 3. Enrichment, RNU Branching, and Document Semantics
- `lib/workers/conversationEnrichment.ts` always launches both `zones` and `municipality` operations; even when `municipality.properties.is_rnu` is true, the worker still expects zone data and does not short-circuit to the RNU document path described in `NEW_CHAT_EXP.md`.
- The worker never records `is_rnu`, `has_analysis`, or the resolved `document_id` back onto `v2_conversations` or `v2_research_history`; those flags only live in the in-memory `result.documentData`.
- No code writes to `v2_conversation_documents` or `v2_project_documents`, so conversations are never formally linked to the documents fetched during enrichment.

### 4. Map & Document Artifacts plus Loading Copy
- `components/LoadingAssistantMessage.tsx` uses fixed copy for step 2 ("Récupération des documents sources...") and step 3 ("Récupération de l'analyse correspondante...") regardless of whether the municipality is RNU, whether an analysis exists, or whether only a source PLU link is available, diverging from the branching text in `NEW_CHAT_EXP.md`.
- `components/chat/artifacts/DocumentCard.tsx` and `components/DocumentViewer.tsx` only render HTML content; when no analysis exists they show a generic "Aucun document disponible" state instead of the "source PLU link" card the UX spec requires.

### 5. Final Assistant Message and Inline Cards
- `components/AnalysisFoundMessage.tsx` hardcodes the assistant copy to `"Voici l'analyse concernant la zone {zoneName}"`, so there is no "Voici le RNU" or "Nous n'avons pas encore couvert cette zone..." variant.
- `app/(app)/chat/[conversation_id]/page.tsx` only fades out the loading message and shows the final assistant bubble when `documentData.htmlContent` exists; conversations that only produce source links or RNU content never reach the final message step.

### 6. Chat Enablement and Webhook Integration
- The chat input (`PromptInputBox` usage in `app/(app)/chat/[conversation_id]/page.tsx`) is always enabled unless a message is actively sending; there is no logic to disable it when only a source document exists, nor is the tooltip `"Impossible de discuter avec ce document."` implemented.
- `/api/chat` defaults to `https://n8n.automationdfy.com/webhook/api/chat` and only forwards `document_ids` arrays when present in `v2_research_history`; it never sends the exact `document_id` that powered the analysis, and the payload format differs from the spec.

### 7. Persistence Gaps
- The enrichment worker updates `v2_research_history` with `city_id`/`zone_id` but never back-fills `documents_found` with the new document UUIDs, so subsequent chat messages cannot reliably resolve the document to cite.
- Neither `v2_conversation_documents` nor `v2_project_documents` receives inserts anywhere in the codebase, so the artifacts shown in the UI have no durable linkage in the database despite the requirements in `NEW_CHAT_EXP.md`.


