import { PermissionGate } from ".";
import { render, screen } from "../../test-utils";

describe("PermissionGate", () => {
  const mockHasPermission = vi.fn();

  beforeEach(() => {
    mockHasPermission.mockClear();
  });

  describe("ReactNode children", () => {
    it("renders children when user has permission", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate requiredPermissions={["user:read"]}>
          <div>Protected Content</div>
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
      expect(mockHasPermission).toHaveBeenCalled();
    });

    it("renders null when user has no permission", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <PermissionGate requiredPermissions={["user:read"]}>
          <div>Protected Content</div>
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(mockHasPermission).toHaveBeenCalled();
    });

    it("handles multiple permissions with 'any' mode (default)", () => {
      // User has 'user:read' but not 'user:write'
      mockHasPermission.mockImplementation((permission: string) => permission === "user:read");

      render(
        <PermissionGate requiredPermissions={["user:read", "user:write"]}>
          <div>Protected Content</div>
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("handles multiple permissions with 'all' mode", () => {
      // User has 'user:read' but not 'user:write'
      mockHasPermission.mockImplementation((permission: string) => permission === "user:read");

      render(
        <PermissionGate
          checkMode="all"
          requiredPermissions={["user:read", "user:write"]}
        >
          <div>Protected Content</div>
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("renders content when user has all required permissions in 'all' mode", () => {
      // User has both permissions
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          checkMode="all"
          requiredPermissions={["user:read", "user:write"]}
        >
          <div>Protected Content</div>
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  describe("Function children", () => {
    it("calls function with true when user has permission", () => {
      mockHasPermission.mockReturnValue(true);
      const childrenFn = vi.fn().mockReturnValue(<div>Has Permission</div>);

      render(
        <PermissionGate requiredPermissions={["user:read"]}>
          {childrenFn}
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(childrenFn).toHaveBeenCalledWith(true);
      expect(screen.getByText("Has Permission")).toBeInTheDocument();
    });

    it("calls function with false when user has no permission", () => {
      mockHasPermission.mockReturnValue(false);
      const childrenFn = vi.fn().mockReturnValue(<div>No Permission</div>);

      render(
        <PermissionGate requiredPermissions={["user:read"]}>
          {childrenFn}
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(childrenFn).toHaveBeenCalledWith(false);
      expect(screen.getByText("No Permission")).toBeInTheDocument();
    });

    it("allows custom no-permission content through function children", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <PermissionGate requiredPermissions={["admin:manage"]}>
          {hasPermission => hasPermission ? <div>Admin Panel</div> : <div>Access Denied</div>}
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(screen.getByText("Access Denied")).toBeInTheDocument();
      expect(screen.queryByText("Admin Panel")).not.toBeInTheDocument();
    });

    it("handles complex permission logic through function children", () => {
      // User has 'user:read' but not 'admin:write'
      mockHasPermission.mockImplementation((permission: string) => permission === "user:read");

      render(
        <PermissionGate
          checkMode="any"
          requiredPermissions={["user:read", "admin:write"]}
        >
          {hasPermission => (
            <div>
              {hasPermission ? "Partial Access" : "No Access"}
            </div>
          )}
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(screen.getByText("Partial Access")).toBeInTheDocument();
    });
  });

  describe("Single required permission", () => {
    it("handles a single string permission", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate requiredPermissions="user:read">
          <div>Single Permission Content</div>
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(screen.getByText("Single Permission Content")).toBeInTheDocument();
      expect(mockHasPermission).toHaveBeenCalled();
    });

    it("handles a single string permission without access", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <PermissionGate requiredPermissions="admin:write">
          <div>Admin Content</div>
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles empty permissions array", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate requiredPermissions={[]}>
          <div>Always Visible</div>
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      // Empty array means no permissions required, so it should not render (since some([]) = false)
      expect(screen.queryByText("Always Visible")).not.toBeInTheDocument();
    });

    it("handles undefined required permissions", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate>
          <div>No Permissions Required</div>
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(screen.getByText("No Permissions Required")).toBeInTheDocument();
    });

    it("handles missing children", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate requiredPermissions="user:read" />,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      // Should not throw error and render nothing
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("handles missing app context gracefully", () => {
      render(
        <PermissionGate requiredPermissions={["user:read"]}>
          <div>Protected Content</div>
        </PermissionGate>
      );

      // Without app context, useIsAuthorized defaults to hasPermission = () => true
      // So it should render the protected content
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("re-renders when permissions change", () => {
      mockHasPermission.mockReturnValue(true);

      const { rerender } = render(
        <PermissionGate requiredPermissions={["user:read"]}>
          <div>Content</div>
        </PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(screen.getByText("Content")).toBeInTheDocument();

      // Change to a permission the user doesn't have
      mockHasPermission.mockReturnValue(false);

      rerender(
        <PermissionGate requiredPermissions={["admin:write"]}>
          <div>Content</div>
        </PermissionGate>
      );

      expect(screen.queryByText("Content")).not.toBeInTheDocument();
    });

    it("handles function children with undefined required permissions", () => {
      mockHasPermission.mockReturnValue(true);
      const childrenFn = vi.fn().mockReturnValue(<div>Function Result</div>);

      render(
        <PermissionGate>{childrenFn}</PermissionGate>,
        {
          appContext: {
            hasPermission: mockHasPermission
          }
        }
      );

      expect(childrenFn).toHaveBeenCalledWith(true);
      expect(screen.getByText("Function Result")).toBeInTheDocument();
    });
  });
});
