import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../src/modules/encryption/encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('0123456789abcdef0123456789abcdef'),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should encrypt and decrypt a value correctly', () => {
    const plaintext = '123456.7890';
    const encrypted = service.encrypt(plaintext);
    expect(encrypted).toMatch(/^enc:/);
    const decrypted = service.decrypt(encrypted.slice(4));
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext', () => {
    const plaintext = '500000.00';
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should throw on tampered ciphertext', () => {
    const plaintext = '1000000.00';
    const encrypted = service.encrypt(plaintext);
    const tampered = encrypted.slice(0, -5) + 'xxxxx';
    expect(() => service.decrypt(tampered.slice(4))).toThrow();
  });
});
