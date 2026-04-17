const configuredApiOrigin = String(
  import.meta.env.VITE_API_ORIGIN || import.meta.env.VITE_API_BASE_URL || 'https://skilltojob-backend.onrender.com',
).trim().replace(/\/+$/, '');

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

function buildApiCandidates(path) {
  const normalizedPath = normalizeApiPath(path);
  const candidates = [];

  if (configuredApiOrigin) {
    candidates.push(`${configuredApiOrigin}${normalizedPath}`);
  }

  if (canUseRelativeApiPath()) {
    candidates.push(normalizedPath);
  }

  for (const origin of localApiOrigins) {
    candidates.push(`${origin}${normalizedPath}`);
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
