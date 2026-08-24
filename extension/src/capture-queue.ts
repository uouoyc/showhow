function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export class CaptureQueueStoppedError extends Error {}

export class SerialCaptureQueue {
  private accepting = true;
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly minimumDelayMs: number) {}

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    if (!this.accepting) {
      return Promise.reject(
        new CaptureQueueStoppedError("Capture queue is stopped."),
      );
    }

    const run = this.tail.then(task);

    this.tail = run.then(
      () => delay(this.minimumDelayMs),
      () => delay(this.minimumDelayMs),
    );
    return run;
  }

  stop(): Promise<void> {
    this.accepting = false;
    return this.tail;
  }
}

export async function retryUpload(task: () => Promise<void>): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      await task();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
