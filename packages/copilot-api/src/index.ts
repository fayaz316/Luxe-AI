// SPDX-License-Identifier: Apache-2.0
import { resolveProvider } from '@lux/model-gateway';
import { pathToFileURL } from 'node:url';
import { seedDemoData } from './seed.js';
import { buildServer, SERVICE_NAME } from './service.js';
import { FirestoreStore, MemoryStore, type FirestoreLike, type Store } from './store.js';

export { buildServer } from './service.js';
export { FirestoreStore, MemoryStore } from './store.js';
export { seedDemoData } from './seed.js';

/**
 * Production data path. @google-cloud/firestore is an optional runtime
 * dependency (see README) and is loaded only in this branch; the module id is
 * kept opaque to the compiler for the same reason.
 */
async function resolveStore(): Promise<Store> {
  const firestoreProject = process.env.FIRESTORE_PROJECT;
  if (!firestoreProject) {
    return new MemoryStore();
  }
  try {
    const moduleId: string = '@google-cloud/firestore';
    const firestoreModule = (await import(moduleId)) as {
      Firestore: new (options: { projectId: string }) => FirestoreLike;
    };
    return new FirestoreStore(new firestoreModule.Firestore({ projectId: firestoreProject }));
  } catch (err) {
    console.warn(
      'FIRESTORE_PROJECT is set but @google-cloud/firestore is unavailable; falling back to the in-memory store.',
      err,
    );
    return new MemoryStore();
  }
}

async function main(): Promise<void> {
  const store = await resolveStore();
  const provider = resolveProvider(process.env);
  if (process.env.SEED_DEMO === '1') {
    await seedDemoData(store);
  }
  const app = buildServer({ store, provider });
  const port = Number(process.env.PORT ?? 8080);
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`${SERVICE_NAME} listening on 0.0.0.0:${port}`);
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  void main();
}
