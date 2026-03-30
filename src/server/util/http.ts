export async function waitFor<T>(task: () => Promise<T>, options?: { retries?: number; delayMs?: number }) {
  const retries = options?.retries ?? 30;
  const delayMs = options?.delayMs ?? 1000;

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('waitFor exhausted retries');
}
