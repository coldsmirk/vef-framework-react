import type { PermissionAware } from ".";

import { useAuthorizedItems } from ".";
import { renderHook } from "../../test-utils";

interface TestItem extends PermissionAware {
  id: string;
}

describe("useAuthorizedItems", () => {
  it("returns all items when checkPermission returns true", () => {
    const items: TestItem[] = [
      { id: "1", requiredPermissions: ["read"] },
      { id: "2", requiredPermissions: ["write"] },
      // No permissions required
      { id: "3" }
    ];

    const { result } = renderHook(() => useAuthorizedItems(items), {
      appContext: {
        hasPermission: () => true
      }
    });

    expect(result.current).toHaveLength(3);
    expect(result.current).toEqual(items);
  });

  it("filters out items when checkPermission returns false", () => {
    const items: TestItem[] = [
      { id: "1", requiredPermissions: ["read"] },
      { id: "2", requiredPermissions: ["write"] },
      // No permissions required
      { id: "3" }
    ];

    const { result } = renderHook(() => useAuthorizedItems(items), {
      appContext: {
        hasPermission: () => false
      }
    });

    expect(result.current).toHaveLength(1);
    expect(result.current).toEqual([{ id: "3" }]);
  });

  it("works with specific permission checks", () => {
    const items: TestItem[] = [
      { id: "1", requiredPermissions: ["read"] },
      { id: "2", requiredPermissions: ["write"] },
      { id: "3", requiredPermissions: ["admin"] }
    ];

    const { result } = renderHook(() => useAuthorizedItems(items), {
      appContext: {
        hasPermission: (permission: string) => permission === "read" || permission === "write"
      }
    });

    expect(result.current).toHaveLength(2);
    expect(result.current.map(item => item.id)).toEqual(["1", "2"]);
  });

  it("handles 'all' checkMode correctly", () => {
    const items: TestItem[] = [
      {
        id: "1",
        requiredPermissions: ["read", "write"],
        checkMode: "all"
      },
      {
        id: "2",
        requiredPermissions: ["read", "admin"],
        checkMode: "all"
      }
    ];

    const { result } = renderHook(() => useAuthorizedItems(items), {
      appContext: {
        hasPermission: (permission: string) => permission === "read" || permission === "write"
      }
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.id).toBe("1");
  });

  it("handles 'any' checkMode correctly (default)", () => {
    const items: TestItem[] = [
      { id: "1", requiredPermissions: ["read", "admin"] },
      { id: "2", requiredPermissions: ["admin", "super"] }
    ];

    const { result } = renderHook(() => useAuthorizedItems(items), {
      appContext: {
        hasPermission: (permission: string) => permission === "read"
      }
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.id).toBe("1");
  });

  it("updates results when items change", () => {
    const initialItems: TestItem[] = [
      { id: "1", requiredPermissions: ["read"] },
      { id: "2", requiredPermissions: ["write"] }
    ];

    const { result, rerender } = renderHook(
      ({ items }) => useAuthorizedItems(items),
      {
        initialProps: { items: initialItems },
        appContext: {
          hasPermission: (permission: string) => permission === "read"
        }
      }
    );

    // Initially should only return item with "read" permission
    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.id).toBe("1");

    // Add a new item with "read" permission
    rerender({
      items: [
        ...initialItems,
        { id: "3", requiredPermissions: ["read"] },
        { id: "4", requiredPermissions: ["admin"] }
      ]
    });

    // Should now return two items with "read" permission
    expect(result.current).toHaveLength(2);
    expect(result.current.map(item => item.id)).toEqual(["1", "3"]);

    // Remove items and add one without permissions
    rerender({
      items: [
        // No permissions required
        { id: "5" },
        { id: "6", requiredPermissions: ["admin"] }
      ]
    });

    // Should return only the item without permissions
    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.id).toBe("5");

    // Clear all items
    rerender({ items: [] });

    // Should return empty array
    expect(result.current).toHaveLength(0);
    expect(result.current).toEqual([]);
  });
});
