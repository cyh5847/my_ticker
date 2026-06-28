// /api/quote-kr.js
// Vercel 서버리스 함수: 한국 주식 시세를 서버 쪽에서 가져온다.
// 브라우저가 아닌 서버에서 호출하므로 CORS 제약을 받지 않는다.

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: '종목 코드(code)가 필요합니다.' });
  }

  const cleanCode = code.replace(/[^0-9]/g, '');
  if (cleanCode.length !== 6) {
    return res.status(400).json({ error: '올바른 6자리 종목 코드를 입력해주세요. (예: 005930)' });
  }

  try {
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
    const tenDaysAgo = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);

    const url = `https://fchart.stock.naver.com/siseJson.nhn?symbol=${cleanCode}&requestType=1&startTime=${fmt(tenDaysAgo)}&endTime=${fmt(today)}&timeframe=day`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) {
      return res.status(502).json({ error: '네이버 금융 응답 오류' });
    }

    const text = await response.text();
    // 응답이 JS 배열 리터럴 형태이므로 파싱
    const cleaned = text.replace(/'/g, '"');
    let rows;
    try {
      rows = JSON.parse(cleaned);
    } catch {
      return res.status(404).json({ error: '종목을 찾을 수 없습니다.' });
    }

    // rows[0]는 헤더, 마지막 유효 행이 최신 시세
    const dataRows = rows.slice(1).filter(r => r && r.length >= 6 && r[4] != null);
    if (dataRows.length === 0) {
      return res.status(404).json({ error: '시세 데이터가 없습니다.' });
    }

    const latest = dataRows[dataRows.length - 1];
    const prev = dataRows.length >= 2 ? dataRows[dataRows.length - 2] : null;

    // [날짜, 시가, 고가, 저가, 종가, 거래량]
    const close = latest[4];
    const open = latest[1];
    const prevClose = prev ? prev[4] : open;
    const changePct = prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : 0;

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json({
      price: close,
      changePct,
      previousClose: prevClose
    });
  } catch (err) {
    return res.status(500).json({ error: '시세를 가져오는 중 오류가 발생했습니다.' });
  }
}
