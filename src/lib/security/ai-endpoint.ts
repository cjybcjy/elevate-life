const BUILT_IN_AI_HOSTS = new Set([
  'api.openai.com',
  'api.deepseek.com',
  'api.moonshot.ai',
  'api.minimax.io',
]);

function configuredAiHosts() {
  return (process.env.AI_ALLOWED_ENDPOINT_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^[a-z0-9.-]+$/.test(host));
}

export function assertAllowedAiEndpoint(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new FinanceAiInputError('AI API 地址格式无效');
  }

  if (url.protocol !== 'https:') {
    throw new FinanceAiInputError('AI API 地址必须使用 HTTPS');
  }

  if (url.username || url.password || (url.port && url.port !== '443')) {
    throw new FinanceAiInputError('AI API 地址不能包含凭据或非标准端口');
  }

  const hostname = url.hostname.toLowerCase();
  const allowedHosts = new Set([...BUILT_IN_AI_HOSTS, ...configuredAiHosts()]);

  if (!allowedHosts.has(hostname)) {
    throw new FinanceAiInputError('该 AI API 域名未获服务器允许');
  }

  return url.toString();
}
import { FinanceAiInputError } from '@/lib/finance-ai';
