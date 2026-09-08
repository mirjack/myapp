// Bound stalled requests without automatically repeating state-changing operations.
export async function fetchWithTimeout(url, options = {}) {
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
