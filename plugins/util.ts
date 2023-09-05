export function augment(err: unknown,
                        fn: string|((arg: string) => string),
                        tag?: symbol,
                        tagValue?: unknown): Error {
  if (!(err instanceof Error)) {
    return augment(new Error(String(err)), fn, tag, tagValue);
  }
  if (tag) {
    if ((err as any)[tag] === tagValue) return err;
    (err as any)[tag!] = tagValue;
  }
  const f = (typeof fn === 'string') ? (msg: string) => `${msg} ${fn}` : fn;
  err.message = f(err.message || '');
  return err;
}
