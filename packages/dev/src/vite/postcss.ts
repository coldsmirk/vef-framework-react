import type { UserConfig } from "vite";

type PostcssConfig = Exclude<NonNullable<UserConfig["css"]>["postcss"], string | undefined>;

export function createPostcssConfig(): PostcssConfig {
  return {
    map: false,
    plugins: []
  };
}
