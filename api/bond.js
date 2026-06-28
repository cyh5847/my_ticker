// /api/bond.js
// 한국 국채 10년물 금리를 한국은행 ECOS에서 가져온다.
// 주식과 달리 일별 데이터이며, 보통 전 영업일 기준으로 갱신된다.

const ECOS_KEY = process.env.ECOS_API_KEY;
const STAT_CODE = '817Y002';   // 시장금리(일별)
const ITEM_CODE = '010210000'; // 국고채(10년)

function formatDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

export default async function handler(req, res) {
  if (!ECOS_KEY) {
    return res.status(500).json({ error: 'ECOS_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  const today = new Date();
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const startDate = formatDate(twoWeeksAgo);
  const endDate = formatDate(today);

  // 최근 20개 행 정도를 가져와서, 그중 가장 최신 값을 쓴다 (휴일/주말 보정)
  const url = `https://ecos.bok.or.kr/api/StatisticSearch/${ECOS_KEY}/json/kr/1/20/${STAT_CODE}/D/${startDate}/${endDate}/${ITEM_CODE}`;

  try {
    const response = await fetch(url);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({ error: 'ECOS 응답 파싱 실패' });
    }

    if (data.RESULT) {
      return res.status(500).json({ error: 'ECOS 오류: ' + (data.RESULT.MESSAGE || JSON.stringify(data.RESULT)) });
    }

    const rows = data.StatisticSearch?.row;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: '데이터가 없습니다.' });
    }

    // 날짜(TIME) 기준 오름차순이라고 가정하고 마지막(최신) 값을 사용
    const sorted = [...rows].sort((a, b) => a.TIME.localeCompare(b.TIME));
    const latest = sorted[sorted.length - 1];
    const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

    const value = parseFloat(latest.DATA_VALUE);
    const prevValue = prev ? parseFloat(prev.DATA_VALUE) : value;
    const changePct = prevValue !== 0 ? ((value - prevValue) / prevValue) * 100 : 0;

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({
      price: value,
      changePct,
      date: latest.TIME,
      unit: '%'
    });
  } catch (err) {
    return res.status(500).json({ error: '요청 실패: ' + err.message });
  }
}
