import { fetchWithAntiCrawl } from '../anti-crawl';

interface PriceResult {
  code: string;
  name: string;
  price: number;
  market: string;
  source: string;
}

function detectExchange(code: string): string {
  // Shanghai: 6xxxxx, Shenzhen: 0xxxxx, 3xxxxx (ChiNext)
  if (code.startsWith('6')) return 'sh';
  return 'sz';
}

export async function fetchCnStockPrice(code: string): Promise<PriceResult> {
  const exchange = detectExchange(code);
  const fullCode = `${exchange}${code}`;

  // Sina finance API
  const url = `https://hq.sinajs.cn/list=${fullCode}`;
  const { text } = await fetchWithAntiCrawl(url, 'https://finance.sina.com.cn/');

  const match = text.match(/"([^"]+)"/);
  if (!match || !match[1]) {
    throw new Error(`Stock ${code} not found or delisted`);
  }

  const fields = match[1].split(',');
  const name = fields[0];
  const price = parseFloat(fields[3]); // Current price

  if (isNaN(price) || price === 0) {
    throw new Error(`Invalid price for stock ${code}: ${fields[3]}`);
  }

  return {
    code,
    name,
    price,
    market: 'cn',
    source: 'sina',
  };
}
