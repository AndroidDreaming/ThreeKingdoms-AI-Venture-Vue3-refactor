const AUTH_TOKEN_STORAGE_KEY = 'tk_refactor_auth_token_v1';

export function getStoredAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';
}

export function setStoredAuthToken(token) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    return;
  }
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function createRequestOptions(options = {}) {
  const headers = Object.assign({
    'Content-Type': 'application/json'
  }, options.headers || {});

  const token = getStoredAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return Object.assign({}, options, { headers });
}

export async function extractError(response, fallbackMessage) {
  let payload = null;
  let text = '';

  try {
    payload = await response.clone().json();
  } catch (error) {
    try {
      text = await response.text();
    } catch (innerError) {
      text = '';
    }
  }

  const error = new Error(
    (payload && payload.message)
    || text
    || fallbackMessage
    || `Request failed: ${response.status}`
  );

  if (payload && payload.code) error.code = payload.code;
  if (payload && payload.access) error.access = payload.access;
  error.status = response.status;
  throw error;
}

export async function requestJson(url, options = {}) {
  const response = await fetch(url, createRequestOptions(options));
  if (!response.ok) {
    await extractError(response, `Request failed: ${response.status}`);
  }
  return response.json();
}

export {
  AUTH_TOKEN_STORAGE_KEY
};
