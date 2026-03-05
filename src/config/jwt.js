'use strict';
const fs = require('fs');
const path = require('path');

let privateKey, publicKey;

try {
  privateKey = fs.readFileSync(path.resolve(process.env.JWT_PRIVATE_KEY_PATH || './secrets/private.pem'), 'utf8');
  publicKey  = fs.readFileSync(path.resolve(process.env.JWT_PUBLIC_KEY_PATH  || './secrets/public.pem'),  'utf8');
} catch (e) {
  // In dev, we can fall back to HS256 with a secret
  console.warn('[JWT] RSA key files not found — falling back to HS256 with JWT_SECRET for development only');
  privateKey = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
  publicKey  = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
}

const useRsa = privateKey.startsWith('-----BEGIN');

module.exports = {
  privateKey,
  publicKey,
  algorithm:   useRsa ? 'RS256' : 'HS256',
  accessTokenExpiry:  process.env.ACCESS_TOKEN_EXPIRY  || '15m',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
};
