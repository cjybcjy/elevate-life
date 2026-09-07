import {
  fetchWithAntiCrawl,
  type AntiCrawlFetchOptions,
} from '../anti-crawl';

interface PriceResult {
  code: string;
  name: string;
  price: number;
  market: string;
  currency: string;
  source: string;
}

export async function fetchGoldPrice(
  options?: AntiCrawlFetchOptions,
): Promise<PriceResult> {
  // Sina finance Shanghai Futures Exchange gold continuous contract
  // au9999 spot is no longer available; use nf_AU0 (黄金连续) instead
  const url = 'https://hq.sinajs.cn/list=nf_AU0';
  const { text } = await fetchWithAntiCrawl(
    url,
    'https://finance.sina.com.cn/',
    options,
  );

  // Response format: var hq_str_nf_AU0="黄金连续,时间,昨结算,最高,最低,...,最新价,买价,卖价,..."
  // Fields are comma-separated, current price is at index 6
  const match = text.match(/"([^"]+)"/);
  if (!match) {
    throw new Error('Failed to parse gold price response');
  }

  const fields = match[1].split(',');
  const price = parseFloat(fields[6]); // Current/latest price
  if (isNaN(price) || price <= 0) {
    throw new Error(`Invalid gold price from field[6]: ${fields[6]}`);
  }

  return {
    code: 'AU9999',
    name: '黄金9999',
    price,
    market: 'commodity',
    currency: 'CNY',
    source: 'sina',
  };
}
