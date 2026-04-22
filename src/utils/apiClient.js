const configuredApiOrigin = String(
  import.meta.env.VITE_API_ORIGIN || import.meta.env.VITE_API_BASE_URL || '',
).trim().replace(/\/+$/, '');
const hostedApiOrigin = 'https://skilltojob-backend.onrender.com';

const localApiOrigins = ['http://127.0.0.1:5001', 'http://localhost:5001'];

function normalizeApiPath(path) {
  const nextPath = String(path || '').trim();
  return nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
}

function canUseRelativeApiPath() {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.location.protocol === 'http:' || window.location.protocol === 'https:';
}

function isLocalRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  const hostname = String(window.location.hostname || '').toLowerCase();

  return window.location.protocol === 'file:' || hostname === '127.0.0.1' || hostname === 'localhost';
}

function buildApiCandidates(path) {
  const normalizedPath = normalizeApiPath(path);
  const candidates = [];

  if (canUseRelativeApiPath()) {
    candidates.push(normalizedPath);
  }

  if (isLocalRuntime()) {
    for (const origin of localApiOrigins) {
      candidates.push(`${origin}${normalizedPath}`);
    }
  }

  if (configuredApiOrigin) {
    candidates.push(`${configuredApiOrigin}${normalizedPath}`);
  } else if (!isLocalRuntime()) {
    candidates.push(`${hostedApiOrigin}${normalizedPath}`);
  }

  return [...new Set(candidates)];
}

function shouldTryNextCandidate(response, candidate, candidates, path) {
  if (candidates.length < 2) {
    return false;
  }

  const normalizedPath = normalizeApiPath(path);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const isRelativeCandidate = candidate === normalizedPath;

  if (!isRelativeCandidate) {
    return false;
  }

  return response.status === 404 || contentType.includes('text/html');
}

export async function fetchApi(path, options) {
  const candidates = buildApiCandidates(path);
  let lastError = null;

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, options);

      if (shouldTryNextCandidate(response, candidate, candidates, path)) {
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  const error = new TypeError('Could not reach the backend API.');
  error.cause = lastError;
  throw error;
}
