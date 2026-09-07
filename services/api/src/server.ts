/** Process entry point. */
import { buildApp } from './http/app.js';

const app = buildApp();
const port = Number(process.env['API_PORT'] ?? 4000);
const host = process.env['API_HOST'] ?? '0.0.0.0';

app.listen({ port, host })
  .then(() => app.log.info(`Khelo Sanand API listening on ${host}:${port}`))
  .catch((err: unknown) => { app.log.error(err); process.exit(1); });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} received; shutting down`);
    await app.close();
    process.exit(0);
  });
}
