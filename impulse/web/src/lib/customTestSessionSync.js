import { CUSTOM_TEST_SESSION_KEY } from './customTest';
import { supabase as defaultSupabase } from './supabase';

export const CUSTOM_TEST_CLOUD_CHECKPOINT_INTERVAL_MS = 90_000;

function getSessionMetadata(session) {
  const metadata = { ...session };
  delete metadata.answers;
  delete metadata.bookmarked;
  delete metadata.currentIndex;
  delete metadata.markedForReview;
  delete metadata.questions;
  delete metadata.timeSpent;
  delete metadata.updatedAt;
  return metadata;
}

export function getCustomTestSessionProgress(session) {
  return {
    answers: session.answers || {},
    bookmarked: session.bookmarked || [],
    currentIndex: Number(session.currentIndex) || 0,
    markedForReview: session.markedForReview || [],
    timeSpent: session.timeSpent || {},
    updatedAt: session.updatedAt || new Date().toISOString(),
  };
}

async function getAuthenticatedUserId(client) {
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.user?.id || null;
}

function buildSession(row, questions) {
  return {
    ...row.metadata,
    ...row.progress,
    id: row.session_id,
    questions,
    updatedAt: row.progress?.updatedAt || row.updated_at,
  };
}

function isNewerSession(candidate, current) {
  if (!current) return true;
  const timestamp = (value) => (
    typeof value === 'number' ? value : Date.parse(value || '') || 0
  );
  if (candidate.id !== current.id) {
    return timestamp(candidate.updatedAt || candidate.startedAt)
      >= timestamp(current.updatedAt || current.startedAt);
  }
  return timestamp(candidate.updatedAt) > timestamp(current.updatedAt);
}

async function saveCloudSessionSnapshot(session, client) {
  const { error } = await client.rpc('save_custom_test_session', {
    p_session_id: session.id,
    p_metadata: getSessionMetadata(session),
    p_progress: getCustomTestSessionProgress(session),
    p_questions: session.questions,
  });
  if (error) throw error;
}

export async function createCustomTestCloudSession(session, client = defaultSupabase) {
  const userId = await getAuthenticatedUserId(client);
  if (!userId) return false;

  await saveCloudSessionSnapshot(session, client);
  return true;
}

export async function saveCustomTestCloudProgress(session, client = defaultSupabase) {
  const userId = await getAuthenticatedUserId(client);
  if (!userId) return false;

  const { data, error } = await client
    .from('custom_test_sessions')
    .update({
      progress: getCustomTestSessionProgress(session),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('session_id', session.id)
    .eq('status', 'active')
    .select('session_id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('The active custom-test cloud session could not be found.');
  return true;
}

export async function completeCustomTestCloudSession(sessionId, client = defaultSupabase) {
  const userId = await getAuthenticatedUserId(client);
  if (!userId) return false;

  const { error } = await client.rpc('complete_custom_test_session', {
    p_session_id: sessionId,
  });
  if (error) throw error;
  return true;
}

async function loadLegacyCloudSession(userId, client) {
  const { data, error } = await client
    .from('user_data')
    .select('value')
    .eq('user_id', userId)
    .eq('storage_key', CUSTOM_TEST_SESSION_KEY)
    .maybeSingle();
  if (error) throw error;
  const session = data?.value;
  if (!session || !Array.isArray(session.questions) || !session.id) return null;

  await saveCloudSessionSnapshot(session, client);

  const { error: deleteError } = await client
    .from('user_data')
    .delete()
    .eq('user_id', userId)
    .eq('storage_key', CUSTOM_TEST_SESSION_KEY);
  if (deleteError) throw deleteError;
  return session;
}

export async function loadCustomTestCloudSession(localSession = null, client = defaultSupabase) {
  const userId = await getAuthenticatedUserId(client);
  if (!userId) return localSession;

  const { data: row, error } = await client
    .from('custom_test_sessions')
    .select('session_id,metadata,progress,updated_at,status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;

  const timestamp = (value) => (
    typeof value === 'number' ? value : Date.parse(value || '') || 0
  );
  if (row?.status === 'completed') {
    if (!localSession || localSession.id === row.session_id) return null;
    if (timestamp(localSession.updatedAt || localSession.startedAt) <= timestamp(row.updated_at)) {
      return null;
    }
    await saveCloudSessionSnapshot(localSession, client);
    return localSession;
  }

  let cloudSession = null;
  if (row?.status === 'active') {
    const { data: questionRow, error: questionError } = await client
      .from('custom_test_session_questions')
      .select('questions')
      .eq('user_id', userId)
      .eq('session_id', row.session_id)
      .maybeSingle();
    if (questionError) throw questionError;
    if (!Array.isArray(questionRow?.questions)) {
      throw new Error('The saved custom-test question snapshot is missing.');
    }
    cloudSession = buildSession(row, questionRow.questions);
  } else {
    cloudSession = await loadLegacyCloudSession(userId, client);
  }

  if (!cloudSession && localSession) {
    await saveCloudSessionSnapshot(localSession, client);
    return localSession;
  }

  if (!cloudSession || !isNewerSession(cloudSession, localSession)) {
    if (cloudSession && localSession && cloudSession.id !== localSession.id) {
      await saveCloudSessionSnapshot(localSession, client);
    }
    return localSession;
  }
  return cloudSession;
}
