export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const redirectUri = process.env.REDIRECT_URI;

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenRes = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: req.cookies?.code_verifier || '',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', tokenData);
      return res.redirect(`/?error=${encodeURIComponent('Token exchange failed: ' + (tokenData.message || 'Unknown error'))}`);
    }

    // Store tokens in cookies (httpOnly for security)
    res.setHeader('Set-Cookie', [
      `canva_access_token=${tokenData.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=14400`,
      `canva_refresh_token=${tokenData.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    ]);

    return res.redirect('/?connected=true');
  } catch (err) {
    console.error('Callback error:', err);
    return res.redirect(`/?error=${encodeURIComponent('Server error during authentication')}`);
  }
}
