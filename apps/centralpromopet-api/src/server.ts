import { app } from './app';
import { client } from '@centralpromopet/database';
import { closeCheckpointer } from './ai/storage';
const port = Number(process.env.PORT || 4000);
const server = app.listen(port, '0.0.0.0', () => console.log(`Central Promo Pet API listening on port ${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  server.close(() => { void closeCheckpointer().finally(() => client.end()).then(() => process.exit(0)); });
  setTimeout(() => process.exit(1), 10000).unref();
});
