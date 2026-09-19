// Bound stalled requests without automatically repeating state-changing operations.
async function fetchAttempt(url, options = {}) {
  const { timeoutMs = 20000, signal, ...requestOptions } = options;
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    return await fetch(url, { ...requestOptions, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      const timeout = new Error("Request timed out");
      timeout.code = "REQUEST_TIMEOUT";
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

// Cold starts can race the device's network connection. Retry reads only;
// mutations must never be replayed implicitly.
export async function fetchWithTimeout(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const retries = method === "GET" || method === "HEAD" ? 2 : 0;
  for (let attempt = 0; ; attempt += 1) {
    if (options.signal?.aborted) {
      const error = new Error("Request canceled");
      error.name = "AbortError";
      throw error;
    }
    try {
      const response = await fetchAttempt(url, options);
      if (attempt >= retries || ![408, 502, 503, 504].includes(response.status)) return response;
    } catch (error) {
      if (attempt >= retries || options.signal?.aborted || error.name === "AbortError") throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
}
