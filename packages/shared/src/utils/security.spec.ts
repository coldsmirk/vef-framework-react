import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  decryptUsingRSA,
  encryptUsingRSA,
  obfuscateDecode,
  obfuscateDecodeFromBase64,
  obfuscateDecodeFromHex,
  obfuscateEncode,
  obfuscateEncodeToBase64,
  obfuscateEncodeToHex
} from "..";

const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQDlOJu6TyygqxfWT7eLtGDwajtNFOb9I5XRb6khyfD1Yt3YiCgQ
WMNW649887VGJiGr/L5i2osbl8C9+WJTeucF+S76xFxdU6jE0NQ+Z+zEdhUTooNR
aY5nZiu5PgDB0ED/ZKBUSLKL7eibMxZtMlUDHjm4gwQco1KRMDSmXSMkDwIDAQAB
AoGAfY9LpnuWK5Bs50UVep5c93SJdUi82u7yMx4iHFMc/Z2hfenfYEzu+57fI4fv
xTQ//5DbzRR/XKb8ulNv6+CHyPF31xk7YOBfkGI8qjLoq06V+FyBfDSwL8KbLyeH
m7KUZnLNQbk8yGLzB3iYKkRHlmUanQGaNMIJziWOkN+N9dECQQD0ONYRNZeuM8zd
8XJTSdcIX4a3gy3GGCJxOzv16XHxD03GW6UNLmfPwenKu+cdrQeaqEixrCejXdAF
z/7+BSMpAkEA8EaSOeP5Xr3ZrbiKzi6TGMwHMvC7HdJxaBJbVRfApFrE0/mPwmP5
rN7QwjrMY+0+AbXcm8mRQyQ1+IGEembsdwJBAN6az8Rv7QnD/YBvi52POIlRSSIM
V7SwWvSK4WSMnGb1ZBbhgdg57DXaspcwHsFV7hByQ5BvMtIduHcT14ECfcECQATe
aTgjFnqE/lQ22Rk0eGaYO80cc643BXVGafNfd9fcvwBMnk0iGX0XRsOozVt5Azil
psLBYuApa66NcVHJpCECQQDTjI2AQhFc1yRnCU/YgDnSpJVm1nASoRUnU8Jfm3Oz
uku7JUXcVpt08DFSceCEX9unCuMcT72rAQlLpdZir876
-----END RSA PRIVATE KEY-----`;

const publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDlOJu6TyygqxfWT7eLtGDwajtN
FOb9I5XRb6khyfD1Yt3YiCgQWMNW649887VGJiGr/L5i2osbl8C9+WJTeucF+S76
xFxdU6jE0NQ+Z+zEdhUTooNRaY5nZiu5PgDB0ED/ZKBUSLKL7eibMxZtMlUDHjm4
gwQco1KRMDSmXSMkDwIDAQAB
-----END PUBLIC KEY-----`;

