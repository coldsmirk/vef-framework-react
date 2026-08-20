import { createSsoRouteOptions } from "./sso";

const CustomSsoPage = () => null;

function ssoOptions() {
  return createSsoRouteOptions({ onLogin: () => Promise.resolve({}) });
}

describe("createSsoRouteOptions", () => {
  it("renders the landing page the application supplied", () => {
    expect(createSsoRouteOptions({ component: CustomSsoPage }).component).toBe(CustomSsoPage);
  });

  it("renders the framework's landing page when none is supplied", () => {
    expect(ssoOptions().component).not.toBe(CustomSsoPage);
  });

  it("refuses a pre-built value that mixes a custom page with default-page props", () => {
    const mixed = { component: CustomSsoPage, onLogin: () => Promise.resolve({}) };

    // @ts-expect-error -- a custom landing page forbids every default-page prop.
    // Excess-property checking already rejects the same shape written inline;
    // this is the pre-built form it cannot see, where onLogin would otherwise be
    // dropped in silence. The assertion is the absence of an error here.
    expect(createSsoRouteOptions(mixed).component).toBe(CustomSsoPage);
  });

  it("passes the handoff's parameters through untouched", () => {
    const search = {
      app_id: "zlhis",
      code: "one-time-code",
      deptId: "d1"
    };

    expect(ssoOptions().validateSearch(search)).toEqual(search);
  });
});
