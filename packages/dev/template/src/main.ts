import { createApp } from "@vef-framework-react/starter";

import { apiClient } from "./api";
import router from "./router";

createApp().render({
  apiClient,
  router,
  appContext: {}
});
