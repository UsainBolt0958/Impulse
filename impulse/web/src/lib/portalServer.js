const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function requestJson(path, init = {}) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      ...init,
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody && typeof errorBody === 'object' && errorBody.error) {
          errorMessage = errorBody.error;
        }
      } catch {
        // ignore invalid JSON error body
      }
      console.error('API request failed:', path, errorMessage);
      return null;
    }

    if (response.status === 204) {
      return {};
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', path, error);
    return null;
  }
}

async function requestJsonOrThrow(path, init = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody === 'object' && errorBody.error) {
        errorMessage = errorBody.error;
      }
    } catch {
      // ignore invalid JSON error body
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {};
  }

  return await response.json();
}

export async function loadPortalStateFromServer() {
  return requestJson('/admin-state', { method: 'GET' });
}

export async function loadPublicQuestionsFromServer() {
  const data = await requestJson('/questions', { method: 'GET', cache: 'no-store' });
  return Array.isArray(data?.questions) ? data.questions : [];
}

export async function loadAdminSessionFromServer() {
  return requestJson('/admin-session', { method: 'GET' });
}

export async function loginToAdminServer(password) {
  return requestJson('/admin-login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function logoutFromAdminServer() {
  return requestJson('/admin-logout', {
    method: 'POST',
  });
}

export async function savePortalStateToServer(state) {
  return requestJsonOrThrow('/admin-state', {
    method: 'PUT',
    body: JSON.stringify(state),
  });
}

export async function loadSeries() {
  const data = await requestJsonOrThrow('/series?all=true', { method: 'GET' });
  return Array.isArray(data?.series) ? data.series : [];
}

export async function getSeries(seriesId) {
  if (!seriesId) return null;
  return requestJsonOrThrow(`/series/${seriesId}`, { method: 'GET' });
}

export async function loadPublicSeries() {
  const data = await requestJsonOrThrow('/series', { method: 'GET' });
  return Array.isArray(data?.series) ? data.series : [];
}

export async function createSeries(title, description = '') {
  return requestJsonOrThrow('/series', {
    method: 'POST',
    body: JSON.stringify({ title, description }),
  });
}

export async function updateSeries(id, payload) {
  if (!id) return null;
  return requestJsonOrThrow(`/series/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload || {}),
  });
}

export async function deleteSeries(id) {
  if (!id) return null;
  return requestJsonOrThrow(`/series/${id}`, {
    method: 'DELETE',
  });
}

// Test Management API Functions
export async function loadTests() {
  const data = await requestJsonOrThrow('/tests', { method: 'GET' });
  return Array.isArray(data?.tests) ? data.tests : [];
}

export async function getTest(testId) {
  if (!testId) return null;
  return requestJsonOrThrow(`/tests/${testId}`, { method: 'GET' });
}

export async function createTest(payload) {
  return requestJsonOrThrow('/tests', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export async function updateTest(testId, payload) {
  if (!testId) return null;
  return requestJsonOrThrow(`/tests/${testId}`, {
    method: 'PUT',
    body: JSON.stringify(payload || {}),
  });
}

export async function deleteTest(testId) {
  if (!testId) return null;
  return requestJsonOrThrow(`/tests/${testId}`, {
    method: 'DELETE',
  });
}

export async function getSeriesTests(seriesId) {
  if (!seriesId) {
    throw new Error('Series id is required to load tests.');
  }
  const data = await requestJsonOrThrow(`/series/${seriesId}/tests`, { method: 'GET' });
  return Array.isArray(data?.tests) ? data.tests : [];
}

// Image Upload
export async function uploadImage(file) {
  if (!file) return null;

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error(`Could not read "${file.name}".`));
    reader.readAsDataURL(file);
  });
  if (typeof dataUrl !== 'string') {
    throw new Error(`Could not read "${file.name}" as an image.`);
  }
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error(`Could not encode "${file.name}" as an image.`);

  return requestJsonOrThrow('/uploads', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      data: base64,
      mime: file.type,
    }),
  });
}
