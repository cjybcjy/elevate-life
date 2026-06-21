import { connection } from 'next/server';

type EnvMap = Record<string, string | undefined>;

export type PublicReleaseContact = {
  supportEmail: string;
  supportHref: string;
};

const DEFAULT_SUPPORT_EMAIL = 'support@example.com';

export function buildPublicReleaseContact(env: EnvMap = process.env): PublicReleaseContact {
  const supportEmail = (env.APP_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL).trim() || DEFAULT_SUPPORT_EMAIL;

  return {
    supportEmail,
    supportHref: `mailto:${supportEmail}`,
  };
}

export async function getPublicReleaseContact(env: EnvMap = process.env): Promise<PublicReleaseContact> {
  await connection();
  return buildPublicReleaseContact(env);
}
