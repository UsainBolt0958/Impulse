export const USER_DATA_UPDATED_EVENT = 'impulse:user-data-updated';

let suppressStorageEvents = false;

const USER_DATA_KEYS = new Set([
  'impulse_solved',
  'impulse_marked',
  'impulse_notebooks',
  'impulse_profile_stat_visibility',
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
const LOCAL_ONLY_USER_DATA_KEYS = new Set(['impulse_custom_test_session']);
const SOLVED_ATTEMPTS_KEY = 'impulse_solved';
const STUDY_ATTEMPT_PAGE_SIZE = 1000;
const STUDY_ATTEMPT_WRITE_BATCH_SIZE = 250;
const TEST_SERIES_SESSION_SYNC_INTERVAL_MS = 90_000;

function isTestSeriesSessionKey(key) {
  return /^test_series_.+_sess_v1$/.test(key);
}

function appendOnlyStudyAttemptsEnabled() {
  return import.meta.env.VITE_SUPABASE_APPEND_ONLY_ATTEMPTS === 'true';
}

export function isUserDataKey(key) {
  return USER_DATA_KEYS.has(key)
    || /^test_series_.+_(?:data|sess)_v1(?:_hash)?$/.test(key)
    || /^exam_session_.+(?:_chunks|_chunk_\d+)?$/.test(key)
    || /^exam_analytics_.+$/.test(key)
    || /^exam_checkpoint_.+_\d+$/.test(key);
}

function isLocalUserDataKey(key) {
  return isUserDataKey(key)
    || LOCAL_ONLY_USER_DATA_KEYS.has(key)
    || /^impulse_quiz_player_token:.+$/.test(key);
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
    const identity = getAttemptIdentity(attempt);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function getAttemptIdentity(attempt) {
  return attempt?.attemptId || attempt?.attempt_id || stableSerialize(attempt);
}

async function readAppendOnlyStudyAttempts(client, userId) {
  const attempts = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client
      .from('study_attempts')
      .select('attempt_id,attempt')
      .eq('user_id', userId)
      .order('attempt_id', { ascending: true })
      .range(offset, offset + STUDY_ATTEMPT_PAGE_SIZE - 1);
    if (error) throw error;

    const rows = data || [];
    for (const row of rows) {
      if (!row.attempt || typeof row.attempt !== 'object' || Array.isArray(row.attempt)) {
        throw new Error('A saved study attempt has an invalid shape.');
      }
      attempts.push(row.attempt);
    }

    if (rows.length < STUDY_ATTEMPT_PAGE_SIZE) return attempts;
    offset += STUDY_ATTEMPT_PAGE_SIZE;
  }
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
  const appendOnlyStudyAttempts = appendOnlyStudyAttemptsEnabled();
  let isActive = true;
  let isReady = false;
  let isFlushing = false;
  let initializing = null;
  let timer = null;
  const pendingKeys = new Set();
  const urgentKeys = new Set();
  const knownStudyAttemptIds = new Set();
  const lastTestSeriesSessionSyncAt = new Map();

  const setStatus = (status, error = null) => {
    if (isActive) onStatusChange(status, error);
  };

  const saveKey = async (key, removed) => {
    if (!isActive) return;
    if (appendOnlyStudyAttempts && key === SOLVED_ATTEMPTS_KEY) {
      if (removed || window.localStorage.getItem(key) === null) return;

      const attempts = readLocalValue(key);
      if (!Array.isArray(attempts)) {
        throw new Error('Saved solved-question data must be an array.');
      }
      const newAttempts = attempts.filter((attempt) => (
        !knownStudyAttemptIds.has(getAttemptIdentity(attempt))
      ));

      for (let offset = 0; offset < newAttempts.length; offset += STUDY_ATTEMPT_WRITE_BATCH_SIZE) {
        if (!isActive) return;
        const batch = newAttempts.slice(offset, offset + STUDY_ATTEMPT_WRITE_BATCH_SIZE);
        const { error } = await client.rpc('append_study_attempts', {
          p_attempts: batch,
        });
        if (error) throw error;
        batch.forEach((attempt) => knownStudyAttemptIds.add(getAttemptIdentity(attempt)));
      }
      return;
    }

    const query = client.from('user_data');
    if (removed || window.localStorage.getItem(key) === null) {
      const { error } = await query.delete().eq('user_id', userId).eq('storage_key', key);
      if (error) throw error;
      lastTestSeriesSessionSyncAt.delete(key);
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
    if (isTestSeriesSessionKey(key)) {
      lastTestSeriesSessionSyncAt.set(key, Date.now());
    }
  };

  const getPendingFlushDelay = () => {
    let delay = Number.POSITIVE_INFINITY;
    for (const key of pendingKeys) {
      if (urgentKeys.has(key)) return 0;
      if (!isTestSeriesSessionKey(key)) return 350;
      const lastSyncedAt = lastTestSeriesSessionSyncAt.get(key);
      const nextAllowedAt = lastSyncedAt === undefined
        ? Date.now() + 350
        : lastSyncedAt + TEST_SERIES_SESSION_SYNC_INTERVAL_MS;
      delay = Math.min(delay, Math.max(0, nextAllowedAt - Date.now()));
    }
    return Number.isFinite(delay) ? delay : 350;
  };

  const scheduleFlush = (delay) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      flush();
    }, delay);
  };

  const flush = async () => {
    if (!isActive || !isReady || isFlushing || pendingKeys.size === 0) return;
    isFlushing = true;
    try {
      while (isActive && pendingKeys.size > 0) {
        const now = Date.now();
        const readyKeys = [...pendingKeys].filter((key) => (
          !isTestSeriesSessionKey(key)
          || urgentKeys.has(key)
          || lastTestSeriesSessionSyncAt.get(key) === undefined
          || now - lastTestSeriesSessionSyncAt.get(key) >= TEST_SERIES_SESSION_SYNC_INTERVAL_MS
        ));
        if (readyKeys.length === 0) break;

        for (const key of readyKeys) {
          if (!isActive) break;
          pendingKeys.delete(key);
          try {
            await saveKey(key, window.localStorage.getItem(key) === null);
            urgentKeys.delete(key);
          } catch (error) {
            pendingKeys.add(key);
            throw error;
          }
        }
      }
      setStatus(pendingKeys.size > 0 ? 'syncing' : 'synced');
    } catch (error) {
      console.error('Could not sync saved study data to Supabase.', error);
      setStatus('error', error);
      if (isActive) {
        scheduleFlush(15000);
      }
    } finally {
      isFlushing = false;
      if (isActive && pendingKeys.size > 0 && !timer) {
        scheduleFlush(getPendingFlushDelay());
      }
    }
  };

  const scheduleSave = (key, removed) => {
    if (!isReady || !isActive) return;
    pendingKeys.add(key);
    if (removed) urgentKeys.add(key);
    scheduleFlush(getPendingFlushDelay());
  };

  const flushTestSeriesSessionsWhenHidden = () => {
    if (!isActive || !isReady || document.visibilityState !== 'hidden') return;
    pendingKeys.forEach((key) => {
      if (isTestSeriesSessionKey(key)) urgentKeys.add(key);
    });
    if (urgentKeys.size > 0) {
      if (timer) window.clearTimeout(timer);
      timer = null;
      flush();
    }
  };

  const stopObserving = installStorageObserver(scheduleSave);
  document.addEventListener('visibilitychange', flushTestSeriesSessionsWhenHidden);

  const initialize = () => {
    if (initializing) return initializing;
    initializing = (async () => {
      setStatus('loading');
      const { data, error } = await client
        .from('user_data')
        .select('storage_key,value')
        .eq('user_id', userId);
      if (error) throw error;
      if (!isActive) return;

      const cloudValues = new Map((data || []).map((row) => [row.storage_key, row.value]));
      const localKeys = Object.keys(window.localStorage).filter(isUserDataKey);
      if (appendOnlyStudyAttempts) {
        const legacyAttempts = cloudValues.get(SOLVED_ATTEMPTS_KEY);
        if (legacyAttempts != null && !Array.isArray(legacyAttempts)) {
          throw new Error('Saved cloud solved-question data must be an array.');
        }
        const cloudAttempts = mergeAttempts(
          Array.isArray(legacyAttempts) ? legacyAttempts : [],
          await readAppendOnlyStudyAttempts(client, userId),
        );
        if (!isActive) return;
        const localAttempts = readLocalValue(SOLVED_ATTEMPTS_KEY);
        if (localAttempts != null && !Array.isArray(localAttempts)) {
          throw new Error('Saved local solved-question data must be an array.');
        }
        const localAttemptList = Array.isArray(localAttempts) ? localAttempts : [];
        const mergedAttempts = mergeAttempts(cloudAttempts, localAttemptList);

        cloudAttempts.forEach((attempt) => {
          knownStudyAttemptIds.add(getAttemptIdentity(attempt));
        });

        if (
          mergedAttempts.length > 0
          || Array.isArray(localAttempts)
          || cloudValues.has(SOLVED_ATTEMPTS_KEY)
        ) {
          const serializedValue = serializeLocalValue(mergedAttempts);
          const oldValue = window.localStorage.getItem(SOLVED_ATTEMPTS_KEY);
          window.localStorage.setItem(SOLVED_ATTEMPTS_KEY, serializedValue);
          window.dispatchEvent(new StorageEvent('storage', {
            key: SOLVED_ATTEMPTS_KEY,
            oldValue,
            newValue: serializedValue,
            storageArea: window.localStorage,
          }));
        }

        const cloudAttemptIds = new Set(cloudAttempts.map(getAttemptIdentity));
        if (localAttemptList.some((attempt) => !cloudAttemptIds.has(getAttemptIdentity(attempt)))) {
          pendingKeys.add(SOLVED_ATTEMPTS_KEY);
        }
      }

      for (const [key, remoteValue] of cloudValues) {
        if (!isUserDataKey(key)) continue;
        if (appendOnlyStudyAttempts && key === SOLVED_ATTEMPTS_KEY) continue;
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
        if (appendOnlyStudyAttempts && key === SOLVED_ATTEMPTS_KEY) continue;
        if (!cloudValues.has(key)) pendingKeys.add(key);
      }

      isReady = true;
      if (appendOnlyStudyAttempts) {
        const latestAttempts = readLocalValue(SOLVED_ATTEMPTS_KEY);
        if (Array.isArray(latestAttempts) && latestAttempts.some((attempt) => (
          !knownStudyAttemptIds.has(getAttemptIdentity(attempt))
        ))) {
          pendingKeys.add(SOLVED_ATTEMPTS_KEY);
        }
      }
      if (pendingKeys.size > 0) {
        setStatus('syncing');
        flush();
      } else {
        setStatus('synced');
      }
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
    document.removeEventListener('visibilitychange', flushTestSeriesSessionsWhenHidden);
    stopObserving();
  };
}
