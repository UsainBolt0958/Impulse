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
      data: { Physics: { A: [] } },
    });
    expect(window.localStorage.length).toBe(1);
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
    window.localStorage.setItem('exam_session_session-2', JSON.stringify({ remaining: 120 }));
    window.localStorage.setItem('exam_checkpoint_session-2_1', JSON.stringify({ remaining: 120 }));
    window.localStorage.setItem('exam_result_session-1', JSON.stringify({ score: 10 }));

    await window.StorageManager.clearSession('session-1');

    expect(window.localStorage.getItem('exam_session_session-1')).toBeNull();
    expect(window.localStorage.getItem('exam_checkpoint_session-1_1')).toBeNull();
    expect(window.localStorage.getItem('exam_session_session-2')).not.toBeNull();
    expect(window.localStorage.getItem('exam_checkpoint_session-2_1')).not.toBeNull();
    expect(window.localStorage.getItem('exam_result_session-1')).not.toBeNull();
  });

  it('waits for pending session and checkpoint writes before clearing them', async () => {
    let resolveSessionSave;
    let resolveCheckpointSave;
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
      transaction: (storeNames) => {
        transactions.push(storeNames);
        const transaction = {
          objectStore: (storeName) => {
            const store = {
              delete: () => {},
              index: () => ({
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
                Object.defineProperty(request, 'onsuccess', {
                  set: (handler) => {
                    if (storeName === 'examSessions') {
                      resolveSessionSave = () => handler({ target: { result: undefined } });
                      notifySessionSaveStarted();
                    } else {
                      resolveCheckpointSave = () => handler({ target: { result: undefined } });
                      notifyCheckpointSaveStarted();
                    }
                  },
                });
                return request;
              };
            }
            return store;
          },
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

    const save = window.StorageManager.saveSession('session-1', { paper: 1 });
    await sessionSaveStarted;
    const checkpoint = window.StorageManager.createCheckpoint('session-1', { remaining: 60 });
    const clear = window.StorageManager.clearSession('session-1');
    await Promise.resolve();

    expect(transactions).toHaveLength(1);
    resolveSessionSave();
    await checkpointSaveStarted;
    expect(transactions).toHaveLength(2);
    resolveCheckpointSave();
    await expect(save).resolves.toBe(true);
    await expect(checkpoint).resolves.toMatch(/^session-1_/);
    await expect(clear).resolves.toBeUndefined();
    expect(transactions).toHaveLength(3);
    expect(window.localStorage.length).toBe(0);
  });
});
