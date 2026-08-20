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

  it("passes the handoff's parameters through untouched", () => {
    const search = {
      app_id: "zlhis",
      code: "one-time-code",
      deptId: "d1"
    };

    expect(ssoOptions().validateSearch(search)).toEqual(search);
  });
});
