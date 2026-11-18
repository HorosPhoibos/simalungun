// Cloudflare Pages middleware: the whole site (including the copyrighted hymn lyrics in
// data/songbooks.json) is only served after the visitor enters the password once.
//
// Secret (set in Cloudflare, never in this repo):
//   SITE_PASSWORD  e.g. `npx wrangler pages secret put SITE_PASSWORD --project-name pustaha-simalungun`
//
// After login the browser gets an HttpOnly cookie signed with the password, valid for a year.
// Changing SITE_PASSWORD logs everyone out.

const COOKIE = 'pustaha_auth';
const LOGIN_PATH = '/__login';
const LOGOUT_PATH = '/__logout';
const SESSION_DAYS = 365;

// Only same-site paths are allowed as the post-login destination.
const safeNext = (value) => (typeof value === 'string' && /^\/(?!\/)/.test(value) ? value : '/');

const encoder = new TextEncoder();

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time comparison so the password can't be guessed from response timing.
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

async function hasValidSession(request, secret) {
  const token = readCookie(request, COOKIE);
  if (!token) return false;
  const [expires, sig] = token.split('.');
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  return safeEqual(sig, await sign(expires, secret));
}

function loginPage(error = '', status = 401, next = '/') {
  const html = `<!doctype html>
<html lang="id" translate="no">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<meta name="google" content="notranslate" />
<title>Simalungunku — Masuk</title>
<style>
  :root { --bg:#FAF8F5; --card:#fff; --text:#1c1917; --muted:#57534e; --line:#e7e5e4; --accent:#9A3412; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0f0e0d; --card:#181615; --text:#f5f5f4; --muted:#a8a29e; --line:#292524; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px; background:var(--bg); color:var(--text);
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  form { width:100%; max-width:360px; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:28px; }
  h1 { font-family: Georgia, serif; font-size:24px; margin:0 0 4px; }
  p { color:var(--muted); font-size:14px; margin:0 0 20px; line-height:1.5; }
  label { display:block; font-size:13px; font-weight:600; margin-bottom:6px; }
  input { width:100%; min-height:44px; padding:10px 14px; font-size:16px; border-radius:10px; border:1px solid var(--line);
          background:var(--bg); color:var(--text); }
  input:focus { outline:2px solid var(--accent); outline-offset:1px; }
  button { margin-top:14px; width:100%; min-height:44px; border:0; border-radius:10px; background:var(--accent); color:#fff;
           font-size:15px; font-weight:600; cursor:pointer; }
  .err { color:#b91c1c; font-size:13px; margin-top:10px; }
</style>
</head>
<body>
<form method="POST" action="${LOGIN_PATH}">
  <input type="hidden" name="next" value="${next.replace(/"/g, '&quot;')}" />
  <h1>Simalungunku</h1>
  <p>Kamus, Alkitab paralel, dan buku nyanyian. Masukkan kata sandi sekali saja; perangkat ini akan diingat selama setahun.</p>
  <label for="password">Kata sandi</label>
  <input id="password" name="password" type="password" autocomplete="current-password" autofocus required />
  <button type="submit">Masuk</button>
  ${error ? `<div class="err">${error}</div>` : ''}
</form>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const password = env.SITE_PASSWORD;

  if (!password) {
    return new Response('SITE_PASSWORD belum diatur di Cloudflare.', { status: 500 });
  }

  if (url.pathname === LOGIN_PATH && request.method === 'POST') {
    const form = await request.formData();
    const given = String(form.get('password') || '');
    const next = safeNext(String(form.get('next') || '/'));
    if (!(await safeEqual(given, password))) {
      return loginPage('Kata sandi salah.', 401, next);
    }
    const expires = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    const token = `${expires}.${await sign(expires, password)}`;
    return new Response(null, {
      status: 303,
      headers: {
        Location: next,
        'Set-Cookie': `${COOKIE}=${token}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  if (url.pathname === LOGIN_PATH) {
    return loginPage('', 200, safeNext(url.searchParams.get('next')));
  }

  if (url.pathname === LOGOUT_PATH) {
    return new Response(null, {
      status: 303,
      headers: { Location: '/', 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` },
    });
  }

  if (!(await hasValidSession(request, password))) {
    // Data files get a plain 401 (the app shows a login button); pages get the login form.
    if (url.pathname.startsWith('/data/')) {
      return new Response(JSON.stringify({ error: 'login required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
    return loginPage('', 401, safeNext(url.pathname + url.search));
  }

  const response = await next();
  // Protected content may be cached by the visitor's browser (offline use), never by shared caches.
  const headers = new Headers(response.headers);
  // HTML is revalidated on every visit so new deploys show up immediately.
  const isHtml = (headers.get('Content-Type') || '').includes('text/html');
  headers.set('Cache-Control', isHtml ? 'private, no-cache' : 'private, max-age=3600');
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
