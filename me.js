export default async function handler(req, res) {
  const accessToken = req.cookies?.canva_access_token;

  if (!accessToken) {
    return res.json({ connected: false });
  }

  try {
    const meRes = await fetch('https://api.canva.com/rest/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (meRes.ok) {
      const data = await meRes.json();
      return res.json({
        connected: true,
        name: data?.profile?.display_name || 'Connected',
      });
    }

    // Token expired - try refresh
    const refreshToken = req.cookies?.canva_refresh_token;
    if (refreshToken) {
      return res.json({ connected: false, expired: true });
    }

    return res.json({ connected: false });
  } catch (err) {
    return res.json({ connected: false });
  }
}
