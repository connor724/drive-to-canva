export default async function handler(req, res) {
  const refreshToken = req.cookies?.canva_refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const tokenRes = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(401).json({ error: 'Refresh failed' });
    }

    res.setHeader('Set-Cookie', [
      `canva_access_token=${tokenData.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=14400`,
      `canva_refresh_token=${tokenData.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    ]);

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
