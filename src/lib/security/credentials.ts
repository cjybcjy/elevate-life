import { constantTimeEqual } from './request';

export type RegistrationMode = 'closed' | 'invite' | 'open';

type Environment = Readonly<Record<string, string | undefined>>;

type RegistrationInput = {
  username?: unknown;
  password?: unknown;
  displayName?: unknown;
  inviteCode?: unknown;
};

type LoginInput = {
  username?: unknown;
  password?: unknown;
};

function passwordByteLength(password: string) {
  return Buffer.byteLength(password, 'utf8');
}

export function getRegistrationMode(env: Environment = process.env): RegistrationMode {
  const configured = env.REGISTRATION_MODE?.trim().toLowerCase();
  if (configured === 'closed' || configured === 'invite' || configured === 'open') {
    return configured;
  }

  return 'closed';
}

export function validateRegistrationPolicy(
  inviteCode: unknown,
  env: Environment = process.env,
) {
  const mode = getRegistrationMode(env);

  if (mode === 'closed') {
    return { success: false as const, error: '当前未开放自由注册，请联系管理员获取账号。' };
  }

  if (mode === 'invite') {
    const expectedCode = env.REGISTRATION_INVITE_CODE ?? '';
    const actualCode = typeof inviteCode === 'string' ? inviteCode.trim() : '';

    if (expectedCode.length < 16) {
      return { success: false as const, error: '邀请注册尚未正确配置，请联系管理员。' };
    }

    if (!constantTimeEqual(actualCode, expectedCode)) {
      return { success: false as const, error: '邀请码无效。' };
    }
  }

  return { success: true as const, mode };
}

export function validateRegistrationInput(input: RegistrationInput) {
  const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';

  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    return {
      success: false as const,
      error: '用户名需为 3–32 位小写字母、数字、点、下划线或连字符。',
    };
  }

  if ([...password].length < 12) {
    return { success: false as const, error: '密码至少需要 12 位。' };
  }

  if (passwordByteLength(password) > 72) {
    return { success: false as const, error: '密码 UTF-8 长度不能超过 72 字节。' };
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { success: false as const, error: '密码至少需要包含一个字母和一个数字。' };
  }

  if (displayName.length < 1 || displayName.length > 40) {
    return { success: false as const, error: '显示名称需为 1–40 个字符。' };
  }

  return {
    success: true as const,
    data: { username, password, displayName },
  };
}

export function validateLoginInput(input: LoginInput) {
  const username = typeof input.username === 'string' ? input.username.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (!username || username.length > 64 || !password || passwordByteLength(password) > 72) {
    return { success: false as const, error: 'Invalid credentials' };
  }

  return { success: true as const, data: { username, password } };
}
