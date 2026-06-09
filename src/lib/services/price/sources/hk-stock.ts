import { fetchWithAntiCrawl } from '../anti-crawl';

interface PriceResult {
  code: string;
  name: string;
  price: number;
  market: string;
  currency: string;
  source: string;
}

function padCode(code: string): string {
  // HK stock codes are 5 digits: 00700, 09988
  return code.padStart(5, '0');
}

export async function fetchHkStockPrice(code: string): Promise<PriceResult> {
  const paddedCode = padCode(code);

  // Tencent finance API
  const url = `https://qt.gtimg.cn/q=hk${paddedCode}`;
  const { text } = await fetchWithAntiCrawl(url, 'https://gu.qq.com/');

  // Response format: v_hk00700="..."
  const match = text.match(/"([^"]+)"/);
  if (!match || !match[1]) {
    throw new Error(`HK stock ${code} not found`);
  }

  const fields = match[1].split('~');
  // Fields: [0] unknown, [1] name, [2] price, [3] change, ...
  const name = fields[1];
  const price = parseFloat(fields[3]); // Current price

  if (isNaN(price) || price === 0) {
    throw new Error(`Invalid price for HK stock ${code}: ${fields[3]}`);
  }

  return {
    code,
    name,
    price,
    market: 'hk',
    currency: 'HKD',
    source: 'tencent',
  };
}
