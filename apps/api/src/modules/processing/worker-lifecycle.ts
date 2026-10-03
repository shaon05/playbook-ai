export type WorkerLoopOptions = {
  runOnce: () => Promise<boolean>;
  pollIntervalMs: number;
  signal: AbortSignal;
  onError?: (error: unknown) => void;
};

function waitForPoll(signal: AbortSignal, intervalMs: number) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, intervalMs);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function runWorkerLoop({ runOnce, pollIntervalMs, signal, onError }: WorkerLoopOptions) {
  while (!signal.aborted) {
    try {
      const processed = await runOnce();
      if (processed || signal.aborted) continue;
    } catch (error) {
      onError?.(error);
    }
    await waitForPoll(signal, pollIntervalMs);
  }
}
