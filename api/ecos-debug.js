// /api/ecos-debug.js
// 임시 진단용: ECOS 국고채(817Y002) 통계표의 세부 항목 코드를 확인하기 위한 함수.
// 정확한 10년물 코드를 찾은 뒤에는 이 파일을 삭제해도 됩니다.

export default async function handler(req, res) {
  const key = process.env.ECOS_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'ECOS_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  const url = `https://ecos.bok.or.kr/api/StatisticItemList/${key}/json/kr/1/100/817Y002`;

  try {
    const response = await fetch(url);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({ error: 'ECOS 응답 파싱 실패', raw: text.slice(0, 500) });
    }

    if (data.RESULT) {
      return res.status(200).json({ error: 'ECOS 오류', detail: data.RESULT });
    }

    const rows = data.StatisticItemList?.row || [];
    const simplified = rows.map(r => ({
      code: r.ITEM_CODE,
      name: r.ITEM_NAME,
      cycle: r.CYCLE
    }));

    return res.status(200).json({ count: simplified.length, items: simplified });
  } catch (err) {
    return res.status(500).json({ error: '요청 실패: ' + err.message });
  }
}
