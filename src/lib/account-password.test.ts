import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptValue, encryptValue } from './crypto';

type AccountPasswordModule = {
  validatePasswordChangeInput?: (input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => { success: boolean; error?: string };
  rotateUserEncryptedFields?: (input: {
    userId: string;
    oldDerivedKey: string;
    newDerivedKey: string;
    assets: Array<{ id: string; balance: string; costPrice: string | null }>;
    liabilities: Array<{
      id: string;
      principal: string;
      currentBalance: string;
      monthlyPayment: string | null;
    }>;
    possessions: Array<{
      id: string;
      purchasePrice: string;
      soldPrice: string | null;
    }>;
  }) => {
    assets: Array<{ id: string; balance: string; costPrice: string | null }>;
    liabilities: Array<{
      id: string;
      principal: string;
      currentBalance: string;
      monthlyPayment: string | null;
    }>;
    possessions: Array<{
      id: string;
      purchasePrice: string;
      soldPrice: string | null;
    }>;
  };
};

async function loadSubject(): Promise<AccountPasswordModule> {
  return await import('./account-password');
}

test('validatePasswordChangeInput accepts a valid password change and rejects unsafe input', async () => {
  const { validatePasswordChangeInput } = await loadSubject();
  assert.equal(typeof validatePasswordChangeInput, 'function');
  const validate = validatePasswordChangeInput as NonNullable<
    AccountPasswordModule['validatePasswordChangeInput']
  >;

  assert.deepEqual(
    validate({
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    }),
    { success: true },
  );
  assert.equal(
    validate({
      currentPassword: '',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    }).error,
    '请输入当前密码',
  );
  assert.equal(
    validate({
      currentPassword: 'old-password',
      newPassword: 'short',
      confirmPassword: 'short',
    }).error,
    '新密码至少需要 8 位',
  );
  assert.equal(
    validate({
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'other-password',
    }).error,
    '两次输入的新密码不一致',
  );
  assert.equal(
    validate({
      currentPassword: 'same-password',
      newPassword: 'same-password',
      confirmPassword: 'same-password',
    }).error,
    '新密码不能和当前密码相同',
  );
});

test('rotateUserEncryptedFields re-encrypts asset, liability, and possession secrets for the new password key', async () => {
  const { rotateUserEncryptedFields } = await loadSubject();
  assert.equal(typeof rotateUserEncryptedFields, 'function');
  const rotate = rotateUserEncryptedFields as NonNullable<
    AccountPasswordModule['rotateUserEncryptedFields']
  >;

  const userId = 'user-password-rotation';
  const oldDerivedKey = 'old-derived-key';
  const newDerivedKey = 'new-derived-key';
  const rotated = rotate({
    userId,
    oldDerivedKey,
    newDerivedKey,
    assets: [
      {
        id: 'asset-1',
        balance: encryptValue('123.4500', oldDerivedKey, userId),
        costPrice: encryptValue('100.0000', oldDerivedKey, userId),
      },
      {
        id: 'asset-2',
        balance: encryptValue('0.0000', oldDerivedKey, userId),
        costPrice: null,
      },
    ],
    liabilities: [
      {
        id: 'liability-1',
        principal: encryptValue('5000.0000', oldDerivedKey, userId),
        currentBalance: encryptValue('3200.0000', oldDerivedKey, userId),
        monthlyPayment: encryptValue('250.0000', oldDerivedKey, userId),
      },
      {
        id: 'liability-2',
        principal: encryptValue('800.0000', oldDerivedKey, userId),
        currentBalance: encryptValue('600.0000', oldDerivedKey, userId),
        monthlyPayment: null,
      },
    ],
    possessions: [
      {
        id: 'possession-1',
        purchasePrice: encryptValue('8799.00', oldDerivedKey, userId),
        soldPrice: encryptValue('3200.00', oldDerivedKey, userId),
      },
      {
        id: 'possession-2',
        purchasePrice: encryptValue('299.00', oldDerivedKey, userId),
        soldPrice: null,
      },
    ],
  });

  assert.equal(decryptValue(rotated.assets[0].balance, newDerivedKey, userId), '123.4500');
  assert.equal(decryptValue(rotated.assets[0].costPrice!, newDerivedKey, userId), '100.0000');
  assert.equal(rotated.assets[1].costPrice, null);
  assert.equal(decryptValue(rotated.liabilities[0].principal, newDerivedKey, userId), '5000.0000');
  assert.equal(decryptValue(rotated.liabilities[0].currentBalance, newDerivedKey, userId), '3200.0000');
  assert.equal(decryptValue(rotated.liabilities[0].monthlyPayment!, newDerivedKey, userId), '250.0000');
  assert.equal(rotated.liabilities[1].monthlyPayment, null);
  assert.equal(decryptValue(rotated.possessions[0].purchasePrice, newDerivedKey, userId), '8799.00');
  assert.equal(decryptValue(rotated.possessions[0].soldPrice!, newDerivedKey, userId), '3200.00');
  assert.equal(rotated.possessions[1].soldPrice, null);
  assert.throws(() => decryptValue(rotated.assets[0].balance, oldDerivedKey, userId));
});
