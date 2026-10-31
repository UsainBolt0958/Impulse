// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const storageManagerSource = readFileSync(
  resolve(process.cwd(), 'public', 'jee2025', 'assets', 'js', 'storage-manager.js'),
  'utf8'
);

function loadStorageManager() {
  new Function('window', 'indexedDB', 'localStorage', 'navigator', 'console', storageManagerSource)(
    window,
    window.indexedDB,
    window.localStorage,
    window.navigator,
    console
  );
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
});
