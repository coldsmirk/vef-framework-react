/**
 * The display language for engine-produced text (built-in descriptions and
 * diagnostic labels). Defaults to `"en-US"`; a host opts into Chinese with
 * {@link setExpressionLocale}. Identifiers, type signatures and the wasm's own
 * error message bodies are never translated — only descriptive prose is.
 */
export type ExpressionLocale = "en-US" | "zh-CN";

let activeLocale: ExpressionLocale = "en-US";

/**
 * Set the active locale for engine-produced descriptive text. Module-global (the
 * sync editor accessors read it without a React context), mirroring the engine
 * singleton itself. Defaults to `"en-US"` so published consumers are unaffected.
 */
export function setExpressionLocale(locale: ExpressionLocale): void {
  activeLocale = locale;
}

/**
 * The active locale set by {@link setExpressionLocale}.
 */
export function getExpressionLocale(): ExpressionLocale {
  return activeLocale;
}

// Built-in descriptions, keyed by the engine's English `info` text rather than by
// label. The builtin catalog is finite and the descriptions are stable, while
// labels collide (the function `year` and the Date method `year` share a name but
// carry different descriptions) — keying on the description sidesteps that and
// degrades gracefully (an unmapped/renamed builtin falls through to English).
const COMPLETION_INFO_ZH: Record<string, string> = {
  // String / array / object functions
  "Returns the length of variable": "返回变量的长度",
  "Checks if variable contains a needle": "检查变量是否包含指定元素",
  "Flattens an array": "将数组扁平化",
  "Merges multiple objects into one.": "将多个对象合并为一个。",
  "Deeply merges multiple objects into one.": "将多个对象深度合并为一个。",
  "Converts all characters in a string to uppercase": "将字符串中所有字符转换为大写",
  "Converts all characters in a string to lowercase": "将字符串中所有字符转换为小写",
  "Returns the string with leading and trailing whitespace removed": "返回去除首尾空白后的字符串",
  "Returns true if the string starts with the specified prefix": "若字符串以指定前缀开头则返回 true",
  "Returns true if the string ends with the specified suffix": "若字符串以指定后缀结尾则返回 true",
  "Returns true if the string matches the specified pattern": "若字符串匹配指定模式则返回 true",
  "Extracts matching substrings according to a pattern": "按模式提取匹配的子串",
  "Performs a fuzzy search of the needle in the haystack, and returns the match score(s).": "在目标中对关键字进行模糊搜索，并返回匹配得分。",
  "Splits a string into an array of substrings using the specified delimiter.": "使用指定分隔符将字符串拆分为子串数组。",

  // Math / aggregation functions
  "Returns the absolute value of a number": "返回数字的绝对值",
  "Returns the sum of all elements in the input array.": "返回输入数组中所有元素之和。",
  "Calculates the average of all elements in the input array.": "计算输入数组中所有元素的平均值。",
  "Returns the smallest of the elements in the input array.": "返回输入数组中的最小元素。",
  "Returns the largest of the elements in the input array.": "返回输入数组中的最大元素。",
  "Generates a random number between 0 (inclusive) and max (inclusive).": "生成 0 到 max（均包含）之间的随机数。",
  "Calculates the median value of all elements in the input array.": "计算输入数组中所有元素的中位数。",
  "Finds the mode(s) of the input array, which are the most frequent element(s).": "求输入数组的众数，即出现最频繁的元素。",
  "Rounds a number down to the nearest integer.": "向下取整到最接近的整数。",
  "Rounds a number up to the nearest integer.": "向上取整到最接近的整数。",
  "Rounds a number to a specified number of decimal places.": "将数字四舍五入到指定的小数位数。",
  "Truncates a number to a specified number of decimal places.": "将数字截断到指定的小数位数。",

  // Type / conversion functions
  "Checks if the given value is of a numeric type.": "检查给定值是否为数值类型。",
  "Converts the given value to a string.": "将给定值转换为字符串。",
  "Converts the given value to a number.": "将给定值转换为数字。",
  "Converts the given value to a boolean.": "将给定值转换为布尔值。",
  "Returns a string representing the data type of the value.": "返回表示该值数据类型的字符串。",
  "Returns an array of a given object's own enumerable property names.": "返回由给定对象自身可枚举属性名组成的数组。",
  "Returns an array of a given object's own enumerable property values.": "返回由给定对象自身可枚举属性值组成的数组。",

  // Date / time functions
  "Returns a new date time instance.": "返回一个新的日期时间实例。",
  "Converts a numeric timestamp to a unix timestamp.": "将数值时间戳转换为 Unix 时间戳。",
  "Extracts the time from a numeric timestamp and returns it as a seconds from beginning of day.": "从数值时间戳中提取时间，以当天起始的秒数返回。",
  "e.g. 1h30min": "例如 1h30min",
  "Extracts the year from a given timestamp.": "从给定时间戳中提取年份。",
  "Gets the day of the week from a given timestamp, where Sunday might be 0.": "获取给定时间戳的星期几（周日可能为 0）。",
  "Extracts the day of the month from a given timestamp.": "从给定时间戳中提取当月的日期。",
  "Gets the day of the year from a given timestamp.": "获取给定时间戳在一年中的第几天。",
  "Calculates the week of the year from a given timestamp.": "计算给定时间戳在一年中的第几周。",
  "Extracts the month from a given timestamp, typically with January as 1.": "从给定时间戳中提取月份（通常 1 月为 1）。",
  "Converts the month from a given timestamp into its string representation (e.g., 'Jan').": "将给定时间戳的月份转换为字符串表示（例如 'Jan'）。",
  "Converts a timestamp to a human-readable date string.": "将时间戳转换为人类可读的日期字符串。",
  "Converts the day of the week from a given timestamp into its string representation (e.g., 'Mon').": "将给定时间戳的星期几转换为字符串表示（例如 'Mon'）。",
  "Returns the timestamp representing the start of a specified unit (e.g., day, month, year) based on a given timestamp.": "返回给定时间戳在指定单位（如日、月、年）起始处的时间戳。",
  "Returns the timestamp representing the end of a specified unit (e.g., day, month, year) based on a given timestamp.": "返回给定时间戳在指定单位（如日、月、年）结束处的时间戳。",

  // Higher-order array functions
  "Checks if all elements in the array satisfy the condition defined in the callback.": "检查数组中所有元素是否都满足回调中定义的条件。",
  "Checks if no elements in the array satisfy the condition defined in the callback.": "检查数组中是否没有任何元素满足回调中定义的条件。",
  "Checks if at least one element in the array satisfies the condition defined in the callback.": "检查数组中是否至少有一个元素满足回调中定义的条件。",
  "Checks if exactly one element in the array satisfies the condition defined in the callback.": "检查数组中是否恰好有一个元素满足回调中定义的条件。",
  "Creates a new array with all elements that satisfy the condition defined in the callback.": "创建一个仅包含满足回调中定义条件的元素的新数组。",
  "Creates a new array populated with the results of calling the provided function on every element in the calling array.": "创建一个新数组，其元素为对原数组每个元素调用所提供函数的结果。",
  "First maps each element using a mapping function, then flattens the result into a new array.": "先用映射函数处理每个元素，再将结果扁平化为新数组。",
  "Counts the number of elements in the array that satisfy the condition defined in the callback.": "统计数组中满足回调中定义条件的元素个数。",

  // Date methods
  "Adds time to a date": "为日期增加时间",
  "Subtracts time from a date": "从日期中减去时间",
  "Sets a specific unit of time on a date": "设置日期的某个时间单位",
  "Formats a date into a string representation": "将日期格式化为字符串",
  "Returns the start of a specified time unit for a date": "返回日期在指定时间单位上的起始",
  "Returns the end of a specified time unit for a date": "返回日期在指定时间单位上的结束",
  "Calculates the difference between two dates": "计算两个日期之间的差值",
  "Converts a date to a different timezone": "将日期转换到不同的时区",
  "Checks if two dates are the same": "检查两个日期是否相同",
  "Checks if a date is before another date": "检查日期是否早于另一个日期",
  "Checks if a date is after another date": "检查日期是否晚于另一个日期",
  "Checks if a date is the same as or before another date": "检查日期是否等于或早于另一个日期",
  "Checks if a date is the same as or after another date": "检查日期是否等于或晚于另一个日期",
  "Gets the seconds of a date": "获取日期的秒",
  "Gets the minutes of a date": "获取日期的分钟",
  "Gets the hours of a date": "获取日期的小时",
  "Gets the day of the month for a date": "获取日期在当月的第几天",
  "Gets the day of the year for a date": "获取日期在当年的第几天",
  "Gets the week of the year for a date": "获取日期在当年的第几周",
  "Gets the day of the week for a date": "获取日期的星期几",
  "Gets the month for a date": "获取日期的月份",
  "Gets the quarter for a date": "获取日期所在的季度",
  "Gets the year for a date": "获取日期的年份",
  "Gets the Unix timestamp for a date": "获取日期的 Unix 时间戳",
  "Gets the timezone offset name for a date": "获取日期的时区偏移名称",
  "Checks if a date is valid": "检查日期是否有效",
  "Checks if a date is yesterday": "检查日期是否为昨天",
  "Checks if a date is today": "检查日期是否为今天",
  "Checks if a date is tomorrow": "检查日期是否为明天",
  "Checks if the year of a date is a leap year": "检查日期所在年份是否为闰年"
};

