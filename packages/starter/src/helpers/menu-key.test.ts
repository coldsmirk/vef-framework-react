import type { UserMenu } from "../types";

import { menuKeyOf, resolveActiveMenuKey } from "./menu-key";

function leaf(path: string, meta?: UserMenu["meta"]): UserMenu {
  return {
    type: "menu",
    name: path,
    path,
    meta
  };
}

describe("menuKeyOf", () => {
  it("gives two menus on one template but different params distinct keys", () => {
    const sales = menuKeyOf("/report/$key", { params: { key: "sales" } });
    const hr = menuKeyOf("/report/$key", { params: { key: "hr" } });

    expect(sales).not.toBe(hr);
  });

  it("is stable regardless of param key order", () => {
    const a = menuKeyOf("/report/$key", { params: { a: "1", b: "2" } });
    const b = menuKeyOf("/report/$key", { params: { b: "2", a: "1" } });

    expect(a).toBe(b);
  });

  it("treats no meta and empty params as the same key", () => {
    expect(menuKeyOf("/list")).toBe(menuKeyOf("/list", { params: {} }));
  });
});

describe("resolveActiveMenuKey", () => {
  describe("when menus share a parameterized template", () => {
    const menus = [
      leaf("/report/$key", { params: { key: "sales" } }),
      leaf("/report/$key", { params: { key: "hr" } })
    ];

    it("resolves the menu whose params match the route", () => {
      const key = resolveActiveMenuKey(menus, { fullPath: "/report/$key", params: { key: "sales" } });

      expect(key).toBe(menuKeyOf("/report/$key", { params: { key: "sales" } }));
    });

    it("does not resolve a sibling whose params differ", () => {
      const key = resolveActiveMenuKey(menus, { fullPath: "/report/$key", params: { key: "sales" } });

      expect(key).not.toBe(menuKeyOf("/report/$key", { params: { key: "hr" } }));
    });

    it("returns undefined when no menu binds the route's params", () => {
      const key = resolveActiveMenuKey(menus, { fullPath: "/report/$key", params: { key: "unknown" } });

      expect(key).toBeUndefined();
    });
  });

  describe("for a plain route", () => {
    it("matches a menu that pins no params against an empty route params", () => {
      const menus = [leaf("/sys/dictionary")];

      const key = resolveActiveMenuKey(menus, { fullPath: "/sys/dictionary", params: {} });

      expect(key).toBe(menuKeyOf("/sys/dictionary"));
    });

    it("returns undefined when the template is not in the menu set", () => {
      const menus = [leaf("/sys/dictionary")];

      const key = resolveActiveMenuKey(menus, { fullPath: "/sys/role", params: {} });

      expect(key).toBeUndefined();
    });
  });

  describe("when menus differ by bound search", () => {
    const bare = leaf("/list");
    const active = leaf("/list", { search: { status: "active" } });
    const menus = [bare, active];

    it("keeps a bare menu highlighted even when the route adds runtime search", () => {
      const key = resolveActiveMenuKey([bare], {
        fullPath: "/list",
        params: {},
        search: { page: "2" }
      });

      expect(key).toBe(menuKeyOf("/list"));
    });

    it("prefers the search-specific menu over the bare one when the route matches it", () => {
      const key = resolveActiveMenuKey(menus, {
        fullPath: "/list",
        params: {},
        search: { status: "active" }
      });

      expect(key).toBe(menuKeyOf("/list", { search: { status: "active" } }));
    });

    it("falls back to the bare menu when the route's search does not match the specific one", () => {
      const key = resolveActiveMenuKey(menus, {
        fullPath: "/list",
        params: {},
        search: { status: "archived" }
      });

      expect(key).toBe(menuKeyOf("/list"));
    });
  });
});
