// /api/bond.js
// 한국은행 ECOS의 시장금리(817Y002) 통계표에서 만기별 금리를 가져온다.
// 주식과 달리 일별 데이터이며, 보통 전 영업일 기준으로 갱신된다.
//
// GET /api/bond?item=KR10Y  (기본값: KR10Y)

const ECOS_KEY = process.env.ECOS_API_KEY;
const STAT_CODE = '817Y002'; // 시장금리(일별)

// 화면/검색에서 쓰는 짧은 코드 -> ECOS 항목코드 매핑
const ITEM_MAP = {
  CALL1D:  { code: '010101000', label: '콜금리(1일물)' },
  KR1Y:    { code: '010190000', label: '국고채(1년)' },
  KR3Y:    { code: '010200000', label: '국고채(3년)' },
  KR5Y:    { code: '010195000', label: '국고채(5년)' },
  KR10Y:   { code: '010210000', label: '국고채(10년)' },
  KR20Y:   { code: '010220000', label: '국고채(20년)' },
  KR30Y:   { code: '010240000', label: '국고채(30년)' },
  CORP3Y:  { code: '010300000', label: '회사채(3년,AA-)' },
};

function formatDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

export default async function handler(req, res) {
  if (!ECOS_KEY) {
    return res.status(500).json({ error: 'ECOS_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  const itemKey = (req.query.item || 'KR10Y').toUpperCase();
  const item = ITEM_MAP[itemKey];
  if (!item) {
    return res.status(400).json({ error: '알 수 없는 항목입니다: ' + itemKey });
  }

  const today = new Date();
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const startDate = formatDate(twoWeeksAgo);
  const endDate = formatDate(today);

  const url = `https://ecos.bok.or.kr/api/StatisticSearch/${ECOS_KEY}/json/kr/1/20/${STAT_CODE}/D/${startDate}/${endDate}/${item.code}`;

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
      label: item.label,
      unit: '%'
    });
  } catch (err) {
    return res.status(500).json({ error: '요청 실패: ' + err.message });
  }
}
