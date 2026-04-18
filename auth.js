import crypto from 'crypto';

export default async function handler(req, res) {
  const clientId = process.env.CANVA_CLIENT_ID;
  const redirectUri = process.env.REDIRECT_URI;

  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(64).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  const state = crypto.randomBytes(16).toString('hex');

  const scopes = [
    'asset:read',
    'asset:write',
    'folder:read',
    'folder:write',
    'profile:read',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  // Store code_verifier and state in cookies so callback can use them
  res.setHeader('Set-Cookie', [
    `code_verifier=${codeVerifier}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
    `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
  ]);

  return res.redirect(`https://www.canva.com/api/oauth/authorize?${params}`);
}
