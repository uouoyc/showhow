import assert from "node:assert/strict";
import { test } from "node:test";
import {
  claimEncryptedFrameCapture,
  createFrameKey,
  decryptFrameCapture,
  encryptFrameCapture,
  normalizeEncryptedFrameCapture,
  releaseEncryptedFrameCapture,
} from "../src/frame-message";

test("iframe capture data is private and authenticated", async () => {
  const key = createFrameKey();
  const capture = {
    clickX: 42,
    elementLabel: "button Private account",
    pageUrl: "https://private.example/account",
  };
  const encrypted = await encryptFrameCapture(capture, key);

  assert.equal(JSON.stringify(encrypted).includes("Private account"), false);
  assert.deepEqual(await decryptFrameCapture(encrypted, key), capture);
  const seenIvs = new Set<string>();
  assert.deepEqual(claimEncryptedFrameCapture(seenIvs, encrypted), encrypted);
  assert.equal(claimEncryptedFrameCapture(seenIvs, encrypted), undefined);
  assert.equal(
    normalizeEncryptedFrameCapture({
      ...encrypted,
      iv: ` ${encrypted.iv}`,
    }),
    undefined,
  );
  assert.equal(
    normalizeEncryptedFrameCapture({
      ...encrypted,
      ciphertext: "A".repeat(30_000),
    }),
    undefined,
  );

  const tampered = {
    ...encrypted,
    ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA`,
  };
  const invalidIvs = new Set<string>();
  const claimedTampered = claimEncryptedFrameCapture(invalidIvs, tampered);
  assert.ok(claimedTampered);
  await assert.rejects(decryptFrameCapture(claimedTampered, key));
  releaseEncryptedFrameCapture(invalidIvs, claimedTampered);
  assert.equal(invalidIvs.size, 0);
});
