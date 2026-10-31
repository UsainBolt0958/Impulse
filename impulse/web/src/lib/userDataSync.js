export const USER_DATA_UPDATED_EVENT = 'impulse:user-data-updated';

let suppressStorageEvents = false;

const USER_DATA_KEYS = new Set([
  'impulse_solved',
  'impulse_marked',
  'impulse_notebooks',
  'impulse_profile_stat_visibility',
  'impulse_custom_test_session',
  'impulse_custom_test_results',
  'impulse_quiz_player_id',
  'impulse_quiz_player_name',
  'theme',
  'solve_font_size',
  'custom_test_font_size',
  'test_analytics_history',
  'test_analytics_data',
  'test_analytics_last_signature',
  'exam_sync_queue',
  'jee_adv_sess_v2_hash',
  'jee_adv_2025_data_v1',
  'jee_adv_2025_sess_v1',
  'jee_adv_2025_sess_v1_hash',
]);

export function isUserDataKey(key) {
  return USER_DATA_KEYS.has(key)
    || /^test_series_.+_(?:data|sess)_v1(?:_hash)?$/.test(key)
    || /^exam_session_.+(?:_chunks|_chunk_\d+)?$/.test(key)
    || /^exam_analytics_.+$/.test(key)
    || /^exam_checkpoint_.+_\d+$/.test(key);
}

function isLocalUserDataKey(key) {
  return isUserDataKey(key) || /^impulse_quiz_player_token:.+$/.test(key);
}

