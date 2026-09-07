import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  assetCurrencyOptions,
  AssetCurrencySelect,
} from './AssetManager';

test('asset creation uses the same labeled currency select at every viewport', () => {
  assert.deepEqual(assetCurrencyOptions, [
    { value: 'CNY', name: '人民币', symbol: '¥' },
    { value: 'HKD', name: '港币', symbol: 'HK$' },
    { value: 'USD', name: '美元', symbol: '$' },
    { value: 'JPY', name: '日元', symbol: 'JP¥' },
  ]);

  const markup = renderToStaticMarkup(<AssetCurrencySelect />);

  assert.match(markup, /class="min-w-44"/);
  assert.doesNotMatch(markup, /md:hidden|desktopCurrency/);
  assert.match(markup, /<label[^>]*for="asset-currency"[^>]*>币种<\/label>/);
  assert.match(markup, /<select[^>]*id="asset-currency"[^>]*name="currency"/);
  assert.match(markup, /<option value="CNY" selected="">人民币（CNY ¥）<\/option>/);
  assert.match(markup, /<option value="HKD">港币（HKD HK\$）<\/option>/);
  assert.match(markup, /<option value="USD">美元（USD \$）<\/option>/);
  assert.match(markup, /<option value="JPY">日元（JPY JP¥）<\/option>/);
  assert.doesNotMatch(markup, /<input[^>]*name="currency"/);
});
