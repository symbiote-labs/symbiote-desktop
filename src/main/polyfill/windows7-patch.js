console.info('inject polyfill win7')

// fix for node_modules\@libsql\isomorphic-fetch\node.cjs
if (!globalThis.fetch) {
  globalThis.fetch = require('node-fetch')
}

if (!globalThis.Request) {
  const { Request, Headers } = require('node-fetch')
  globalThis.Request = Request
  globalThis.Headers = Headers
}
// fix for node_modules/undici/lib/web/fetch/webidl.js
if (!globalThis.Blob) {
  const { Blob } = require('blob-polyfill')
  globalThis.Blob = Blob
}

// fix for node_modules/undici/lib/web/fetch/webidl.js
if (!globalThis.ReadableStream) {
  const { ReadableStream, TransformStream } = require('web-streams-polyfill')
  globalThis.ReadableStream = ReadableStream
  globalThis.TransformStream = TransformStream
  console.log('ReadableStream', ReadableStream)
}

if (!globalThis.DOMException) {
  globalThis.DOMException = require('domexception')
}

if (!globalThis.crypto) {
  const { Crypto } = require('@peculiar/webcrypto')
  globalThis.crypto = new Crypto()
}

console.info('inject polyfill win7 ok')
