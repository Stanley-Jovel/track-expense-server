/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

// Drop-in replacement for buffer-equal-constant-time@1.0.1.
// The original references Buffer.SlowBuffer at module load, which was removed
// from Node.js in v22+. SlowBuffer was always just an alias for Buffer in
// modern Node, so patching only Buffer.prototype is sufficient.

const { Buffer } = require('buffer');

function bufferEq(a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) return false;
  if (a.length !== b.length) return false;
  let c = 0;
  for (let i = 0; i < a.length; i++) c |= a[i] ^ b[i];
  return c === 0;
}

const origBufEqual = Buffer.prototype.equal;
bufferEq.install = function () {
  Buffer.prototype.equal = function equal(that) {
    return bufferEq(this, that);
  };
};
bufferEq.restore = function () {
  Buffer.prototype.equal = origBufEqual;
};

module.exports = bufferEq;
