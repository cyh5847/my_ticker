// /api/watchlist.js
// 관리자가 고른 종목 목록을 서버(Upstash Redis)에 저장하고,
// 누구나 조회할 수 있게 하는 API.
//
// GET  /api/watchlist        -> 현재 목록 조회 (누구나 가능)
// POST /api/watchlist        -> 목록 갱신 (관리자 비밀번호 필요)
//      body: { password: string, list: [{market, ticker}, ...] }

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const STORAGE_KEY = 'watchlist:shared';

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  if (!res.ok) throw new Error('KV get 실패');
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(JSON.stringify(value))
  });
  if (!res.ok) throw new Error('KV set 실패');
  return true;
}

export default async function handler(req, res) {
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: '저장소가 아직 연결되지 않았습니다.' });
  }

  if (req.method === 'GET') {
    try {
      const list = await kvGet(STORAGE_KEY);
      return res.status(200).json({ list: list || [] });
    } catch (err) {
      return res.status(500).json({ error: '목록을 불러오지 못했습니다.' });
    }
  }

  if (req.method === 'POST') {
    const { password, list } = req.body || {};
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return res.status(500).json({ error: '관리자 비밀번호가 설정되지 않았습니다.' });
    }
    if (password !== adminPassword) {
      return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    }
    if (!Array.isArray(list)) {
      return res.status(400).json({ error: '목록 형식이 올바르지 않습니다.' });
    }

    try {
      await kvSet(STORAGE_KEY, list);
      return res.status(200).json({ ok: true, list });
    } catch (err) {
      return res.status(500).json({ error: '목록을 저장하지 못했습니다.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: '허용되지 않은 요청 방식입니다.' });
}
