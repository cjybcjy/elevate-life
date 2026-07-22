import { decryptValue, encryptValue } from '@/lib/crypto';

type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type EncryptedAssetRecord = {
  id: string;
  balance: string;
  costPrice: string | null;
};

type EncryptedLiabilityRecord = {
  id: string;
  principal: string;
  currentBalance: string;
  monthlyPayment: string | null;
};

type EncryptedPossessionRecord = {
  id: string;
  purchasePrice: string;
  soldPrice: string | null;
};

export function validatePasswordChangeInput(input: PasswordChangeInput) {
  const currentPassword = input.currentPassword.trim();
  const newPassword = input.newPassword.trim();
  const confirmPassword = input.confirmPassword.trim();

  if (!currentPassword) return { success: false, error: '请输入当前密码' };
  if (newPassword.length < 8) return { success: false, error: '新密码至少需要 8 位' };
  if (newPassword !== confirmPassword) return { success: false, error: '两次输入的新密码不一致' };
  if (currentPassword === newPassword) return { success: false, error: '新密码不能和当前密码相同' };

  return { success: true };
}

export function rotateUserEncryptedFields(input: {
  userId: string;
  oldDerivedKey: string;
  newDerivedKey: string;
  assets: EncryptedAssetRecord[];
  liabilities: EncryptedLiabilityRecord[];
  possessions: EncryptedPossessionRecord[];
}) {
  const { userId, oldDerivedKey, newDerivedKey } = input;

  return {
    assets: input.assets.map((asset) => ({
      id: asset.id,
      balance: encryptValue(decryptValue(asset.balance, oldDerivedKey, userId), newDerivedKey, userId),
      costPrice: asset.costPrice
        ? encryptValue(decryptValue(asset.costPrice, oldDerivedKey, userId), newDerivedKey, userId)
        : null,
    })),
    liabilities: input.liabilities.map((liability) => ({
      id: liability.id,
      principal: encryptValue(decryptValue(liability.principal, oldDerivedKey, userId), newDerivedKey, userId),
      currentBalance: encryptValue(
        decryptValue(liability.currentBalance, oldDerivedKey, userId),
        newDerivedKey,
        userId,
      ),
      monthlyPayment: liability.monthlyPayment
        ? encryptValue(decryptValue(liability.monthlyPayment, oldDerivedKey, userId), newDerivedKey, userId)
        : null,
    })),
    possessions: input.possessions.map((possession) => ({
      id: possession.id,
      purchasePrice: encryptValue(
        decryptValue(possession.purchasePrice, oldDerivedKey, userId),
        newDerivedKey,
        userId,
      ),
      soldPrice: possession.soldPrice
        ? encryptValue(
            decryptValue(possession.soldPrice, oldDerivedKey, userId),
            newDerivedKey,
            userId,
          )
        : null,
    })),
  };
}
