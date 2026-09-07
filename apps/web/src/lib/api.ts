/**
 * API client.
 *
 * Every mutating call carries a request id and, where the command is retryable, an
 * idempotency key generated once and reused across attempts (§1). A failed send does
 * not generate a new key, because that is precisely what turns one kit issue into two.
 */
import type { ApiErrorBody, CommandResult } from '@khel/contracts';
import { enqueueCommand, quarantineDraft } from './offline.js';

export class ApiError extends Error {
  readonly body: ApiErrorBody;
  readonly status: number;
  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
  /** True when retrying unchanged cannot succeed. */
  get isTerminal(): boolean {
    return ['OUT_OF_SCOPE', 'INVALID_STATE', 'RULES_NOT_APPROVED',
            'IDEMPOTENCY_PAYLOAD_MISMATCH'].includes(this.body.code);
  }
}

export interface ClientContext {
  eventId: string;
  userId: string;
  locale: string;
}

const uuid = () => crypto.randomUUID();

async function request<T>(
  path: string, init: RequestInit, ctx: ClientContext,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'accept-language': ctx.locale,
      // Development identity. A production build replaces this with the session
      // cookie issued by the identity provider (§3).
      'x-user-id': ctx.userId,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new ApiError(response.status, body as ApiErrorBody);
  return body as T;
}

export function get<T>(path: string, ctx: ClientContext): Promise<T> {
  return request<T>(`/api/v1/events/${ctx.eventId}${path}`, { method: 'GET' }, ctx);
}

export interface CommandOptions {
  /** Provide for retryable commands. Generated once by the caller and reused. */
  idempotencyKey?: string;
  /** When offline, queue instead of failing. Only for commands safe to replay. */
  queueWhenOffline?: boolean;
  /** Used to quarantine the right draft if the server has moved on. */
  fixtureId?: string;
}

export async function command<TData>(
  path: string, body: Record<string, unknown>, ctx: ClientContext,
  options: CommandOptions = {},
): Promise<CommandResult<TData>> {
  const idempotencyKey = options.idempotencyKey ?? uuid();
  const fullPath = `/api/v1/events/${ctx.eventId}${path}`;

  if (!navigator.onLine && options.queueWhenOffline) {
    await enqueueCommand({
      id: uuid(), event_id: ctx.eventId, user_id: ctx.userId,
      command: path, path: fullPath, body, idempotency_key: idempotencyKey,
    });
    throw new ApiError(0, {
      code: 'VALIDATION_FAILED',
      message: 'You are offline. This action is queued and will be sent when you reconnect.',
      request_id: 'offline',
      next_action: 'Stay signed in and reopen the app when you have a connection.',
    });
  }

  try {
    return await request<CommandResult<TData>>(fullPath, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'idempotency-key': idempotencyKey, 'x-request-id': uuid() },
    }, ctx);
  } catch (error) {
    // §10: the server having moved on is not a retryable failure. Quarantine the
    // local draft and let a person decide, rather than overwriting a submitted result.
    if (error instanceof ApiError && options.fixtureId) {
      if (error.body.code === 'INVALID_STATE' || error.body.code === 'VERSION_CONFLICT') {
        await quarantineDraft(ctx.eventId, options.fixtureId, error.body.message);
      }
    }
    throw error;
  }
}
