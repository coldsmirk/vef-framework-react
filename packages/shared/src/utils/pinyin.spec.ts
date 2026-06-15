import { describe, expect, it } from "vitest";

import { getPinyin, getPinyinInitials, withPinyin } from "..";

describe("utils/pinyin", () => {
  describe("getPinyin", () => {
    it("returns pinyin for single Chinese character", () => {
      expect(getPinyin("你")).toEqual(["ni"]);
      expect(getPinyin("好")).toEqual(["hao"]);
      expect(getPinyin("的")).toEqual(["de"]);
    });

    it("returns pinyin for multiple Chinese characters", () => {
      expect(getPinyin("你好")).toEqual(["ni", "hao"]);
      expect(getPinyin("世界")).toEqual(["shi", "jie"]);
      expect(getPinyin("中国")).toEqual(["zhong", "guo"]);
    });

    it("handles mixed Chinese and non-Chinese text", () => {
      expect(getPinyin("你好world")).toEqual(["ni", "hao", "world"]);
      expect(getPinyin("hello世界")).toEqual(["hello", "shi", "jie"]);
      expect(getPinyin("测试123")).toEqual(["ce", "shi", "123"]);
    });

    it("handles empty string", () => {
      expect(getPinyin("")).toEqual([]);
    });

    it("handles English text only", () => {
      expect(getPinyin("hello")).toEqual(["hello"]);
      expect(getPinyin("world")).toEqual(["world"]);
    });

    it("handles numbers and special characters", () => {
      expect(getPinyin("123")).toEqual(["123"]);
      expect(getPinyin("!@#")).toEqual(["!@#"]);
      expect(getPinyin("测试!123")).toEqual(["ce", "shi", "!123"]);
    });

    it("handles whitespace and punctuation", () => {
      expect(getPinyin("你 好")).toEqual(["ni", " ", "hao"]);
      expect(getPinyin("你，好")).toEqual(["ni", "，", "hao"]);
      expect(getPinyin("你。世界！")).toEqual(["ni", "。", "shi", "jie", "！"]);
    });

    it("handles complex sentences", () => {
      expect(getPinyin("我爱北京天安门")).toEqual(["wo", "ai", "bei", "jing", "tian", "an", "men"]);
      expect(getPinyin("春眠不觉晓")).toEqual(["chun", "mian", "bu", "jue", "xiao"]);
    });

    it("handles polyphone characters consistently", () => {
      // Test multiple readings of the same character
      const result = getPinyin("行");
      // Should return default reading
      expect(result).toEqual(["xing"]);
    });

    it("handles traditional Chinese characters", () => {
      expect(getPinyin("繁體中文")).toEqual(["po", "ti", "zhong", "wen"]);
      expect(getPinyin("測試")).toEqual(["ce", "shi"]);
    });
  });

  describe("getPinyinInitials", () => {
    it("returns initial letters for single Chinese character", () => {
      expect(getPinyinInitials("你")).toEqual(["n"]);
      expect(getPinyinInitials("好")).toEqual(["h"]);
      expect(getPinyinInitials("的")).toEqual(["d"]);
    });

    it("returns initial letters for multiple Chinese characters", () => {
      expect(getPinyinInitials("你好")).toEqual(["n", "h"]);
      expect(getPinyinInitials("世界")).toEqual(["s", "j"]);
      expect(getPinyinInitials("中国")).toEqual(["z", "g"]);
    });

    it("handles mixed Chinese and non-Chinese text", () => {
      expect(getPinyinInitials("你好world")).toEqual(["n", "h", "world"]);
      expect(getPinyinInitials("hello世界")).toEqual(["hello", "s", "j"]);
      expect(getPinyinInitials("测试123")).toEqual(["c", "s", "123"]);
    });

    it("handles empty string", () => {
      expect(getPinyinInitials("")).toEqual([]);
    });

    it("handles English text only", () => {
      expect(getPinyinInitials("hello")).toEqual(["hello"]);
      expect(getPinyinInitials("world")).toEqual(["world"]);
      expect(getPinyinInitials("abc")).toEqual(["abc"]);
    });

    it("handles numbers and special characters", () => {
      expect(getPinyinInitials("123")).toEqual(["123"]);
      expect(getPinyinInitials("!@#")).toEqual(["!@#"]);
      expect(getPinyinInitials("测试!123")).toEqual(["c", "s", "!123"]);
    });

    it("handles whitespace and punctuation", () => {
      expect(getPinyinInitials("你 好")).toEqual(["n", " ", "h"]);
      expect(getPinyinInitials("你，好")).toEqual(["n", "，", "h"]);
      expect(getPinyinInitials("你。世界！")).toEqual(["n", "。", "s", "j", "！"]);
    });

    it("handles complex sentences", () => {
      expect(getPinyinInitials("我爱北京天安门")).toEqual(["w", "a", "b", "j", "t", "a", "m"]);
      expect(getPinyinInitials("春眠不觉晓")).toEqual(["c", "m", "b", "j", "x"]);
    });

    it("handles polyphone characters consistently", () => {
      // Test multiple readings of the same character
      const result = getPinyinInitials("行");
      // Should return default reading initial
      expect(result).toEqual(["x"]);
    });

    it("handles traditional Chinese characters", () => {
      expect(getPinyinInitials("繁體中文")).toEqual(["p", "t", "z", "w"]);
      expect(getPinyinInitials("測試")).toEqual(["c", "s"]);
    });

    it("is useful for search functionality", () => {
      // Common use case: creating search indexes
      const searchText = "张三";
      const initials = getPinyinInitials(searchText);
      expect(initials).toEqual(["z", "s"]);

      // Should match search queries like "zs"
      const searchQuery = initials.join("");
      expect(searchQuery).toBe("zs");
    });

    it("handles surnames correctly", () => {
      // Test common Chinese surnames
      expect(getPinyinInitials("张")).toEqual(["z"]);
      expect(getPinyinInitials("王")).toEqual(["w"]);
      expect(getPinyinInitials("李")).toEqual(["l"]);
      expect(getPinyinInitials("赵")).toEqual(["z"]);
    });

    it("maintains consistent length with getPinyin", () => {
      const testCases = [
        "你好世界",
        "hello世界",
        "测试123!@#",
        "春眠不觉晓处处闻啼鸟"
      ];

      for (const text of testCases) {
        const pinyin = getPinyin(text);
        const initials = getPinyinInitials(text);
        expect(initials.length).toBe(pinyin.length);
      }
    });
  });

  describe("function consistency", () => {
    it("maintains consistent behavior between getPinyin and getPinyinInitials for Chinese text", () => {
      const chineseTestCases = [
        "你好",
        "世界",
        "春眠不觉晓",
        "张三李四",
        "測試繁體"
      ];

      for (const text of chineseTestCases) {
        const pinyin = getPinyin(text);
        const initials = getPinyinInitials(text);

        // Should have same array length
        expect(initials.length).toBe(pinyin.length);

        // For Chinese characters, each initial should be the first character of corresponding pinyin
        for (const [index, py] of pinyin.entries()) {
          if (py.length > 0) {
            expect(initials[index]).toBe(py.charAt(0));
          }
        }
      }
    });

    it("handles mixed content consistently", () => {
      // Test specific known cases with expected behaviors
      const testCases = [
        {
          input: "你好world",
          expectedPinyin: ["ni", "hao", "world"],
          expectedInitials: ["n", "h", "world"]
        },
        {
          input: "hello世界",
          expectedPinyin: ["hello", "shi", "jie"],
          expectedInitials: ["hello", "s", "j"]
        },
        {
          input: "测试123",
          expectedPinyin: ["ce", "shi", "123"],
          expectedInitials: ["c", "s", "123"]
        },
        {
          input: "abc中文",
          expectedPinyin: ["abc", "zhong", "wen"],
          expectedInitials: ["abc", "z", "w"]
        }
      ];

      for (const {
        input,
        expectedPinyin,
        expectedInitials
      } of testCases) {
        const pinyin = getPinyin(input);
        const initials = getPinyinInitials(input);

        expect(pinyin).toEqual(expectedPinyin);
        expect(initials).toEqual(expectedInitials);
        expect(initials.length).toBe(pinyin.length);
      }
    });

    it("handles edge cases consistently", () => {
      const edgeCases = [
        // empty string
        "",
        // space
        " ",
        // newline
        "\n",
        // tab
        "\t",
        // full-width space
        "　"
      ];

      for (const text of edgeCases) {
        const pinyin = getPinyin(text);
        const initials = getPinyinInitials(text);

        expect(initials.length).toBe(pinyin.length);

        // For these edge cases, they should be identical
        for (const [index, py] of pinyin.entries()) {
          expect(initials[index]).toBe(py);
        }
      }
    });
  });

  describe("withPinyin", () => {
    it("adds pinyin fields for single string key", () => {
      const user = { name: "张三", age: 25 };
      const result = withPinyin(user, "name");

      expect(result).toEqual({
        name: "张三",
        age: 25,
        namePinyin: "zhangsan",
        namePinyinInitials: "zs"
      });
    });

    it("adds pinyin fields for multiple string keys", () => {
      const person = {
        firstName: "张",
        lastName: "三",
        age: 30
      };
      const result = withPinyin(person, "firstName", "lastName");

      expect(result).toEqual({
        firstName: "张",
        lastName: "三",
        age: 30,
        firstNamePinyin: "zhang",
        firstNamePinyinInitials: "z",
        lastNamePinyin: "san",
        lastNamePinyinInitials: "s"
      });
    });

    it("handles optional string fields", () => {
      interface User {
        name: string;
        nickname?: string;
        age: number;
      }

      const user1: User = { name: "李四", age: 25 };
      const result1 = withPinyin(user1, "name", "nickname");

      expect(result1).toEqual({
        name: "李四",
        age: 25,
        namePinyin: "lisi",
        namePinyinInitials: "ls"
      });

      const user2: User = {
        name: "李四",
        nickname: "小李",
        age: 25
      };
      const result2 = withPinyin(user2, "name", "nickname");

      expect(result2).toEqual({
        name: "李四",
        nickname: "小李",
        age: 25,
        namePinyin: "lisi",
        namePinyinInitials: "ls",
        nicknamePinyin: "xiaoli",
        nicknamePinyinInitials: "xl"
      });
    });

    it("ignores non-string keys", () => {
      const data = {
        name: "王五",
        age: 30,
        count: 100
      };
      const result = withPinyin(data, "name");

      expect(result).toEqual({
        name: "王五",
        age: 30,
        count: 100,
        namePinyin: "wangwu",
        namePinyinInitials: "ww"
      });
    });

    it("handles mixed Chinese and English text", () => {
      const product = { name: "iPhone 15", description: "最新款手机" };
      const result = withPinyin(product, "name", "description");

      expect(result).toEqual({
        name: "iPhone 15",
        description: "最新款手机",
        namePinyin: "iPhone 15",
        namePinyinInitials: "iPhone 15",
        descriptionPinyin: "zuixinkuanshouji",
        descriptionPinyinInitials: "zxksj"
      });
    });

    it("handles empty strings", () => {
      const data = { name: "", title: "标题" };
      const result = withPinyin(data, "name", "title");

      expect(result).toEqual({
        name: "",
        title: "标题",
        namePinyin: "",
        namePinyinInitials: "",
        titlePinyin: "biaoti",
        titlePinyinInitials: "bt"
      });
    });

    it("does not mutate original object", () => {
      const original = { name: "赵六", age: 28 };
      const result = withPinyin(original, "name");

      expect(original).toEqual({ name: "赵六", age: 28 });
      expect(result).not.toBe(original);
      expect(result.name).toBe(original.name);
      expect(result.age).toBe(original.age);
    });

    it("handles complex nested objects", () => {
      const user = {
        name: "孙七",
        age: 35,
        address: { city: "北京", street: "长安街" }
      };
      const result = withPinyin(user, "name");

      expect(result).toEqual({
        name: "孙七",
        age: 35,
        address: { city: "北京", street: "长安街" },
        namePinyin: "sunqi",
        namePinyinInitials: "sq"
      });
      // Nested objects should be shallow copied
      expect(result.address).toBe(user.address);
    });

    it("handles special characters and punctuation", () => {
      const data = { name: "张三！", title: "CEO，总经理" };
      const result = withPinyin(data, "name", "title");

      expect(result).toEqual({
        name: "张三！",
        title: "CEO，总经理",
        namePinyin: "zhangsan！",
        namePinyinInitials: "zs！",
        titlePinyin: "CEO，zongjingli",
        titlePinyinInitials: "CEO，zjl"
      });
    });

    it("handles whitespace in text", () => {
      const data = { name: "张 三", title: "软件 工程师" };
      const result = withPinyin(data, "name", "title");

      expect(result).toEqual({
        name: "张 三",
        title: "软件 工程师",
        namePinyin: "zhang san",
        namePinyinInitials: "z s",
        titlePinyin: "ruanjian gongchengshi",
        titlePinyinInitials: "rj gcs"
      });
    });

    it("works with no keys provided", () => {
      const data = { name: "李四", age: 25 };
      const result = withPinyin(data);

      expect(result).toEqual({ name: "李四", age: 25 });
    });

    it("handles traditional Chinese characters", () => {
      const data = { name: "張三", title: "軟體工程師" };
      const result = withPinyin(data, "name", "title");

      expect(result.namePinyin).toBeTruthy();
      expect(result.namePinyinInitials).toBeTruthy();
      expect(result.titlePinyin).toBeTruthy();
      expect(result.titlePinyinInitials).toBeTruthy();
    });

    it("is useful for search/filter scenarios", () => {
      const users = [
        { id: 1, name: "张三" },
        { id: 2, name: "李四" },
        { id: 3, name: "王五" }
      ];

      const usersWithPinyin = users.map(user => withPinyin(user, "name"));

      // Can now search by pinyin
      const searchByPinyin = usersWithPinyin.filter(
        u => u.namePinyin.includes("zhang")
      );
      expect(searchByPinyin).toHaveLength(1);
      expect(searchByPinyin[0]!.name).toBe("张三");

      // Can search by initials
      const searchByInitials = usersWithPinyin.filter(
        u => u.namePinyinInitials.includes("ls")
      );
      expect(searchByInitials).toHaveLength(1);
      expect(searchByInitials[0]!.name).toBe("李四");
    });

    it("handles numbers in strings", () => {
      const data = { name: "3号楼", code: "A123中文" };
      const result = withPinyin(data, "name", "code");

      expect(result).toEqual({
        name: "3号楼",
        code: "A123中文",
        namePinyin: "3haolou",
        namePinyinInitials: "3hl",
        codePinyin: "A123zhongwen",
        codePinyinInitials: "A123zw"
      });
    });

    it("maintains type safety", () => {
      interface Product {
        name: string;
        price: number;
        description?: string;
      }

      const product: Product = {
        name: "苹果",
        price: 10
      };

      const result = withPinyin(product, "name", "description");

      // TypeScript should infer correct types
      expect(typeof result.namePinyin).toBe("string");
      expect(typeof result.namePinyinInitials).toBe("string");
      expect(typeof result.price).toBe("number");
    });
  });
});
