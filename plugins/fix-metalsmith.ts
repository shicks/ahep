// Wrapped version of Metalsmith that does a better job of watching,
// and provides some slightly nicer properties for plugins.

import Metalsmith from 'metalsmith';

type BuildFn = {
  (this: Metalsmith): Promise<Metalsmith.Files>;
  (this: Metalsmith, callback: Metalsmith.Callback): void;
};

const reportedErrors = new WeakSet<object>();
let errorCallback: undefined|((arg: Error|null) => void) = undefined;

function isObject(arg: unknown): arg is object {
  return (!!arg && typeof arg === 'object');
}

export function fix() {
  process.on('unhandledRejection', (err: unknown) => {
    if (isObject(err) && reportedErrors.has(err)) {
      return;
    } else if (err instanceof Error && errorCallback) {
      errorCallback(err);
    } else {
      throw err;
    }
  });

  Metalsmith.prototype.build = ((oldBuild: BuildFn) => {
    return function(this: Metalsmith, callback?: Metalsmith.Callback) {
      // Issue: when in watch mode, if there's an initial error,
      // we want to trap it rather than crash the whole program.
      // If we're watching files, then the unhandled rejection
      // should have us wait for a file change and try again...
      if (!callback) return (oldBuild as any).call(this);
      errorCallback = (err: Error|null) => {
        if (isObject(err) && reportedErrors.has(err)) return;
        if (isObject(err)) reportedErrors.add(err);
        callback(err, undefined!, this);
      }
      oldBuild.call(this, (err: Error|null, result: Metalsmith.Files) => {
        if (isObject(err) && errorCallback) {
          return errorCallback(err);
        } else {
          callback(null, result, this);
        }
      });
    } as any;
  })(Metalsmith.prototype.build);
}
