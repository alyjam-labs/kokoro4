// phonemizer reads its compressed voice data with `for await...of` during
// initialization. Older Safari versions have streams but no async iterator.
if (typeof ReadableStream !== "undefined" && !ReadableStream.prototype[Symbol.asyncIterator]) {
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, {
    configurable: true,
    writable: true,
    value: async function* ({ preventCancel = false } = {}) {
      const reader = this.getReader();
      let finished = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            finished = true;
            return;
          }
          yield value;
        }
      } finally {
        try {
          if (!finished && !preventCancel) await reader.cancel();
        } finally {
          reader.releaseLock();
        }
      }
    },
  });
}