/**
 * Translate a built-in's English `info` description to the active locale, or
 * return it unchanged when the locale is English, the description is empty, or no
 * translation exists.
 */
export function localizeCompletionInfo(info: string): string {
  if (activeLocale !== "zh-CN" || info === "") {
    return info;
  }

  return COMPLETION_INFO_ZH[info] ?? info;
}

interface SourceLabelTable {
  /**
   * Used when the wasm error `type` is unknown or absent.
   */
  fallback: string;
  [type: string]: string;
}

// Diagnostic origin labels keyed by the wasm error `type`. English is the source
// of truth; an unknown type resolves to the locale's `fallback` label.
const SOURCE_LABELS: Record<ExpressionLocale, SourceLabelTable> = {
  "en-US": {
    lexerError: "Lexer error",
    parserError: "Parser error",
    compilerError: "Compiler error",
    vmError: "VM error",
    fallback: "Error"
  },
  "zh-CN": {
    lexerError: "词法错误",
    parserError: "语法错误",
    compilerError: "编译错误",
    vmError: "运行时错误",
    fallback: "错误"
  }
};

/**
 * The localized diagnostic origin label for a wasm error `type`
 * (`"parserError"` → `"语法错误"`), or the locale's fallback label.
 */
export function localizeSourceLabel(type?: string): string {
  const table = SOURCE_LABELS[activeLocale];
  return (type === undefined ? undefined : table[type]) ?? table.fallback;
}
