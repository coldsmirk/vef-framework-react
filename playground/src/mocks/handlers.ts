import type { ApiRequest } from "@vef-framework-react/core";

import { http, HttpResponse } from "msw";

import { MockBusinessError, resolveMock } from "./define-mock";
import { getDemoAttachment, storeAttachmentPart } from "./modules/void-attachments";

import "./modules";

interface ApiResultBody<T = unknown> {
  code: number;
  message: string;
  data: T;
}

const MOCK_NOT_FOUND = 9999;
const MOCK_UNHANDLED_ERROR = 9998;

function ok<T>(data: T, message = "ok"): ApiResultBody<T> {
  return {
    code: 0,
    message,
    data
  };
}

function fail(code: number, message: string, data: unknown = null): ApiResultBody {
  return {
    code,
    message,
    data
  };
}

export const handlers = [
  http.get("*/storage/files/priv/meeting-demo/*", ({ request }) => {
    const file = getDemoAttachment(request.url);
    return new HttpResponse(file ?? null, {
      status: file ? 200 : 404,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }),
  http.post("*/api", async ({ request }) => {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();

      if (form.get("resource") === "sys/storage" && form.get("action") === "upload_part") {
        try {
          return HttpResponse.json(ok(storeAttachmentPart(form)));
        } catch (error) {
          return HttpResponse.json(fail(400, error instanceof Error ? error.message : "附件上传失败"));
        }
      }

      return HttpResponse.json(fail(MOCK_NOT_FOUND, "不支持的演示文件请求"));
    }

    const envelope = await request.json() as ApiRequest;
    const handler = resolveMock(envelope.resource, envelope.action);

    if (!handler) {
      const message = `mock not found: ${envelope.resource}/${envelope.action}`;
      console.warn(`[mocks] ${message}`);
      return HttpResponse.json(fail(MOCK_NOT_FOUND, message));
    }

    try {
      const data = await handler({
        params: envelope.params as never,
        meta: envelope.meta,
        version: envelope.version
      });
      return HttpResponse.json(ok(data));
    } catch (error) {
      if (error instanceof MockBusinessError) {
        return HttpResponse.json(fail(error.code, error.message, error.data));
      }

      const message = error instanceof Error ? error.message : String(error);
      console.error(`[mocks] handler "${envelope.resource}/${envelope.action}" threw`, error);
      return HttpResponse.json(fail(MOCK_UNHANDLED_ERROR, message));
    }
  })
];
