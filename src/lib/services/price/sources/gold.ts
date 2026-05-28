import { fetchWithAntiCrawl } from '../anti-crawl';

interface PriceResult {
  code: string;
  name: string;
  price: number;
  market: string;
  source: string;
}

export async function fetchGoldPrice(): Promise<PriceResult> {
  // Sina finance gold API - AU9999
  const url = 'https://hq.sinajs.cn/list=au9999';
  const { text } = await fetchWithAntiCrawl(url, 'https://finance.sina.com.cn/');

  // Response format: var hq_str_au9999="..."
  // Fields are comma-separated, price is typically field index 3
  const match = text.match(/"([^"]+)"/);
  if (!match) {
    throw new Error(`Failed to parse gold price response`);
  }

  const fields = match[1].split(',');
  const price = parseFloat(fields[3]); // Current price field
  if (isNaN(price)) {
    throw new Error(`Invalid gold price: ${fields[3]}`);
  }

  return {
    code: 'AU9999',
    name: '黄金9999',
    price,
    market: 'commodity',
    source: 'sina',
  };
}
