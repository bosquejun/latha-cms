import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { encodeS3Path, signS3Request } from './sigv4.js'

test('encodeS3Path percent-encodes each segment but keeps slashes literal', () => {
  assert.equal(encodeS3Path('/a b/c$d.txt'), '/a%20b/c%24d.txt')
  assert.equal(encodeS3Path('/photo.jpg'), '/photo.jpg')
})

/**
 * Recomputes the expected SigV4 signature straight from the spec (canonical
 * request -> string-to-sign -> HMAC signing-key chain) using only `node:crypto`
 * primitives, independent of `signS3Request`'s internals, so this catches
 * algorithmic regressions rather than just re-asserting the implementation.
 */
function expectedAuthorization(opts: {
  method: string
  host: string
  path: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  payloadHash: string
  amzDate: string
}): string {
  const dateStamp = opts.amzDate.slice(0, 8)
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders =
    `host:${opts.host}\n` + `x-amz-content-sha256:${opts.payloadHash}\n` + `x-amz-date:${opts.amzDate}\n`
  const canonicalRequest = [
    opts.method,
    opts.path,
    '',
    canonicalHeaders,
    signedHeaders,
    opts.payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${opts.region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    opts.amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n')

  const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest()
  const kDate = hmac('AWS4' + opts.secretAccessKey, dateStamp)
  const kRegion = hmac(kDate, opts.region)
  const kService = hmac(kRegion, 's3')
  const kSigning = hmac(kService, 'aws4_request')
  const signature = hmac(kSigning, stringToSign).toString('hex')

  return (
    `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`
  )
}

test('signS3Request matches an independently-derived SigV4 signature', () => {
  const opts = {
    method: 'PUT' as const,
    host: 'examplebucket.s3.us-east-1.amazonaws.com',
    path: '/test.txt',
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    payloadHash: createHash('sha256').update('hello world').digest('hex'),
    now: new Date('2013-05-24T00:00:00Z'),
  }

  const headers = signS3Request(opts)

  assert.equal(headers['x-amz-date'], '20130524T000000Z')
  assert.equal(headers['x-amz-content-sha256'], opts.payloadHash)
  assert.equal(headers.authorization, expectedAuthorization({ ...opts, amzDate: '20130524T000000Z' }))
})

test('signS3Request defaults the payload hash to the empty-body digest (for DELETE)', () => {
  const headers = signS3Request({
    method: 'DELETE',
    host: 'examplebucket.s3.us-east-1.amazonaws.com',
    path: '/test.txt',
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    now: new Date('2013-05-24T00:00:00Z'),
  })

  assert.equal(
    headers['x-amz-content-sha256'],
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  )
})

test('changing the secret key changes the signature', () => {
  const base = {
    method: 'PUT' as const,
    host: 'examplebucket.s3.us-east-1.amazonaws.com',
    path: '/test.txt',
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    payloadHash: createHash('sha256').update('hello world').digest('hex'),
    now: new Date('2013-05-24T00:00:00Z'),
  }

  const a = signS3Request({ ...base, secretAccessKey: 'secret-one' })
  const b = signS3Request({ ...base, secretAccessKey: 'secret-two' })
  assert.notEqual(a.authorization, b.authorization)
})
