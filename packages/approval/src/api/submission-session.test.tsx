import type { ApiRequest } from "@vef-framework-react/core";
import type { Ref } from "react";

import type { BusinessFormHandle } from "../plugins";
import type { MyInstanceDetail } from "../types";

import userEvent from "@testing-library/user-event";
import { BusinessError, HTTP_CLIENT } from "@vef-framework-react/core";
import { useImperativeHandle } from "react";

import { mockApprovalApi, render, renderHook, screen, waitFor } from "../../test-utils";
import { InstanceDetailDrawer } from "../components/detail/drawer";
import { StartInstanceDrawer } from "../pages/initiate-page/start-drawer";
import { ApprovalProvider } from "../plugins";
import { APPROVAL_ERROR_CODES } from "../types";
import { useInstanceApi } from "./instance-api";

const uuid = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const detail: MyInstanceDetail = {
  instance: {
    instanceId: "i",
    instanceNo: "2026-01",
    title: "费用申请",
    flowName: "报销",
    flowId: "f",
    flowCode: "expenses",
    businessKind: "expenses",
    applicant: { id: "u", name: "申请人" },
    status: "returned",
    createdAt: "2026-11-19"
  },
  availableActions: ["resubmit"],
  timeline: [],
  flowGraph: { nodes: [], edges: [] }
};

function formSession(action: "start" | "resubmit") {
  const writes = vi.fn<(request: ApiRequest) => unknown>();
  const apiClient = mockApprovalApi(request => {
    if (request.action === "get_start_form") {
      return {
        businessKind: "expenses",
        version: 1,
        flowName: "费用申请",
        applicant: detail.instance.applicant
      };
    }

    if (request.action === "get_instance_detail") {
      return detail;
    }

    return writes(request);
  });
  const collect = vi.fn<BusinessFormHandle["collect"]>().mockResolvedValue({ subject: "差旅" });

  function Panel({ handle }: { handle: Ref<BusinessFormHandle> }) {
    useImperativeHandle(handle, () => {
      return { collect };
    }, []);
    return null;
  }

  const plugins = { businessKinds: { expenses: { StartForm: Panel, DetailView: Panel } } };
  const close = vi.fn();

  function drawer(open: boolean) {
    return (
      <ApprovalProvider plugins={plugins}>
        {action === "start"
          ? <StartInstanceDrawer flowCode={open ? "expenses" : null} onClose={close} />
          : <InstanceDetailDrawer instanceId={open ? "i" : null} onClose={close} />}
      </ApprovalProvider>
    );
  }

  const { rerender } = render(drawer(true), { apiClient });
  const submit = () => screen.findByText(action === "start" ? "提交审批" : "重新提交");
  const keys = () => writes.mock.calls.map(([req]) => req.params?.idempotencyKey);
  return {
    collect,
    writes,
    keys,
    submit,
    apiClient,
    close,
    open: (value: boolean) => rerender(drawer(value))
  };
}

async function checkRetries(action: "start" | "resubmit") {
  const user = userEvent.setup();
  const session = formSession(action);
  const cause = new BusinessError(APPROVAL_ERROR_CODES.idempotencyConflict, "该幂等键已用于其他申请");
  session.writes.mockRejectedValue(cause);
  const form = { line: { price: 5, qty: 2 } };
  session.collect.mockResolvedValueOnce(form).mockResolvedValueOnce({ line: { qty: 2, price: 5 } });
  const submit = await session.submit();
  await user.click(submit);
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(cause.message);
  expect(screen.getAllByText(cause.message)).toHaveLength(1);
  expect(Object.getPrototypeOf(session.apiClient[HTTP_CLIENT]).post).toHaveBeenCalledWith("/api", expect.objectContaining({
    skipErrorMessage: true,
    data: expect.objectContaining({ action })
  }));
  const [original] = session.keys();
  expect(original).toMatch(uuid);
  await user.click(submit);
  await waitFor(() => expect(session.keys()).toEqual([original, original]));

  form.line.price = 6;
  session.collect.mockResolvedValue(form);
  await user.click(submit);
  await waitFor(() => expect(session.keys()).toHaveLength(3));
  const changed = session.keys()[2];
  expect(changed).toMatch(uuid);
  expect(changed).not.toBe(original);
  expect(session.writes.mock.calls[0]?.[0].params?.formData).toEqual({ line: { price: 5, qty: 2 } });

  session.open(false);
  session.open(true);
  await user.click(await session.submit());
  await waitFor(() => expect(session.keys()).toHaveLength(4));
  const reopened = session.keys()[3];
  expect(reopened).toMatch(uuid);
  return {
    original,
    changed,
    reopened
  };
}

describe("approval submission keys", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("retries starts with the same key and renews it for edits or a reopened drawer", async () => {
    const {
      original,
      changed,
      reopened
    } = await checkRetries("start");
    expect([original, changed]).not.toContain(reopened);
  });

  it("retries resubmissions with the same key and renews it for edits or a reopened drawer", async () => {
    const {
      original,
      changed,
      reopened
    } = await checkRetries("resubmit");
    expect([original, changed]).not.toContain(reopened);
  });

  it("locks a double click before collecting the business form", async () => {
    const user = userEvent.setup();
    const session = formSession("start");
    const pending = Promise.withResolvers<Record<string, unknown>>();
    session.collect.mockReturnValue(pending.promise);
    await user.dblClick(await session.submit());
    expect(session.collect).toHaveBeenCalledOnce();
    expect(session.writes).not.toHaveBeenCalled();
    pending.resolve({ amount: 1 });
    await waitFor(() => expect(session.close).toHaveBeenCalledOnce());
    expect(session.writes).toHaveBeenCalledOnce();
  });

  it("uses secure random bytes if the browser does not expose randomUUID", async () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const user = userEvent.setup();
    const session = formSession("start");
    await user.click(await session.submit());
    await waitFor(() => expect(session.keys()[0]).toMatch(uuid));
  });

  it("passes through supplied keys and leaves the field optional for API consumers", async () => {
    const writes: ApiRequest[] = [];
    const apiClient = mockApprovalApi(req => {
      writes.push(req);
    });
    const { result } = renderHook(() => useInstanceApi(), { apiClient });
    const start = { flowCode: "expenses", idempotencyKey: "SMP/start/01" };
    const resubmit = { instanceId: "i", idempotencyKey: "SMP/resubmit/02" };
    await apiClient.executeMutation({ mutationFn: result.current.start, params: start });
    await apiClient.executeMutation({ mutationFn: result.current.resubmit, params: resubmit });
    await apiClient.executeMutation({ mutationFn: result.current.start, params: { flowCode: "legacy" } });
    await apiClient.executeMutation({ mutationFn: result.current.resubmit, params: { instanceId: "legacy" } });
    expect(writes.map(req => req.action)).toEqual(["start", "resubmit", "start", "resubmit"]);
    expect(writes.map(req => req.params)).toEqual([start, resubmit, { flowCode: "legacy" }, { instanceId: "legacy" }]);
  });
});
