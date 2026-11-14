// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const storageManagerSource = readFileSync(
  resolve(process.cwd(), 'public', 'jee2025', 'assets', 'js', 'storage-manager.js'),
  'utf8'
);

function loadStorageManager(indexedDB = window.indexedDB) {
  const managerWindow = { indexedDB };
  new Function('window', 'indexedDB', 'localStorage', 'navigator', 'console', storageManagerSource)(
    managerWindow,
    indexedDB,
    window.localStorage,
    window.navigator,
    console
  );
  window.StorageManager = managerWindow.StorageManager;
}

describe('exam storage manager checkpoint backup', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.StorageManager;
  });

  it('saves and restores recovery checkpoints through localStorage', async () => {
    loadStorageManager();

    await window.StorageManager.createCheckpoint('session-1', {
      remaining: 420,
      current: 3,
      data: { Physics: { A: [] } },
    });

    await expect(window.StorageManager.getLatestCheckpoint('session-1')).resolves.toEqual({
      remaining: 420,
      current: 3,
    });
    expect(window.localStorage.length).toBe(1);
  });

  it('keeps only the latest compact checkpoint in localStorage fallback', async () => {
    loadStorageManager();

    for (let remaining = 12; remaining > 0; remaining -= 1) {
      await window.StorageManager.createCheckpoint('session-1', {
        remaining,
        current: 1,
        data: { Physics: { A: ['large question snapshot'] } },
      });
    }

    await expect(window.StorageManager.getCheckpoints('session-1')).resolves.toHaveLength(1);
    await expect(window.StorageManager.getLatestCheckpoint('session-1')).resolves.toMatchObject({
      remaining: 1,
      current: 1,
    });
    expect(await window.StorageManager.getLatestCheckpoint('session-1')).not.toHaveProperty('data');
    expect(window.localStorage.length).toBe(1);
  });

  it('compacts old localStorage checkpoints that contain question snapshots', async () => {
    loadStorageManager();
    window.localStorage.setItem('exam_checkpoint_session-1_old', JSON.stringify({
      checkpointId: 'session-1_old',
      sessionId: 'session-1',
      timestamp: 1,
      compressed: false,
      data: JSON.stringify({
        remaining: 60,
        current: 4,
        data: { Physics: { A: ['legacy question snapshot'] } },
      }),
    }));

    await window.StorageManager.cleanupCheckpoints('session-1');

    const savedCheckpoint = JSON.parse(window.localStorage.getItem('exam_checkpoint_session-1_old'));
    expect(JSON.parse(savedCheckpoint.data)).not.toHaveProperty('data');
    await expect(window.StorageManager.getLatestCheckpoint('session-1')).resolves.toMatchObject({
      remaining: 60,
      current: 4,
    });
  });

  it('does not duplicate checkpoints in localStorage when IndexedDB works', async () => {
    const records = new Map();
    const database = {
      objectStoreNames: { contains: () => true },
      transaction: () => {
        const transaction = {
          objectStore: () => ({
            put: (record) => records.set(record.checkpointId, record),
            index: () => ({
              getAll: (sessionId) => {
                const request = {};
                queueMicrotask(() => {
                  request.onsuccess?.({
                    target: {
                      result: [...records.values()].filter((record) => record.sessionId === sessionId),
                    },
                  });
                });
                return request;
              },
            }),
          }),
        };
        setTimeout(() => transaction.oncomplete?.(), 0);
        return transaction;
      },
    };
    const indexedDB = {
      open: () => {
        const request = {};
        queueMicrotask(() => request.onsuccess?.({ target: { result: database } }));
        return request;
      },
    };
    loadStorageManager(indexedDB);

    await window.StorageManager.createCheckpoint('session-1', {
      remaining: 420,
      data: { Physics: { A: ['large question snapshot'] } },
    });

    expect(window.localStorage.length).toBe(0);
    expect(JSON.parse([...records.values()][0].data)).not.toHaveProperty('data');
  });

  it('removes checkpoint backups when a session is cleared', async () => {
    loadStorageManager();
    await window.StorageManager.createCheckpoint('session-1', { remaining: 60 });

    await window.StorageManager.clearSession('session-1');

    await expect(window.StorageManager.getLatestCheckpoint('session-1')).resolves.toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it('clears only the completed session and its checkpoints', async () => {
    loadStorageManager();
    window.localStorage.setItem('exam_session_session-1', JSON.stringify({ remaining: 60 }));
    window.localStorage.setItem('exam_checkpoint_session-1_1', JSON.stringify({ remaining: 60 }));
    window.localStorage.setItem('exam_analytics_session-1', JSON.stringify({ timePerQuestion: {} }));
    window.localStorage.setItem('exam_session_session-2', JSON.stringify({ remaining: 120 }));
    window.localStorage.setItem('exam_checkpoint_session-2_1', JSON.stringify({ remaining: 120 }));
    window.localStorage.setItem('exam_result_session-1', JSON.stringify({ score: 10 }));

    await window.StorageManager.clearSession('session-1');

    expect(window.localStorage.getItem('exam_session_session-1')).toBeNull();
    expect(window.localStorage.getItem('exam_checkpoint_session-1_1')).toBeNull();
    expect(window.localStorage.getItem('exam_analytics_session-1')).toBeNull();
    expect(window.localStorage.getItem('exam_session_session-2')).not.toBeNull();
    expect(window.localStorage.getItem('exam_checkpoint_session-2_1')).not.toBeNull();
    expect(window.localStorage.getItem('exam_result_session-1')).not.toBeNull();
  });

  it('waits for pending session and checkpoint writes before clearing them', async () => {
    let resolveSessionSave;
    let completeCheckpointTransaction;
    let notifySessionSaveStarted;
    let notifyCheckpointSaveStarted;
    const sessionSaveStarted = new Promise((resolve) => {
      notifySessionSaveStarted = resolve;
    });
    const checkpointSaveStarted = new Promise((resolve) => {
      notifyCheckpointSaveStarted = resolve;
    });
    const transactions = [];
    const database = {
      objectStoreNames: { contains: () => true },
      transaction: (storeNames, mode) => {
        transactions.push(storeNames);
        const transaction = {
          objectStore: (storeName) => {
            const store = {
              delete: () => {},
              index: () => ({
                getAll: () => {
                  const request = {};
                  queueMicrotask(() => request.onsuccess?.({ target: { result: [] } }));
                  return request;
                },
                openCursor: () => {
                  const request = {};
                  queueMicrotask(() => request.onsuccess?.({ target: { result: null } }));
                  return request;
                },
              }),
            };
            if (storeName === 'examSessions' || storeName === 'checkpoints') {
              store.put = () => {
                const request = {};
                if (storeName === 'examSessions') {
                  Object.defineProperty(request, 'onsuccess', {
                    set: (handler) => {
                      resolveSessionSave = () => handler({ target: { result: undefined } });
                      notifySessionSaveStarted();
                    },
                  });
                }
                return request;
              };
            }
            return store;
          },
        };
        if (mode === 'readwrite' && storeNames.length === 1 && storeNames[0] === 'checkpoints') {
          completeCheckpointTransaction = () => transaction.oncomplete?.();
          notifyCheckpointSaveStarted();
        } else {
          setTimeout(() => transaction.oncomplete?.(), 0);
        }
        return transaction;
      },
    };
    const indexedDB = {
      open: () => {
        const request = {};
        queueMicrotask(() => request.onsuccess?.({ target: { result: database } }));
        return request;
      },
    };
    loadStorageManager(indexedDB);

    const save = window.StorageManager.saveSession('session-1', { paper: 1 });
    await sessionSaveStarted;
    const checkpoint = window.StorageManager.createCheckpoint('session-1', { remaining: 60 });
    const clear = window.StorageManager.clearSession('session-1');
    await Promise.resolve();

    expect(transactions).toHaveLength(1);
    resolveSessionSave();
    await checkpointSaveStarted;
    expect(transactions).toHaveLength(2);
    completeCheckpointTransaction();
    await expect(save).resolves.toBe(true);
    await expect(checkpoint).resolves.toMatch(/^session-1_/);
    await expect(clear).resolves.toBeUndefined();
    expect(transactions).toHaveLength(4);
    expect(window.localStorage.length).toBe(0);
  });
});