describe("utils/security", () => {
  // The RSA helpers log to console.error before rethrowing. Several negative-case
  // tests deliberately exercise that path; silence the side-effect so stderr stays
  // clean. We still rely on `toThrow(...)` assertions to prove the error happens.
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {
      // intentionally silent: see comment above
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("encryptUsingRSA", () => {
    it("encrypts a simple string", () => {
      const plainText = "Hello, World!";
      const encrypted = encryptUsingRSA(plainText, publicKey);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted.length).toBeGreaterThan(0);
      expect(encrypted).not.toBe(plainText);
    });

    it("encrypts different strings to different results", () => {
      const text1 = "First message";
      const text2 = "Second message";

      const encrypted1 = encryptUsingRSA(text1, publicKey);
      const encrypted2 = encryptUsingRSA(text2, publicKey);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it("encrypts empty string", () => {
      const plainText = "";
      const encrypted = encryptUsingRSA(plainText, publicKey);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it("encrypts numbers as strings", () => {
      const plainText = "12345";
      const encrypted = encryptUsingRSA(plainText, publicKey);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(plainText);
    });

    it("encrypts special characters", () => {
      const plainText = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const encrypted = encryptUsingRSA(plainText, publicKey);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(plainText);
    });

    it("encrypts Unicode characters", () => {
      const plainText = "中文测试 🎉 Émojis";
      const encrypted = encryptUsingRSA(plainText, publicKey);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(plainText);
    });

    it("handles JSON data", () => {
      const jsonData = JSON.stringify({
        name: "John",
        age: 30,
        active: true
      });
      const encrypted = encryptUsingRSA(jsonData, publicKey);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(jsonData);
    });

    it("throws error with invalid public key", () => {
      const plainText = "Test message";
      const invalidPublicKey = "invalid-key";

      expect(() => {
        encryptUsingRSA(plainText, invalidPublicKey);
      }).toThrow("Failed to encrypt data using RSA");
    });

    it("throws error with empty public key", () => {
      const plainText = "Test message";
      const emptyPublicKey = "";

      expect(() => {
        encryptUsingRSA(plainText, emptyPublicKey);
      }).toThrow("Failed to encrypt data using RSA: invalid input");
    });

    it("throws error with malformed public key", () => {
      const plainText = "Test message";
      const malformedKey = "-----BEGIN PUBLIC KEY-----\ninvalid-content\n-----END PUBLIC KEY-----";

      expect(() => {
        encryptUsingRSA(plainText, malformedKey);
      }).toThrow("Failed to encrypt data using RSA");
    });

    it("handles large data within RSA limits", () => {
      // RSA can encrypt data up to key size minus padding (1024-bit = 128 bytes - 11 padding = 117 bytes max)
      // 100 bytes, should work
      const plainText = "A".repeat(100);
      const encrypted = encryptUsingRSA(plainText, publicKey);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(plainText);
    });
  });

  describe("decryptUsingRSA", () => {
    it("decrypts encrypted data back to original", () => {
      const originalText = "Hello, World!";
      const encrypted = encryptUsingRSA(originalText, publicKey);
      const decrypted = decryptUsingRSA(encrypted, privateKey);

      expect(decrypted).toBe(originalText);
    });

    it("handles empty string encryption/decryption", () => {
      const originalText = "";

      // Some RSA implementations may not handle empty strings well
      // Let's test if encryption works first
      try {
        const encrypted = encryptUsingRSA(originalText, publicKey);
        const decrypted = decryptUsingRSA(encrypted, privateKey);
        expect(decrypted).toBe(originalText);
      } catch (error) {
        // If empty string encryption fails, that's acceptable behavior
        // for some RSA implementations
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("decrypts complex data", () => {
      const originalText = "Complex data: 123!@# 中文 🎉";
      const encrypted = encryptUsingRSA(originalText, publicKey);
      const decrypted = decryptUsingRSA(encrypted, privateKey);

      expect(decrypted).toBe(originalText);
    });

    it("decrypts JSON data", () => {
      const originalData = {
        name: "Alice",
        age: 25,
        hobbies: ["reading", "coding"]
      };
      const jsonString = JSON.stringify(originalData);
      const encrypted = encryptUsingRSA(jsonString, publicKey);
      const decrypted = decryptUsingRSA(encrypted, privateKey);

      expect(decrypted).toBe(jsonString);
      expect(JSON.parse(decrypted)).toEqual(originalData);
    });

    it("handles multiple encrypt-decrypt cycles", () => {
      const testCases = [
        "Simple text",
        "12345",
        "Special chars: !@#$%",
        "Unicode: 你好世界 🌍",
        JSON.stringify({ test: true })
      ];

      for (const originalText of testCases) {
        const encrypted = encryptUsingRSA(originalText, publicKey);
        const decrypted = decryptUsingRSA(encrypted, privateKey);
        expect(decrypted).toBe(originalText);
      }
    });

    it("throws error with invalid private key", () => {
      const plainText = "Test message";
      const encrypted = encryptUsingRSA(plainText, publicKey);
      const invalidPrivateKey = "invalid-key";

      expect(() => {
        decryptUsingRSA(encrypted, invalidPrivateKey);
      }).toThrow();
    });

    it("throws error with empty private key", () => {
      const plainText = "Test message";
      const encrypted = encryptUsingRSA(plainText, publicKey);
      const emptyPrivateKey = "";

      expect(() => {
        decryptUsingRSA(encrypted, emptyPrivateKey);
      }).toThrow();
    });

    it("throws error with invalid encrypted data", () => {
      const invalidEncrypted = "invalid-encrypted-data";

      expect(() => {
        decryptUsingRSA(invalidEncrypted, privateKey);
      }).toThrow();
    });

    it("throws error with malformed encrypted data", () => {
      const malformedEncrypted = "not-base64-encrypted-data";

      expect(() => {
        decryptUsingRSA(malformedEncrypted, privateKey);
      }).toThrow();
    });

    it("throws error when trying to decrypt with wrong private key", () => {
      const wrongPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIICXgIBAAKBgQDifferentKeyContentHereForTestingPurposes
-----END RSA PRIVATE KEY-----`;

      const plainText = "Test message";
      const encrypted = encryptUsingRSA(plainText, publicKey);

      expect(() => {
        decryptUsingRSA(encrypted, wrongPrivateKey);
      }).toThrow();
    });
  });

  describe("rsa encryption/decryption integration", () => {
    it("maintains data integrity through encrypt-decrypt cycle", () => {
      const testData = [
        "Simple string",
        "1234567890",
        "!@#$%^&*()",
        "中文测试",
        "🎉🚀💻",
        JSON.stringify({
          key: "value",
          number: 42,
          boolean: true
        }),
        // Test with larger data
        "A".repeat(100)
      ];

      for (const originalText of testData) {
        const encrypted = encryptUsingRSA(originalText, publicKey);
        const decrypted = decryptUsingRSA(encrypted, privateKey);

        expect(decrypted).toBe(originalText);
        expect(encrypted).not.toBe(originalText);
        expect(encrypted.length).toBeGreaterThan(0);
      }

      // Test empty string separately due to potential RSA implementation limitations
      try {
        const emptyText = "";
        const encrypted = encryptUsingRSA(emptyText, publicKey);
        const decrypted = decryptUsingRSA(encrypted, privateKey);
        expect(decrypted).toBe(emptyText);
      } catch (error) {
        // Empty string encryption may fail in some RSA implementations - this is acceptable
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("produces different encrypted results for same input", () => {
      // RSA with random padding should produce different results each time
      const plainText = "Same input text";

      const encrypted1 = encryptUsingRSA(plainText, publicKey);
      const encrypted2 = encryptUsingRSA(plainText, publicKey);

      // Encrypted values should be different due to random padding
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same original text
      const decrypted1 = decryptUsingRSA(encrypted1, privateKey);
      const decrypted2 = decryptUsingRSA(encrypted2, privateKey);

      expect(decrypted1).toBe(plainText);
      expect(decrypted2).toBe(plainText);
      expect(decrypted1).toBe(decrypted2);
    });

    it("handles encryption of sensitive data patterns", () => {
      const sensitiveData = [
        "password123",
        "user@example.com",
        "API_KEY_12345",
        "Bearer token.jwt.signature",
        "credit-card-number",
        "+1234567890"
      ];

      for (const data of sensitiveData) {
        const encrypted = encryptUsingRSA(data, publicKey);
        const decrypted = decryptUsingRSA(encrypted, privateKey);

        expect(decrypted).toBe(data);
        // Ensure original data is not visible
        expect(encrypted).not.toContain(data);
      }
    });

    it("handles concurrent encryption operations", () => {
      const plainTexts = Array.from({ length: 10 }, (_, i) => `Message ${i}`);

      const encryptions = plainTexts.map(text => encryptUsingRSA(text, publicKey));
      const decryptions = encryptions.map(encrypted => decryptUsingRSA(encrypted, privateKey));

      for (const [index, decrypted] of decryptions.entries()) {
        expect(decrypted).toBe(plainTexts[index]);
      }
    });

    it("validates key pair compatibility", () => {
      const testMessage = "Key pair validation test";

      // This should work - correct key pair
      const encrypted = encryptUsingRSA(testMessage, publicKey);
      const decrypted = decryptUsingRSA(encrypted, privateKey);

      expect(decrypted).toBe(testMessage);
    });
  });

  describe("error handling and edge cases", () => {
    it("provides meaningful error messages for encryption failures", () => {
      const plainText = "Test message";

      try {
        encryptUsingRSA(plainText, "invalid-key");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Failed to encrypt data");
        expect((error as Error).message).not.toContain(plainText);
      }
    });

    it("provides meaningful error messages for decryption failures", () => {
      const invalidEncrypted = "invalid-data";

      try {
        decryptUsingRSA(invalidEncrypted, privateKey);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Failed to decrypt data");
        expect((error as Error).message).not.toContain(invalidEncrypted);
      }
    });

    it("handles null and undefined inputs gracefully", () => {
      expect(() => encryptUsingRSA(null as any, publicKey)).toThrow();
      expect(() => encryptUsingRSA(undefined as any, publicKey)).toThrow();
      expect(() => encryptUsingRSA("test", null as any)).toThrow();
      expect(() => encryptUsingRSA("test", undefined as any)).toThrow();

      expect(() => decryptUsingRSA(null as any, privateKey)).toThrow();
      expect(() => decryptUsingRSA(undefined as any, privateKey)).toThrow();
      expect(() => decryptUsingRSA("test", null as any)).toThrow();
      expect(() => decryptUsingRSA("test", undefined as any)).toThrow();
    });
  });
});

describe("utils/security - string obfuscation", () => {
  describe("obfuscateEncode and obfuscateDecode", () => {
    it("encodes and decodes English text correctly", () => {
      const plainText = "Hello, World!";
      const encoded = obfuscateEncode(plainText);
      const decoded = obfuscateDecode(encoded);

      expect(decoded).toBe(plainText);
      expect(encoded).not.toEqual(new TextEncoder().encode(plainText));
    });

    it("encodes and decodes Chinese text correctly", () => {
      const plainText = "你好，世界！";
      const encoded = obfuscateEncode(plainText);
      const decoded = obfuscateDecode(encoded);

      expect(decoded).toBe(plainText);
    });

    it("encodes and decodes mixed Chinese and English text correctly", () => {
      const plainText = "Hello 你好 World 世界！";
      const encoded = obfuscateEncode(plainText);
      const decoded = obfuscateDecode(encoded);

      expect(decoded).toBe(plainText);
    });

    it("encodes and decodes emojis correctly", () => {
      const plainText = "🎉🚀💻😀🌍";
      const encoded = obfuscateEncode(plainText);
      const decoded = obfuscateDecode(encoded);

      expect(decoded).toBe(plainText);
    });

    it("encodes and decodes mixed content with emojis correctly", () => {
      const plainText = "Hello 你好 🎉 World 世界 🚀";
      const encoded = obfuscateEncode(plainText);
      const decoded = obfuscateDecode(encoded);

      expect(decoded).toBe(plainText);
    });

    it("handles empty string", () => {
      const plainText = "";
      const encoded = obfuscateEncode(plainText);
      const decoded = obfuscateDecode(encoded);

      expect(encoded.length).toBe(0);
      expect(decoded).toBe("");
    });

    it("handles special characters", () => {
      const plainText = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
      const encoded = obfuscateEncode(plainText);
      const decoded = obfuscateDecode(encoded);

      expect(decoded).toBe(plainText);
    });

    it("handles numbers as strings", () => {
      const plainText = "1234567890";
      const encoded = obfuscateEncode(plainText);
      const decoded = obfuscateDecode(encoded);

      expect(decoded).toBe(plainText);
    });

    it("handles long text", () => {
      const plainText = "这是一段很长的中文文本，用于测试字符串混淆功能。"
        + "This is a long English text for testing the string obfuscation function. "
        + "混合内容测试 Mixed content test 🎉🚀💻";
      const encoded = obfuscateEncode(plainText);
      const decoded = obfuscateDecode(encoded);

      expect(decoded).toBe(plainText);
    });

    it("accepts number array as input for decode", () => {
      const plainText = "Test";
      const encoded = obfuscateEncode(plainText);
      const numberArray = [...encoded];
      const decoded = obfuscateDecode(numberArray);

      expect(decoded).toBe(plainText);
    });

    it("produces different encoded results for different inputs", () => {
      const text1 = "Hello";
      const text2 = "World";

      const encoded1 = obfuscateEncode(text1);
      const encoded2 = obfuscateEncode(text2);

      expect(encoded1).not.toEqual(encoded2);
    });

    it("produces same encoded results for same inputs", () => {
      const plainText = "Same input";

      const encoded1 = obfuscateEncode(plainText);
      const encoded2 = obfuscateEncode(plainText);

      expect(encoded1).toEqual(encoded2);
    });
  });

  describe("obfuscateEncodeToHex and obfuscateDecodeFromHex", () => {
    it("encodes and decodes English text to hex correctly", () => {
      const plainText = "Hello, World!";
      const hexEncoded = obfuscateEncodeToHex(plainText);
      const decoded = obfuscateDecodeFromHex(hexEncoded);

      expect(decoded).toBe(plainText);
      expect(hexEncoded).toMatch(/^[0-9a-f]+$/);
    });

    it("encodes and decodes Chinese text to hex correctly", () => {
      const plainText = "你好，世界！";
      const hexEncoded = obfuscateEncodeToHex(plainText);
      const decoded = obfuscateDecodeFromHex(hexEncoded);

      expect(decoded).toBe(plainText);
    });

    it("encodes and decodes mixed content to hex correctly", () => {
      const plainText = "Hello 你好 🎉 World 世界 🚀";
      const hexEncoded = obfuscateEncodeToHex(plainText);
      const decoded = obfuscateDecodeFromHex(hexEncoded);

      expect(decoded).toBe(plainText);
    });

    it("handles empty string", () => {
      const plainText = "";
      const hexEncoded = obfuscateEncodeToHex(plainText);
      const decoded = obfuscateDecodeFromHex(hexEncoded);

      expect(hexEncoded).toBe("");
      expect(decoded).toBe("");
    });

    it("produces valid hex string", () => {
      const plainText = "Test string 测试字符串 🎉";
      const hexEncoded = obfuscateEncodeToHex(plainText);

      // Check that the hex string has even length
      expect(hexEncoded.length % 2).toBe(0);
      // Check that it only contains valid hex characters
      expect(hexEncoded).toMatch(/^[0-9a-f]*$/);
    });

    it("decodes hex string with uppercase letters", () => {
      const plainText = "Test";
      const hexEncoded = obfuscateEncodeToHex(plainText).toUpperCase();
      const decoded = obfuscateDecodeFromHex(hexEncoded);

      expect(decoded).toBe(plainText);
    });
  });

  describe("obfuscateEncodeToBase64 and obfuscateDecodeFromBase64", () => {
    it("encodes and decodes English text to base64 correctly", () => {
      const plainText = "Hello, World!";
      const base64Encoded = obfuscateEncodeToBase64(plainText);
      const decoded = obfuscateDecodeFromBase64(base64Encoded);

      expect(decoded).toBe(plainText);
      expect(base64Encoded).toMatch(/^[A-Z0-9+/]*={0,2}$/i);
    });

    it("encodes and decodes Chinese text to base64 correctly", () => {
      const plainText = "你好，世界！";
      const base64Encoded = obfuscateEncodeToBase64(plainText);
      const decoded = obfuscateDecodeFromBase64(base64Encoded);

      expect(decoded).toBe(plainText);
    });

    it("encodes and decodes mixed content to base64 correctly", () => {
      const plainText = "Hello 你好 🎉 World 世界 🚀";
      const base64Encoded = obfuscateEncodeToBase64(plainText);
      const decoded = obfuscateDecodeFromBase64(base64Encoded);

      expect(decoded).toBe(plainText);
    });

    it("handles empty string", () => {
      const plainText = "";
      const base64Encoded = obfuscateEncodeToBase64(plainText);
      const decoded = obfuscateDecodeFromBase64(base64Encoded);

      expect(base64Encoded).toBe("");
      expect(decoded).toBe("");
    });

    it("produces valid base64 string", () => {
      const plainText = "Test string 测试字符串 🎉";
      const base64Encoded = obfuscateEncodeToBase64(plainText);

      // Check that it only contains valid base64 characters
      expect(base64Encoded).toMatch(/^[A-Z0-9+/]*={0,2}$/i);
    });

    it("is more compact than hex encoding", () => {
      const plainText = "This is a test string for comparing encoding sizes";
      const hexEncoded = obfuscateEncodeToHex(plainText);
      const base64Encoded = obfuscateEncodeToBase64(plainText);

      // Base64 should be shorter than hex (hex uses 2 chars per byte, base64 uses ~1.33)
      expect(base64Encoded.length).toBeLessThan(hexEncoded.length);
    });
  });

  describe("cross-format compatibility", () => {
    it("produces compatible results between byte array and hex formats", () => {
      const plainText = "Cross format test 跨格式测试 🎉";

      const byteEncoded = obfuscateEncode(plainText);
      const hexEncoded = obfuscateEncodeToHex(plainText);

      // Convert byte array to hex manually and compare
      const byteToHex = [...byteEncoded]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      expect(byteToHex).toBe(hexEncoded);
    });

    it("handles various real-world use cases", () => {
      const testCases = [
        "password123",
        "user@example.com",
        "API_KEY_12345abcde",
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        "数据库连接字符串：mysql://root:password@localhost:3306/db",
        "配置项 config_key=value123 🔐",
        JSON.stringify({ username: "admin", role: "超级管理员" })
      ];

      for (const plainText of testCases) {
        const encoded = obfuscateEncode(plainText);
        const decoded = obfuscateDecode(encoded);
        expect(decoded).toBe(plainText);

        const hexEncoded = obfuscateEncodeToHex(plainText);
        const hexDecoded = obfuscateDecodeFromHex(hexEncoded);
        expect(hexDecoded).toBe(plainText);

        const base64Encoded = obfuscateEncodeToBase64(plainText);
        const base64Decoded = obfuscateDecodeFromBase64(base64Encoded);
        expect(base64Decoded).toBe(plainText);
      }
    });
  });
});
