import { execFileSync } from "node:child_process";
import { afterEach, expect, test, vi } from "vitest";

const nativeIterator = Object.getOwnPropertyDescriptor(ReadableStream.prototype, Symbol.asyncIterator);

afterEach(() => {
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, nativeIterator);
});

async function installFallback() {
  delete ReadableStream.prototype[Symbol.asyncIterator];
  vi.resetModules();
  await import("../src/stream-compat.js");
}

test("phonemizes without native stream async iteration in a fresh process", () => {
  const entry = new URL("../src/phonemize.js", import.meta.url).href;
  const result = execFileSync(process.execPath, ["--input-type=module", "-e", `
    delete ReadableStream.prototype[Symbol.asyncIterator];
    const { phonemize } = await import(${JSON.stringify(entry)});
    console.log(await phonemize("Hello World"));
  `], { encoding: "utf8", timeout: 15000 });
  expect(result.trim()).toBe("həlˈoʊ wˈɜːld");
});

test("preserves native stream iteration", async () => {
  vi.resetModules();
  await import("../src/stream-compat.js");
  expect(ReadableStream.prototype[Symbol.asyncIterator]).toBe(nativeIterator.value);
});

test("reads all chunks and releases the lock", async () => {
  await installFallback();
  const stream = new ReadableStream({ start(c) { c.enqueue("a"); c.enqueue("b"); c.close(); } });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(chunks).toEqual(["a", "b"]);
  expect(stream.locked).toBe(false);
});

test("cancels and unlocks on early exit", async () => {
  await installFallback();
  const cancel = vi.fn();
  const stream = new ReadableStream({ start(c) { c.enqueue("a"); }, cancel });
  for await (const chunk of stream) break;
  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
});

test("honors preventCancel on early exit", async () => {
  await installFallback();
  const cancel = vi.fn();
  const stream = new ReadableStream({ start(c) { c.enqueue("a"); }, cancel });
  for await (const chunk of stream[Symbol.asyncIterator]({ preventCancel: true })) break;
  expect(cancel).not.toHaveBeenCalled();
  expect(stream.locked).toBe(false);
});
