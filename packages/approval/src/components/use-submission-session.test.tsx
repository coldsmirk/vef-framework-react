import type { ApiRequest } from "@vef-framework-react/core";
import type { Ref } from "react";

import type { StartInstanceDrawerProps } from "../pages/initiate-page/start-drawer";
import type { BusinessFormHandle } from "../plugins";
import type { MyInstanceDetail } from "../types";

import userEvent from "@testing-library/user-event";
import { BusinessError, HTTP_CLIENT, QUERY_CLIENT } from "@vef-framework-react/core";
import { useImperativeHandle } from "react";

import { act, mockApprovalApi, render, renderHook, screen, waitFor, within } from "../../test-utils";
import { useInstanceApi } from "../api";
import { StartInstanceDrawer } from "../pages/initiate-page/start-drawer";
import { ApprovalProvider } from "../plugins";
import { APPROVAL_ERROR_CODES } from "../types";
import { InstanceDetailDrawer } from "./detail/drawer";

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

type Target = Pick<StartInstanceDrawerProps, "businessRef" | "voidTarget">;

function formSession(action: "start" | "resubmit", initialDetail = detail) {
  const readDetail = vi.fn(() => initialDetail);
  const writes = vi.fn<(request: ApiRequest) => unknown>();
  const apiClient = mockApprovalApi(request => {
    if (request.action === "get_start_form") {
      return {
        businessKind: initialDetail.instance.businessKind,
        formSchema: initialDetail.formSchema,
        version: 1,
        flowName: "费用申请",
        applicant: detail.instance.applicant
      };
    }

    if (request.action === "get_instance_detail") {
      return readDetail();
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

  function drawer(open: boolean, target?: Target) {
    return (
      <ApprovalProvider plugins={plugins}>
        {action === "start"
          ? <StartInstanceDrawer {...target} flowCode={open ? "expenses" : null} onClose={close} />
          : <InstanceDetailDrawer instanceId={open ? "i" : null} onClose={close} />}
      </ApprovalProvider>
    );
  }

  const { rerender } = render(drawer(true), { apiClient });
  const submit = () => screen.findByRole("button", { name: action === "start" ? "提交审批" : "重新提交" });
  const keys = () => writes.mock.calls.filter(([req]) => req.action === action).map(([req]) => req.params?.idempotencyKey);
  return {
    readDetail,
    collect,
    writes,
    keys,
    submit,
    apiClient,
    close,
    open: (value: boolean, target?: Target) => rerender(drawer(value, target))
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

async function checkFormRetries(action: "start" | "resubmit") {
  const user = userEvent.setup();
  const session = formSession(action, {
    ...detail,
    instance: { ...detail.instance, businessKind: undefined },
    formSchema: {
      id: "expense-form",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "title",
              key: "subject",
              type: "textfield",
              label: "事由"
            }
          ]
        }
      }
    }
  });
  const cause = new BusinessError(APPROVAL_ERROR_CODES.idempotencyConflict, "提交内容与原申请不一致");
  session.writes.mockRejectedValue(cause);
  const field = await screen.findByRole("textbox");
  await user.type(field, "差旅");
  const submit = await session.submit();
  await user.click(submit);
  expect(await screen.findByRole("alert")).toHaveTextContent(cause.message);
  expect(screen.getAllByText(cause.message)).toHaveLength(1);
  const [original] = session.keys();
  expect(original).toMatch(uuid);
  await user.click(submit);
  await waitFor(() => expect(session.keys()).toEqual([original, original]));
  await user.type(field, "报销");
  await user.click(submit);
  await waitFor(() => expect(session.keys()).toHaveLength(3));
  expect(session.keys()[2]).toMatch(uuid);
  expect(session.keys()[2]).not.toBe(original);
  expect(session.writes.mock.calls.map(([req]) => req.params?.formData)).toEqual([
    { subject: "差旅" },
    { subject: "差旅" },
    { subject: "差旅报销" }
  ]);
  return session.writes.mock.calls.at(-1)?.[0];
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

  it("retries a schema form start with the same key, changes it on edits and reports conflicts inline", async () => {
    const request = await checkFormRetries("start");
    expect(request).toMatchObject({ action: "start", params: { flowCode: "expenses" } });
  });

  it("retries a schema form resubmission with the same key, changes it on edits and reports conflicts inline", async () => {
    const request = await checkFormRetries("resubmit");
    expect(request).toMatchObject({ action: "resubmit", params: { instanceId: "i" } });
  });

  it("starts a new resubmission session after withdrawal from a returned instance", async () => {
    const user = userEvent.setup();
    const session = formSession("resubmit", { ...detail, availableActions: ["resubmit", "withdraw"] });
    const timeout = new Error("未收到提交结果");
    session.writes.mockImplementation(req => {
      if (req.action === "withdraw") {
        session.readDetail.mockReturnValue({ ...detail, instance: { ...detail.instance, status: "withdrawn" } });
        return;
      }

      throw timeout;
    });
    await user.click(await session.submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(timeout.message);
    const [original] = session.keys();
    expect(original).toMatch(uuid);
    await user.click(screen.getByRole("button", { name: /撤\s*回/ }));
    const reason = await screen.findByRole("textbox");
    const confirm = reason.closest<HTMLElement>("[role=\"dialog\"]")!;
    await user.click(within(confirm).getByRole("button", { name: /撤\s*回/ }));
    await waitFor(() => expect(screen.queryByText(timeout.message)).not.toBeInTheDocument());
    await user.click(await session.submit());
    await waitFor(() => expect(session.keys()).toHaveLength(2));
    expect(session.keys()[1]).toMatch(uuid);
    expect(session.keys()[1]).not.toBe(original);
  });

  it("renews the key when the same mounted instance returns for another revision", async () => {
    const user = userEvent.setup();
    const session = formSession("resubmit");
    session.writes.mockRejectedValue(new Error("未收到提交结果"));
    await user.click(await session.submit());
    await screen.findByRole("alert");
    const [original] = session.keys();
    session.readDetail.mockReturnValue({
      ...detail,
      timeline: [
        {
          kind: "approval",
          visitId: "another-visit",
          startedAt: "2026-11-20"
        }
      ]
    });
    await act(() => session.apiClient[QUERY_CLIENT].refetchQueries());
    await waitFor(() => expect(screen.queryByText("未收到提交结果")).not.toBeInTheDocument());
    await user.click(await session.submit());
    await waitFor(() => expect(session.keys()).toHaveLength(2));
    expect(session.keys()[1]).toMatch(uuid);
    expect(session.keys()[1]).not.toBe(original);
  });

  it("clears the previous start error and renews the key on business reference and void target changes", async () => {
    const user = userEvent.setup();
    const session = formSession("start");
    session.writes.mockRejectedValue(new Error("提交失败"));

    for (const target of [{ businessRef: "first" }, { businessRef: "second" }, { businessRef: "second", voidTarget: { instanceId: "another" } }]) {
      session.open(true, target);
      expect(screen.queryByText("提交失败")).not.toBeInTheDocument();
      await user.click(await session.submit());
      expect(await screen.findByRole("alert")).toHaveTextContent("提交失败");
    }

    expect(new Set(session.keys()).size).toBe(3);
  });

  it("discards collection completed after closing even when another start drawer is open", async () => {
    const user = userEvent.setup();
    const session = formSession("start");
    const pending = Promise.withResolvers<Record<string, unknown>>();
    session.collect.mockReturnValueOnce(pending.promise);
    await user.click(await session.submit());
    expect(session.collect).toHaveBeenCalledOnce();
    session.open(false);
    session.open(true);
    await session.submit();
    await act(async () => {
      pending.resolve({ subject: "旧申请" });
      await pending.promise;
    });
    expect(session.writes).not.toHaveBeenCalled();
    expect(session.close).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(await session.submit());
    await waitFor(() => expect(session.writes).toHaveBeenCalledOnce());
    expect(session.writes.mock.calls[0]?.[0].params?.formData).toEqual({ subject: "差旅" });
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

  it("keeps the default HTTP error feedback for direct API starts and resubmissions", async () => {
    const conflict = new BusinessError(APPROVAL_ERROR_CODES.idempotencyConflict, "提交冲突");
    const apiClient = mockApprovalApi(() => {
      throw conflict;
    });
    const { result } = renderHook(() => useInstanceApi(), { apiClient });
    await expect(apiClient.executeMutation({ mutationFn: result.current.start, params: { flowCode: "expenses" } })).rejects.toBe(conflict);
    await expect(apiClient.executeMutation({ mutationFn: result.current.resubmit, params: { instanceId: "i" } })).rejects.toBe(conflict);
    const { post } = Object.getPrototypeOf(apiClient[HTTP_CLIENT]);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).not.toHaveBeenCalledWith("/api", expect.objectContaining({ skipErrorMessage: true }));
  });
});
