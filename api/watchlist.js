// /api/watchlist.js
// 관리자가 고른 종목 목록을 서버(Upstash Redis)에 저장하고,
// 누구나 조회할 수 있게 하는 API.
//
// GET  /api/watchlist        -> 현재 목록 조회 (누구나 가능)
// POST /api/watchlist        -> 목록 갱신 (관리자 비밀번호 필요)
//      body: { password: string, list: [{market, ticker}, ...] }
//      또는   { password: string, action: 'verify' } -> 비밀번호만 확인

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const STORAGE_KEY = 'watchlist:shared';

// Upstash 명령어 배열 방식: POST {KV_URL} body: ["SET", key, value]
// 이 방식은 값에 특수문자(쉼표, 슬래시 등)가 있어도 URL 인코딩 문제가 없어 안전하다.
async function redisCommand(commandArray) {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commandArray)
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Redis 응답 파싱 실패: ' + text);
  }
  if (!res.ok || data.error) {
    throw new Error('Redis 명령 실패: ' + (data.error || text));
  }
  return data.result;
}

async function kvGet(key) {
  const result = await redisCommand(['GET', key]);
  if (result == null) return null;
  try {
    return JSON.parse(result);
  } catch {
    return null;
  }
}

async function kvSet(key, value) {
  await redisCommand(['SET', key, JSON.stringify(value)]);
  return true;
}

function parseRequestBody(req) {
  let body = req.body;
  if (body == null) return {};
  if (typeof body === 'string') {
    if (body.trim() === '') return {};
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf-8'));
    } catch {
      return {};
    }
  }
  return body;
}

export default async function handler(req, res) {
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: '저장소가 아직 연결되지 않았습니다. (KV 환경변수 없음)' });
  }

  if (req.method === 'GET') {
    try {
      const list = await kvGet(STORAGE_KEY);
      return res.status(200).json({ list: Array.isArray(list) ? list : [] });
    } catch (err) {
      return res.status(500).json({ error: '목록을 불러오지 못했습니다: ' + err.message });
    }
  }

  if (req.method === 'POST') {
    const parsedBody = parseRequestBody(req);
    const password = parsedBody.password;
    const action = parsedBody.action;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return res.status(500).json({ error: '관리자 비밀번호가 설정되지 않았습니다.' });
    }
    if (password !== adminPassword) {
      return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    }

    if (action === 'verify') {
      try {
        const list = await kvGet(STORAGE_KEY);
        return res.status(200).json({ ok: true, list: Array.isArray(list) ? list : [] });
      } catch (err) {
        return res.status(200).json({ ok: true, list: [] });
      }
    }

    const list = parsedBody.list;
    if (!Array.isArray(list)) {
      return res.status(400).json({ error: '목록 형식이 올바르지 않습니다.' });
    }

    try {
      await kvSet(STORAGE_KEY, list);
      // 저장 직후 다시 읽어서 실제로 반영됐는지 검증
      const verify = await kvGet(STORAGE_KEY);
      if (!Array.isArray(verify)) {
        return res.status(500).json({ error: '저장은 시도했지만 확인에 실패했습니다.' });
      }
      return res.status(200).json({ ok: true, list: verify });
    } catch (err) {
      return res.status(500).json({ error: '목록을 저장하지 못했습니다: ' + err.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: '허용되지 않은 요청 방식입니다.' });
}
