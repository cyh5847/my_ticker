// /api/search.js
// 종목명이나 티커를 입력하면 미국주식/한국주식/코인/국채 후보를 찾아 반환한다.
// GET /api/search?q=검색어

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

// 한국 주요 종목 (코스피/코스닥 상위) - 종목명으로 검색, 자동완성용
// 코드는 한국거래소 공식 종목코드 기준
const KR_STOCKS = [
  { name: '삼성전자', code: '005930' },
  { name: '삼성전자우', code: '005935' },
  { name: 'SK하이닉스', code: '000660' },
  { name: 'LG에너지솔루션', code: '373220' },
  { name: '삼성바이오로직스', code: '207940' },
  { name: '현대차', code: '005380' },
  { name: '기아', code: '000270' },
  { name: '셀트리온', code: '068270' },
  { name: '삼성SDI', code: '006400' },
  { name: 'POSCO홀딩스', code: '005490' },
  { name: 'NAVER', code: '035420' },
  { name: '네이버', code: '035420' },
  { name: '카카오', code: '035720' },
  { name: '현대모비스', code: '012330' },
  { name: 'LG화학', code: '051910' },
  { name: '에코프로비엠', code: '247540' },
  { name: '삼성생명', code: '032830' },
  { name: 'SK스퀘어', code: '402340' },
  { name: 'KB금융', code: '105560' },
  { name: '신한지주', code: '055550' },
  { name: '하나금융지주', code: '086790' },
  { name: '삼성물산', code: '028260' },
  { name: 'LG전자', code: '066570' },
  { name: 'SK텔레콤', code: '017670' },
  { name: '삼성화재', code: '000810' },
  { name: '현대글로비스', code: '086280' },
  { name: '포스코퓨처엠', code: '003670' },
  { name: '한화에어로스페이스', code: '012450' },
  { name: '삼성에스디에스', code: '018260' },
  { name: '크래프톤', code: '259960' },
  { name: 'SK', code: '034730' },
  { name: 'LG', code: '003550' },
  { name: '두산에너빌리티', code: '034020' },
  { name: 'HD현대중공업', code: '329180' },
  { name: '한미반도체', code: '042700' },
];

// 자주 찾는 코인 (CoinGecko id 매핑)
const CRYPTO_LIST = [
  { name: '비트코인', en: 'Bitcoin', symbol: 'BTC', id: 'bitcoin' },
  { name: '이더리움', en: 'Ethereum', symbol: 'ETH', id: 'ethereum' },
  { name: '솔라나', en: 'Solana', symbol: 'SOL', id: 'solana' },
  { name: '리플', en: 'XRP', symbol: 'XRP', id: 'ripple' },
  { name: '도지코인', en: 'Dogecoin', symbol: 'DOGE', id: 'dogecoin' },
  { name: '카르다노', en: 'Cardano', symbol: 'ADA', id: 'cardano' },
  { name: '아발란체', en: 'Avalanche', symbol: 'AVAX', id: 'avalanche-2' },
  { name: '폴카닷', en: 'Polkadot', symbol: 'DOT', id: 'polkadot' },
  { name: '체인링크', en: 'Chainlink', symbol: 'LINK', id: 'chainlink' },
  { name: '라이트코인', en: 'Litecoin', symbol: 'LTC', id: 'litecoin' },
  { name: '바이낸스코인', en: 'BNB', symbol: 'BNB', id: 'binancecoin' },
  { name: '트론', en: 'Tron', symbol: 'TRX', id: 'tron' },
  { name: '시바이누', en: 'Shiba Inu', symbol: 'SHIB', id: 'shiba-inu' },
  { name: '톤코인', en: 'Toncoin', symbol: 'TON', id: 'the-open-network' },
];

const BOND_ITEM = { name: '한국 국채 10년물', code: 'KR10Y' };

function searchKrStocks(q) {
  return KR_STOCKS
    .filter(s => s.name.includes(q) || s.code.includes(q))
    .slice(0, 6)
    .map(s => ({ market: 'kr', ticker: s.code, label: s.name }));
}

function searchCrypto(q) {
  const lower = q.toLowerCase();
  return CRYPTO_LIST
    .filter(c => c.name.includes(q) || c.en.toLowerCase().includes(lower) || c.symbol.toLowerCase().includes(lower))
    .slice(0, 6)
    .map(c => ({ market: 'crypto', ticker: c.symbol, label: `${c.name} (${c.symbol})` }));
}

function searchBond(q) {
  if (BOND_ITEM.name.includes(q) || '국채'.includes(q) || q.includes('국채') || q.toLowerCase().includes('bond')) {
    return [{ market: 'bond', ticker: BOND_ITEM.code, label: BOND_ITEM.name }];
  }
  return [];
}

async function searchUS(q) {
  if (!FINNHUB_KEY) return [];
  try {
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${FINNHUB_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const results = data.result || [];
    return results
      .filter(r => r.type === 'Common Stock' && !r.symbol.includes('.'))
      .slice(0, 6)
      .map(r => ({ market: 'us', ticker: r.symbol, label: `${r.symbol} - ${r.description}` }));
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(200).json({ results: [] });
  }

  const [usResults] = await Promise.all([searchUS(q)]);
  const krResults = searchKrStocks(q);
  const cryptoResults = searchCrypto(q);
  const bondResults = searchBond(q);

  const results = [...bondResults, ...krResults, ...cryptoResults, ...usResults].slice(0, 15);

  return res.status(200).json({ results });
}
