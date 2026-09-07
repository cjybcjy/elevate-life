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

export async function fetchUsStockPrice(
  code: string,
  options?: AntiCrawlFetchOptions,
): Promise<PriceResult> {
  const upperCode = code.toUpperCase();

  // Sina finance US stock API
  const url = `https://hq.sinajs.cn/list=gb_${upperCode.toLowerCase()}`;
  const { text } = await fetchWithAntiCrawl(
    url,
    'https://finance.sina.com.cn/',
    options,
  );

  const match = text.match(/"([^"]+)"/);
  if (!match || !match[1]) {
    throw new Error(`US stock ${upperCode} not found`);
  }

  const fields = match[1].split(',');
  const name = fields[0];
  const price = parseFloat(fields[1]); // Current price in USD

  if (isNaN(price) || price === 0) {
    throw new Error(`Invalid price for US stock ${upperCode}: ${fields[1]}`);
  }

  return {
    code: upperCode,
    name,
    price,
    market: 'us',
    currency: 'USD',
    source: 'sina',
  };
}
