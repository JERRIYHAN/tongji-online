export function fakeRequest(routes) {
  const calls = [];
  return {
    calls,
    async fetch(url, options) { return this.get(url,options); },
    async get(url, options) {
      calls.push({ url, options });
      const u = new URL(url);
      const spec = typeof routes === 'function' ? routes(u) : routes[u.pathname];
      if (spec instanceof Error) throw spec;
      if (!spec) throw new Error('Unexpected test request');
      return {
        status: () => spec.status ?? 200,
        headers: () => ({ 'content-type': spec.type ?? 'application/json', link: spec.link ?? '' }),
        body: async () => Buffer.from(spec.body ?? JSON.stringify(spec.data)),
        dispose: async () => { calls.at(-1).disposed = true; }
      };
    }
  };
}
