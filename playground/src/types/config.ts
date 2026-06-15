export interface AppConfig {
  name: string;
  title: string;
  apiBaseUrl: string;
  /**
   * When `"true"`, the playground boots with MSW handlers in front of the
   * real backend. Sourced from `VEF_APP_USE_MOCK`, so dev-time values arrive
   * as raw strings (compare with `=== "true"`).
   */
  useMock?: string;
}
