/**
 * Offline draft cache.
 *
 * §10: "Autosave displays locally saved and server saved separately. Local drafts
 * belong to the authenticated user and event; minimise stored personal data and
 * expire/clear caches on logout according to policy. Offline commands revalidate
 * assignment, revision and workflow on reconnect. If someone else submitted, approved
 * or locked the result, quarantine the stale local draft for review; never overwrite
 * the server."
 *
 * §14 / source S12: "Web background sync is not universally available; reopen/manual
 * retry must work." So there is no reliance on the Background Synchronization API —
 * sync runs when the app is open and the user can always retry by hand.
 *
 * What is deliberately NOT cached: athlete dates of birth, guardian contacts and any
 * document. A venue phone is not worth a lost handset.
 */
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'khel-sanand';
const DB_VERSION = 1;
const DRAFTS = 'drafts';
const QUEUE = 'queue';

export type DraftSyncState =
  | 'LocalOnly'      // saved on this device, not yet sent
  | 'Syncing'
  | 'Synced'         // the server holds this revision
  | 'Quarantined';   // the server moved on; needs human review before anything is sent

export interface LocalDraft {
  /** `${event_id}:${fixture_id}` — one editable draft per fixture per event. */
  key: string;
  event_id: string;
  fixture_id: string;
  /** Owning user. A draft never leaks between accounts on a shared device. */
  user_id: string;
  revision_id: string | null;
  /** Version the client last saw. Used to detect that the server moved on. */
  expected_version: number | null;
  raw_payload: Record<string, unknown>;
  calculated_result: Record<string, unknown>;
  saved_locally_at: string;
  saved_on_server_at: string | null;
  sync_state: DraftSyncState;
  /** Set when quarantined: what the server said had happened instead. */
  quarantine_reason?: string;
}

export interface QueuedCommand {
  id: string;
  event_id: string;
  user_id: string;
  command: string;
  path: string;
  body: Record<string, unknown>;
  /** §1: the key makes a retry safe. Generated once, reused for every attempt. */
  idempotency_key: string;
  queued_at: string;
  attempts: number;
  last_error?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(DRAFTS)) {
        database.createObjectStore(DRAFTS, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(QUEUE)) {
        const store = database.createObjectStore(QUEUE, { keyPath: 'id' });
        store.createIndex('by_queued_at', 'queued_at');
      }
    },
  });
  return dbPromise;
}

export const draftKey = (eventId: string, fixtureId: string) => `${eventId}:${fixtureId}`;

export async function saveLocalDraft(draft: Omit<LocalDraft, 'key' | 'saved_locally_at'>): Promise<LocalDraft> {
  const record: LocalDraft = {
    ...draft,
    key: draftKey(draft.event_id, draft.fixture_id),
    saved_locally_at: new Date().toISOString(),
  };
  await (await db()).put(DRAFTS, record);
  return record;
}

export async function readLocalDraft(
  eventId: string, fixtureId: string, userId: string,
): Promise<LocalDraft | undefined> {
  const record = await (await db()).get(DRAFTS, draftKey(eventId, fixtureId)) as LocalDraft | undefined;
  // A draft belongs to one authenticated user. Another user on the same handset
  // must never see it (§10).
  if (record && record.user_id !== userId) return undefined;
  return record;
}

export async function listLocalDrafts(userId: string): Promise<LocalDraft[]> {
  const all = await (await db()).getAll(DRAFTS) as LocalDraft[];
  return all.filter((d) => d.user_id === userId);
}

export async function deleteLocalDraft(eventId: string, fixtureId: string): Promise<void> {
  await (await db()).delete(DRAFTS, draftKey(eventId, fixtureId));
}

/**
 * §10: "expire/clear caches on logout according to policy."
 * Called on sign-out and on an explicit "forget this device" action.
 */
export async function clearAllLocalData(): Promise<void> {
  const database = await db();
  await database.clear(DRAFTS);
  await database.clear(QUEUE);
}

/* ------------------------------------------------------------------ *
 * Command queue
 * ------------------------------------------------------------------ */

export async function enqueueCommand(cmd: Omit<QueuedCommand, 'queued_at' | 'attempts'>): Promise<void> {
  await (await db()).put(QUEUE, { ...cmd, queued_at: new Date().toISOString(), attempts: 0 });
}

export async function listQueue(userId: string): Promise<QueuedCommand[]> {
  const all = await (await db()).getAll(QUEUE) as QueuedCommand[];
  return all
    .filter((c) => c.user_id === userId)
    .sort((a, b) => a.queued_at.localeCompare(b.queued_at));
}

export async function dequeue(id: string): Promise<void> {
  await (await db()).delete(QUEUE, id);
}

export async function markQueueFailure(id: string, error: string): Promise<void> {
  const database = await db();
  const existing = await database.get(QUEUE, id) as QueuedCommand | undefined;
  if (!existing) return;
  await database.put(QUEUE, { ...existing, attempts: existing.attempts + 1, last_error: error });
}

/**
 * Quarantine a local draft rather than sending it.
 *
 * §10: "If someone else submitted, approved or locked the result, quarantine the
 * stale local draft for review; never overwrite the server." Quarantine is not an
 * error state to clear automatically — a human decides what the real result is.
 */
export async function quarantineDraft(
  eventId: string, fixtureId: string, reason: string,
): Promise<void> {
  const database = await db();
  const key = draftKey(eventId, fixtureId);
  const existing = await database.get(DRAFTS, key) as LocalDraft | undefined;
  if (!existing) return;
  await database.put(DRAFTS, { ...existing, sync_state: 'Quarantined', quarantine_reason: reason });
}

/** Connection state for the header (§1: "Show … connection state and last refresh time"). */
export function watchConnection(onChange: (online: boolean) => void): () => void {
  const update = () => onChange(navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}
