// Test helpers: a scripted fake fetch that records calls.
export function jsonResponse(status, body, headers = {}) {
  return new Response(body === undefined || status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/**
 * routes: array of [prefix, handler]. prefix matches "METHOD url".
 * handler is a Response factory: ({ url, init, n }) => Response, where n is
 * how many times this route has been hit (0-based). Unmatched calls throw.
 */
export function createFakeFetch(routes) {
  const calls = [];
  const hits = new Map();
  const fakeFetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    const key = `${method} ${url}`;
    calls.push({ url: String(url), method, init });
    for (const [prefix, handler] of routes) {
      if (key.startsWith(prefix)) {
        const n = hits.get(prefix) || 0;
        hits.set(prefix, n + 1);
        return handler({ url: String(url), init, n });
      }
    }
    throw new Error(`Unexpected fetch: ${key}`);
  };
  fakeFetch.calls = calls;
  return fakeFetch;
}
