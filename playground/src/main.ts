import { createApp } from "@vef-framework-react/starter";
import { findDictionaryItemsBatch } from "~apis";
import { FILE_BASE_URL, getAppConfig } from "~helpers";

import { apiClient } from "./api";
import router from "./router";

import "./styles/index.scss";

// MSW is loaded lazily so production bundles tree-shake it away whenever
// the env flag is off (which is the default for `.env.production`).
if (getAppConfig("useMock") === "true") {
  const { startMockWorker } = await import("./mocks/browser");
  await startMockWorker();
}

createApp().render({
  apiClient,
  router,
  appContext: {
    dictionaryQueryFn: findDictionaryItemsBatch,
    fileBaseUrl: FILE_BASE_URL
  },
  appVersionNotification: {
    enabled: import.meta.env.PROD,
    checkInterval: 10 * 60
  }
});
