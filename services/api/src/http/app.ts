/**
 * HTTP surface.
 *
 * §14 API conventions:
 *   - operational paths are scoped under /api/v1/events/{eventId};
 *   - POST commands describe meaningful actions (/scorecards/{id}/submit),
 *     PATCH is for ordinary editable fields;
 *   - "Avoid a generic status PATCH that bypasses workflow checks";
 *   - commands carry request_id, idempotency_key and expected_version.
 *
 * Authorisation is NOT done here. Every handler delegates to the module functions,
 * which call assertAccess themselves — §1 requires the same policy to hold for
 * background jobs and exports, and a route guard alone cannot deliver that.
 */
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { DomainError, type ActorContext } from '@khel/contracts';
import { resolveActor, describeEffectiveAccess } from '../core/actor.js';
import { translatePrismaError } from '../core/prisma-errors.js';
import { runCommand } from '../core/command.js';
import * as m03 from '../modules/m03-assignments.js';
import * as m07 from '../modules/m07-attendance.js';
import * as m08 from '../modules/m08-kits.js';
import * as m09 from '../modules/m09-scorecards.js';

declare module 'fastify' {
  interface FastifyRequest {
    actor?: ActorContext;
    requestId: string;
  }
}

export interface BuildOptions {
  prisma?: PrismaClient;
  logger?: boolean;
}

