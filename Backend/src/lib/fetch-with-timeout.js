export class ExternalRequestError extends Error {
  constructor(message, { status = 502, code = "EXTERNAL_REQUEST_FAILED", cause } = {}) {
    super(message, { cause });
    this.name = "ExternalRequestError";
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

export async function fetchWithTimeout(url, options = {}, { timeoutMs = Number(process.env.EXTERNAL_HTTP_TIMEOUT_MS ?? 8_000), fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ExternalRequestError("External service timeout", { status: 503, code: "EXTERNAL_TIMEOUT", cause: error });
    }
    throw new ExternalRequestError("External service unavailable", { status: 502, cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
