import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isRecordedTab,
  retryUpload,
  SerialCaptureQueue,
} from "../src/capture-queue";

test("Recording accepts captures only from its original active tab", () => {
  assert.equal(isRecordedTab(7, 7, 7), true);
  assert.equal(isRecordedTab(7, 8, 8), false);
  assert.equal(isRecordedTab(7, 7, 8), false);
});

test("capture queue preserves order, spacing, and stop semantics", async () => {
  const queue = new SerialCaptureQueue(10);
  const order: number[] = [];
  const starts: number[] = [];

  const captures = [1, 2, 3].map((value) =>
    queue.enqueue(async () => {
      order.push(value);
      if (value === 1) {
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      starts.push(performance.now());
      return value;
    }),
  );
  const stopped = queue.stop();

  await assert.rejects(
    queue.enqueue(async () => 4),
    /stopped/i,
  );
  assert.deepEqual(await Promise.all(captures), [1, 2, 3]);
  await stopped;
  assert.deepEqual(order, [1, 2, 3]);
  assert.equal(starts[1] - starts[0] >= 8, true);
  assert.equal(starts[2] - starts[1] >= 8, true);
});

test("failed upload is retried three times", async () => {
  let attempts = 0;
  await retryUpload(async () => {
    attempts++;
    if (attempts < 4) {
      throw new Error("temporary failure");
    }
  });

  assert.equal(attempts, 4);
});
