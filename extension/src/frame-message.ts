export type EncryptedFrameCapture = {
  ciphertext: string;
  iv: string;
  type: "showhow-frame-capture";
};

const maxCiphertextBytes = 16 * 1024;

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function decode(value: string, maxBytes: number): Uint8Array<ArrayBuffer> {
  if (value.length > Math.ceil(maxBytes / 3) * 4) {
    throw new Error("Encrypted iframe capture is too large.");
  }
  const bytes = Uint8Array.from(atob(value), (character) =>
    character.charCodeAt(0),
  );
  if (bytes.length > maxBytes || encode(bytes) !== value) {
    throw new Error("Encrypted iframe capture is invalid.");
  }
  return bytes;
}

async function importFrameKey(key: string, usage: KeyUsage) {
  return crypto.subtle.importKey("raw", decode(key, 32), "AES-GCM", false, [
    usage,
  ]);
}

export function createFrameKey(): string {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}

export function normalizeEncryptedFrameCapture(
  value: unknown,
): EncryptedFrameCapture | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("type" in value) ||
    value.type !== "showhow-frame-capture" ||
    !("ciphertext" in value) ||
    typeof value.ciphertext !== "string" ||
    !("iv" in value) ||
    typeof value.iv !== "string"
  ) {
    return undefined;
  }

  try {
    const iv = decode(value.iv, 12);
    const ciphertext = decode(value.ciphertext, maxCiphertextBytes);
    if (iv.length !== 12 || ciphertext.length < 16) {
      return undefined;
    }
    return {
      ciphertext: encode(ciphertext),
      iv: encode(iv),
      type: "showhow-frame-capture",
    };
  } catch {
    return undefined;
  }
}

export function claimEncryptedFrameCapture(
  seenIvs: Set<string>,
  value: unknown,
): EncryptedFrameCapture | undefined {
  const message = normalizeEncryptedFrameCapture(value);
  if (!message || seenIvs.has(message.iv)) {
    return undefined;
  }
  seenIvs.add(message.iv);
  return message;
}

export function releaseEncryptedFrameCapture(
  seenIvs: Set<string>,
  message: EncryptedFrameCapture,
): void {
  seenIvs.delete(message.iv);
}

export async function encryptFrameCapture(
  capture: unknown,
  key: string,
): Promise<EncryptedFrameCapture> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(capture));
  if (plaintext.length + 16 > maxCiphertextBytes) {
    throw new Error("Iframe capture is too large.");
  }
  const ciphertext = await crypto.subtle.encrypt(
    { iv, name: "AES-GCM" },
    await importFrameKey(key, "encrypt"),
    plaintext,
  );

  return {
    ciphertext: encode(new Uint8Array(ciphertext)),
    iv: encode(iv),
    type: "showhow-frame-capture",
  };
}

export async function decryptFrameCapture<T>(
  message: EncryptedFrameCapture,
  key: string,
): Promise<T> {
  const normalized = normalizeEncryptedFrameCapture(message);
  if (!normalized) {
    throw new Error("Encrypted iframe capture is invalid.");
  }
  const plaintext = await crypto.subtle.decrypt(
    { iv: decode(normalized.iv, 12), name: "AES-GCM" },
    await importFrameKey(key, "decrypt"),
    decode(normalized.ciphertext, maxCiphertextBytes),
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
