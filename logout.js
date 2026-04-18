export default function handler(req, res) {
  res.setHeader('Set-Cookie', [
    'canva_access_token=; Path=/; HttpOnly; Max-Age=0',
    'canva_refresh_token=; Path=/; HttpOnly; Max-Age=0',
  ]);
  res.redirect('/');
}
