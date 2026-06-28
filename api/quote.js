// /api/quote.js
// Vercel 서버리스 함수: Finnhub API 키를 서버 쪽에 안전하게 숨기고,
// 브라우저에서는 이 함수만 호출해서 시세를 받아온다.

export default async function handler(req, res) {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: '종목 코드(symbol)가 필요합니다.' });
  }

  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({ error: `Finnhub 응답 오류: ${response.status}` });
    }

    const data = await response.json();

    // c: 현재가, pc: 전일종가, d: 변동값, dp: 변동률
    if (data.c === 0 && data.pc === 0) {
      return res.status(404).json({ error: '종목을 찾을 수 없습니다.' });
    }

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');
    return res.status(200).json({
      price: data.c,
      changePct: data.dp,
      previousClose: data.pc
    });
  } catch (err) {
    return res.status(500).json({ error: '시세를 가져오는 중 오류가 발생했습니다.' });
  }
}