function readLocalValue(key) {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function serializeLocalValue(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function mergeAttempts(remoteValue, localValue) {
  if (!Array.isArray(remoteValue) || !Array.isArray(localValue)) return localValue;
  const seen = new Set();
  return [...remoteValue, ...localValue].filter((attempt) => {
    const identity = attempt?.attemptId || attempt?.attempt_id || JSON.stringify(attempt);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function mergeUniqueValues(remoteValue, localValue) {
  if (!Array.isArray(remoteValue) || !Array.isArray(localValue)) return localValue;
  const seen = new Set();
  return [...remoteValue, ...localValue].filter((value) => {
    const identity = typeof value === 'string' ? value : JSON.stringify(value);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function mergeNotebooks(remoteValue, localValue) {
  if (!Array.isArray(remoteValue) || !Array.isArray(localValue)) return localValue;
  const notebooks = new Map(remoteValue.map((notebook) => [notebook.id, notebook]));

  localValue.forEach((notebook) => {
    const existing = notebooks.get(notebook.id);
    notebooks.set(notebook.id, existing
      ? {
        ...existing,
        ...notebook,
        questionIds: mergeUniqueValues(existing.questionIds, notebook.questionIds),
      }
      : notebook);
  });

  return [...notebooks.values()];
}

function mergeUserData(key, remoteValue, localValue) {
  if (key === 'impulse_solved') return mergeAttempts(remoteValue, localValue);
  if (key === 'impulse_marked') return mergeUniqueValues(remoteValue, localValue);
  if (key === 'impulse_notebooks') return mergeNotebooks(remoteValue, localValue);
  if (key === 'impulse_custom_test_results') return mergeAttempts(remoteValue, localValue);

  if (key === 'test_analytics_history') {
    if (!remoteValue || !localValue || typeof remoteValue !== 'object' || typeof localValue !== 'object') {
      return localValue;
    }
    return {
      ...remoteValue,
      ...localValue,
      attempts: mergeAttempts(remoteValue.attempts, localValue.attempts),
    };
  }

  if (key === 'exam_sync_queue') {
    return mergeAttempts(remoteValue, localValue).slice(-20);
  }

  if (key.startsWith('exam_analytics_')) {
    const toTimestamp = (value) => (
      typeof value === 'number' ? value : Date.parse(value || '')
    );
    const remoteTimestamp = toTimestamp(remoteValue?.timestamp);
    const localTimestamp = toTimestamp(localValue?.timestamp);
    return !Number.isFinite(remoteTimestamp) || localTimestamp >= remoteTimestamp
      ? localValue
      : remoteValue;
  }

  return localValue;
}

function installStorageObserver(onChange) {
  const storagePrototype = Storage.prototype;
  const originalSetItem = storagePrototype.setItem;
  const originalRemoveItem = storagePrototype.removeItem;
  const wrappedSetItem = function setItem(key, value) {
    const result = Reflect.apply(originalSetItem, this, [key, value]);
    if (this === window.localStorage && !suppressStorageEvents) {
      window.dispatchEvent(new CustomEvent(USER_DATA_UPDATED_EVENT, {
        detail: { key: String(key), removed: false },
      }));
    }
    return result;
  };
  const wrappedRemoveItem = function removeItem(key) {
    const result = Reflect.apply(originalRemoveItem, this, [key]);
    if (this === window.localStorage && !suppressStorageEvents) {
      window.dispatchEvent(new CustomEvent(USER_DATA_UPDATED_EVENT, {
        detail: { key: String(key), removed: true },
      }));
    }
    return result;
  };

  storagePrototype.setItem = wrappedSetItem;
  storagePrototype.removeItem = wrappedRemoveItem;

  const handleChange = (event) => {
    const { key, removed } = event.detail || {};
    if (typeof key === 'string' && isUserDataKey(key)) onChange(key, removed);
  };
  const handleOtherTabChange = (event) => {
    if (event.key && isUserDataKey(event.key)) onChange(event.key, event.newValue === null);
  };

  window.addEventListener(USER_DATA_UPDATED_EVENT, handleChange);
  window.addEventListener('storage', handleOtherTabChange);

  return () => {
    window.removeEventListener(USER_DATA_UPDATED_EVENT, handleChange);
    window.removeEventListener('storage', handleOtherTabChange);
    if (storagePrototype.setItem === wrappedSetItem) {
      storagePrototype.setItem = originalSetItem;
    }
    if (storagePrototype.removeItem === wrappedRemoveItem) {
      storagePrototype.removeItem = originalRemoveItem;
    }
  };
}

export function clearLocalUserData() {
  const keys = Array.from({ length: window.localStorage.length }, (_, index) => (
    window.localStorage.key(index)
  )).filter((key) => key && isLocalUserDataKey(key));
  suppressStorageEvents = true;
  try {
    keys.forEach((key) => window.localStorage.removeItem(key));
  } finally {
    suppressStorageEvents = false;
  }

  if (!window.indexedDB) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase('ExamEngineDB');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Could not clear local exam data.'));
    request.onblocked = () => reject(new Error(
      'Close any open exam tabs before clearing this account’s local exam data.'
    ));
  });
}

export function startUserDataSync(client, userId, onStatusChange) {
  let isActive = true;
  let isReady = false;
  let isFlushing = false;
  let initializing = null;
  let timer = null;
  const pendingKeys = new Set();

  const setStatus = (status, error = null) => {
    if (isActive) onStatusChange(status, error);
  };

  const saveKey = async (key, removed) => {
    const query = client.from('user_data');
    if (removed || window.localStorage.getItem(key) === null) {
      const { error } = await query.delete().eq('user_id', userId).eq('storage_key', key);
      if (error) throw error;
      return;
    }

    const value = readLocalValue(key);
    const { error } = await query.upsert({
      user_id: userId,
      storage_key: key,
      value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,storage_key' });
    if (error) throw error;
  };

  const flush = async () => {
    if (!isActive || !isReady || isFlushing || pendingKeys.size === 0) return;
    isFlushing = true;
    try {
      while (isActive && pendingKeys.size > 0) {
        const keys = [...pendingKeys];
        pendingKeys.clear();
        try {
          for (const key of keys) {
            await saveKey(key, window.localStorage.getItem(key) === null);
          }
        } catch (error) {
          keys.forEach((key) => pendingKeys.add(key));
          throw error;
        }
      }
      setStatus('synced');
    } catch (error) {
      console.error('Could not sync saved study data to Supabase.', error);
      setStatus('error', error);
      if (isActive) {
        timer = window.setTimeout(() => {
          timer = null;
          flush();
        }, 15000);
      }
    } finally {
      isFlushing = false;
    }
  };

  const scheduleSave = (key, removed) => {
    if (!isReady || !isActive) return;
    pendingKeys.add(key);
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      flush();
    }, 350);
    if (removed) pendingKeys.add(key);
  };

  const stopObserving = installStorageObserver(scheduleSave);

  const initialize = () => {
    if (initializing) return initializing;
    initializing = (async () => {
      setStatus('syncing');
      const { data, error } = await client
        .from('user_data')
        .select('storage_key,value')
        .eq('user_id', userId);
      if (error) throw error;

      const cloudValues = new Map((data || []).map((row) => [row.storage_key, row.value]));
      const localKeys = Object.keys(window.localStorage).filter(isUserDataKey);

      for (const [key, remoteValue] of cloudValues) {
        if (!isUserDataKey(key)) continue;
        const localValue = readLocalValue(key);
        const value = localValue === null
          ? remoteValue
          : mergeUserData(key, remoteValue, localValue);
        const oldValue = window.localStorage.getItem(key);
        const serializedValue = serializeLocalValue(value);
        window.localStorage.setItem(key, serializedValue);
        window.dispatchEvent(new StorageEvent('storage', {
          key,
          oldValue,
          newValue: serializedValue,
          storageArea: window.localStorage,
        }));
        if (JSON.stringify(value) !== JSON.stringify(remoteValue)) pendingKeys.add(key);
      }

      for (const key of localKeys) {
        if (!cloudValues.has(key)) pendingKeys.add(key);
      }

      isReady = true;
      if (pendingKeys.size > 0) await flush();
      else setStatus('synced');
    })().finally(() => {
      initializing = null;
    });
    return initializing;
  };

  const reportInitializationError = (error) => {
    console.error('Could not load saved study data from Supabase.', error);
    setStatus('error', error);
  };
  initialize().catch(reportInitializationError);

  const retry = () => {
    if (isReady) {
      if (pendingKeys.size > 0) flush();
      return;
    }
    initialize().catch(reportInitializationError);
  };
  window.addEventListener('online', retry);
  window.addEventListener('focus', retry);

  return () => {
    isActive = false;
    isReady = false;
    if (timer) window.clearTimeout(timer);
    window.removeEventListener('online', retry);
    window.removeEventListener('focus', retry);
    stopObserving();
  };
}
