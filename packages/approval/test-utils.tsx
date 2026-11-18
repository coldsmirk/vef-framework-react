import type { ApiRequest } from "@vef-framework-react/core";

import { HTTP_CLIENT } from "@vef-framework-react/core";

import { createTestApiClient } from "../components/test-utils";

export * from "../components/test-utils";

export function mockApprovalApi(respond: (request: ApiRequest) => unknown) {
  const client = createTestApiClient();
  vi.spyOn(Object.getPrototypeOf(client[HTTP_CLIENT]), "post")
    .mockImplementation(async (_url, options) => { return { data: await respond((options as { data: ApiRequest }).data) }; });

  return client;
}