export function buildApp(options: BuildOptions = {}): FastifyInstance {
  const prisma = options.prisma ?? new PrismaClient();
  const app = Fastify({
    logger: options.logger ?? true,
    // §14: log safe request ids; never OTPs, passwords or athlete documents.
    genReqId: () => randomUUID(),
    disableRequestLogging: false,
  });

  app.register(helmet, { contentSecurityPolicy: false });
  app.register(cors, { origin: true, credentials: true });
  // §14 non-functional: bound abusive traffic without throttling event-day operations.
  app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  /* ---------------------------------------------------------------- *
   * Error serialisation
   *
   * A DomainError already carries its code, remedy and safe details. Anything
   * else becomes a generic 500 — an unexpected failure must not leak a record's
   * name, counts or attachments (AT-029).
   * ---------------------------------------------------------------- */
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id as string;
    if (error instanceof DomainError) {
      request.log.info({ code: error.code, requestId }, 'domain error');
      return reply.status(error.httpStatus).send(error.toBody(requestId));
    }
    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.status(429).send({
        code: 'RATE_LIMITED', message: 'Too many requests.', request_id: requestId,
      });
    }
    // A constraint violation usually means a race the module could not observe.
    // Surface it as the named business error §1 asks for, with a remedy.
    const translated = translatePrismaError(error);
    if (translated) {
      request.log.warn({ code: translated.code, requestId }, 'constraint violation translated');
      return reply.status(translated.httpStatus).send(translated.toBody(requestId));
    }

    request.log.error({ err: error, requestId }, 'unhandled error');
    return reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: 'The request could not be completed.',
      request_id: requestId,
    });
  });

  /* ---------------------------------------------------------------- *
   * Actor resolution
   *
   * Development uses an x-user-id header. A production deployment replaces this
   * with the identity provider's verified subject — §3 requires provider-enforced
   * expiry and rate limits, which this stub deliberately does not simulate.
   * ---------------------------------------------------------------- */
  async function actorFrom(request: FastifyRequest): Promise<ActorContext> {
    const eventId = (request.params as { eventId?: string }).eventId;
    const userId = request.headers['x-user-id'];
    if (!eventId || typeof userId !== 'string') {
      throw new DomainError('OUT_OF_SCOPE', 'Missing identity or event context.');
    }
    return resolveActor({
      prisma, user_id: userId, event_id: eventId, request_id: request.id as string,
      locale: (request.headers['accept-language'] as string | undefined)?.slice(0, 2),
    });
  }

  /** Wrap a module function as a command endpoint. */
  function command<TPayload, TData>(
    name: string,
    handler: (ctx: Parameters<typeof m03.assignSchoolsToCH>[0], payload: TPayload) => Promise<TData>,
  ) {
    return async (request: FastifyRequest, reply: { send: (b: unknown) => unknown }) => {
      const actor = await actorFrom(request);
      const body = request.body as Record<string, unknown>;
      const idempotencyKey =
        (request.headers['idempotency-key'] as string | undefined) ??
        (body?.['idempotency_key'] as string | undefined);

      const result = await runCommand<TPayload, TData>({
        prisma, actor, command: name,
        payload: body as TPayload,
        ...(idempotencyKey ? { idempotencyKey } : {}),
        handler: async (ctx, payload) => ({ data: await handler(ctx, payload) }),
      });
      return reply.send(result);
    };
  }

  /* ---------------------------------------------------------------- *
   * Health and readiness
   * §13 Operations view: availability without credentials or secret values.
   * ---------------------------------------------------------------- */
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'reachable' };
    } catch {
      return reply.status(503).send({ status: 'degraded', database: 'unreachable' });
    }
  });

  /* ---------------------------------------------------------------- *
   * Demo sign-in list.
   *
   * DEMONSTRATION ONLY, and deliberately narrow: it returns the seeded users of the
   * demo event so the web app can be explored without an identity provider. It is
   * refused outside development, because §3 requires provider-enforced expiry, retry
   * limits and generic errors that avoid account discovery — none of which a list
   * endpoint can provide.
   * ---------------------------------------------------------------- */
  app.get('/api/v1/demo/users', async (_request, reply) => {
    if (process.env['NODE_ENV'] === 'production') {
      return reply.status(404).send({ code: 'OUT_OF_SCOPE', message: 'Not found.',
                                      request_id: 'n/a' });
    }
    const memberships = await prisma.eventMembership.findMany({
      where: { status: 'Active', user: { active: true } },
      include: { user: true, event: true },
      orderBy: [{ role: 'asc' }, { created_at: 'asc' }],
      take: 25,
    });
    return memberships.map((m) => ({
      user_id: m.user_id,
      user_code: m.user.user_code,
      display_name: m.user.display_name,
      role: m.role,
      event_id: m.event_id,
      event_code: m.event.event_code,
    }));
  });

  const base = '/api/v1/events/:eventId';

  /* ---------------------------------------------------------------- *
   * M02 — access preview (§3 support view; read-only, no impersonation)
   * ---------------------------------------------------------------- */
  app.get(`${base}/access/preview`, async (request) => {
    const actor = await actorFrom(request);
    return describeEffectiveAccess(actor);
  });

  /* ---------------------------------------------------------------- *
   * M03 — assignments
   * ---------------------------------------------------------------- */
  app.post(`${base}/commands/assignSchoolsToCH`,
    command('assignSchoolsToCH', (ctx, p: m03.AssignSchoolsPayload) => m03.assignSchoolsToCH(ctx, p)));

  app.post(`${base}/commands/assignVolunteerPool`,
    command('assignVolunteerPool', (ctx, p: m03.AssignPoolPayload) => m03.assignVolunteerPool(ctx, p)));

  app.post(`${base}/fixtures/:fixtureId/duties`,
    command('assignFixtureDuty', (ctx, p: m03.FixtureDutyPayload) => m03.assignFixtureDuty(ctx, p)));

  app.post(`${base}/queries/calculateWorkload`,
    command('calculateWorkload',
      (ctx, p: { membership_ids: string[]; from: string; to: string }) =>
        m03.calculateWorkload(ctx, p)));

  /* ---------------------------------------------------------------- *
   * M07 — attendance
   * ---------------------------------------------------------------- */
  app.post(`${base}/attendance/check-in`,
    command('selfCheckIn', (ctx, p: m07.SelfCheckInPayload) => m07.selfCheckIn(ctx, p)));

  app.post(`${base}/attendance/offline-claim`,
    command('submitOfflineAttendanceClaim',
      (ctx, p: { session_id: string; claimed_client_at: string }) =>
        m07.submitOfflineAttendanceClaim(ctx, p)));

  app.post(`${base}/attendance/:attendanceId/correct`,
    command('correctAttendance',
      (ctx, p: Parameters<typeof m07.correctAttendance>[1]) => m07.correctAttendance(ctx, p)));

  app.post(`${base}/duty-sessions/:sessionId/close`,
    command('closeDutySession',
      (ctx, p: { session_id: string; unmarked_becomes: 'Missing' | 'Absent' }) =>
        m07.closeDutySession(ctx, p)));

  app.post(`${base}/queries/calculateAttendance`,
    command('calculateAttendance',
      (ctx, p: { from: string; to: string; cluster_id?: string | null }) =>
        m07.calculateAttendance(ctx, p)));

  /* ---------------------------------------------------------------- *
   * M08 — kits
   * ---------------------------------------------------------------- */
  app.post(`${base}/kits/issue`,
    command('issueKitItem', (ctx, p: m08.IssueKitPayload) => m08.issueKitItem(ctx, p)));

  app.post(`${base}/kits/:issueId/acknowledge`,
    command('acknowledgeKit', (ctx, p: { issue_id: string }) => m08.acknowledgeKit(ctx, p)));

  app.post(`${base}/stock/receive`,
    command('receiveStock',
      (ctx, p: Parameters<typeof m08.receiveStock>[1]) => m08.receiveStock(ctx, p)));

  app.post(`${base}/stock/adjust`,
    command('adjustStock',
      (ctx, p: Parameters<typeof m08.adjustStock>[1]) => m08.adjustStock(ctx, p)));

  app.post(`${base}/queries/getKitStatus`,
    command('getKitStatus',
      (ctx, p: { volunteer_ids?: string[]; cluster_id?: string | null }) =>
        m08.getKitStatus(ctx, p)));

  /* ---------------------------------------------------------------- *
   * M09 — scorecards
   *
   * Note the shape: each workflow transition is its own action endpoint, so a
   * client cannot PATCH a status past its gate (§14).
   * ---------------------------------------------------------------- */
  app.post(`${base}/queries/openScorecard`,
    command('openScorecard', (ctx, p: { fixture_id: string }) => m09.openScorecard(ctx, p)));

  app.post(`${base}/scorecards/draft`,
    command('saveScorecardDraft',
      (ctx, p: m09.SaveDraftPayload) => m09.saveScorecardDraft(ctx, p)));

  app.post(`${base}/scorecards/:revisionId/submit`,
    command('submitScorecard', (ctx, p: m09.SubmitPayload) => m09.submitScorecard(ctx, p)));

  app.post(`${base}/scorecards/:revisionId/return`,
    command('returnForCorrection',
      (ctx, p: Parameters<typeof m09.returnForCorrection>[1]) => m09.returnForCorrection(ctx, p)));

  app.post(`${base}/scorecards/:revisionId/approve`,
    command('approveScorecard', (ctx, p: m09.ApprovePayload) => m09.approveScorecard(ctx, p)));

  app.post(`${base}/scorecards/:revisionId/lock`,
    command('lockScorecard',
      (ctx, p: Parameters<typeof m09.lockScorecard>[1]) => m09.lockScorecard(ctx, p)));

  app.post(`${base}/scorecards/:revisionId/amend`,
    command('amendLockedResult',
      (ctx, p: Parameters<typeof m09.amendLockedResult>[1]) => m09.amendLockedResult(ctx, p)));

  app.addHook('onClose', async () => { await prisma.$disconnect(); });
  return app;
}
