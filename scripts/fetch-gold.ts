import { fetchAndStoreGoldPrice } from '../src/lib/actions/gold';

async function main() {
  const result = await fetchAndStoreGoldPrice();
  if (result.success) {
    console.log('Gold price fetched successfully');
    process.exit(0);
  } else {
    console.error('Failed to fetch gold price:', result.error);
    process.exit(1);
  }
}

main();
