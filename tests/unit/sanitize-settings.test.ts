import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/custom-templates/route";

// Q-1b: sanitizeSettings 회귀 테스트 (prototype pollution + depth guard).
//
// 전략: sanitizeSettings 는 route-file-local (unexported). 따라서 POST 핸들러를
// 직접 invoke 하여 400 응답 + error 메시지로 간접 검증. 모든 케이스는
// sanitize 단계에서 400 으로 실패하므로 getDb() 에 도달하지 않는다 → DB mock 불필요.
// Happy path (201) 는 Q-3 integration 테스트에서 커버.

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/custom-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Raw body helper: 일부 케이스는 JS object literal 로 표현 불가능
// (예: { __proto__: ... } 는 literal 에서 prototype 세터로 처리되어 own-key 가 아님).
// JSON 문자열을 직접 전달하면 JSON.parse 가 own-key 로 파싱하여 실제 공격 페이로드를 재현.
function makeRawRequest(rawJsonBody: string): NextRequest {
  return new NextRequest("http://localhost/api/custom-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawJsonBody,
  });
}

describe("sanitizeSettings (via POST /api/custom-templates)", () => {
  it("rejects __proto__ at top-level with 400 + forbidden keys error", async () => {
    // __proto__ 는 object-literal 에서 특수 세터이므로 raw JSON 으로 전달해야
    // JSON.parse 결과에 실제 own-key 로 존재. 이것이 실제 공격 페이로드.
    const raw = JSON.stringify({
      name: "test-proto-top",
      category: "custom",
      settings: {},
    }).replace('"settings":{}', '"settings":{"__proto__":{"polluted":true}}');
    const req = makeRawRequest(raw);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string; code?: string };
    expect(json.error).toMatch(/forbidden keys/);
    expect(json.code).toBe("forbidden_keys");
  });

  it("rejects constructor key nested at depth 2 with 400", async () => {
    const req = makeRequest({
      name: "test-ctor-nested",
      category: "custom",
      settings: { nested: { constructor: { x: 1 } } },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string; code?: string };
    expect(json.error).toMatch(/forbidden keys/);
    expect(json.code).toBe("forbidden_keys");
  });

  it("rejects prototype key at top-level with 400", async () => {
    const req = makeRequest({
      name: "test-prototype",
      category: "custom",
      settings: { prototype: "x" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string; code?: string };
    expect(json.error).toMatch(/forbidden keys/);
    expect(json.code).toBe("forbidden_keys");
  });

  it("rejects deeply nested object (> MAX_SANITIZE_DEPTH=32) with 400 + depth_exceeded", async () => {
    // 40-level nested object: { x: { x: { x: ... { leaf: 1 } } } }
    let s: unknown = { leaf: 1 };
    for (let i = 0; i < 40; i++) {
      s = { x: s };
    }
    const req = makeRequest({
      name: "test-depth",
      category: "custom",
      settings: s,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string; code?: string };
    expect(json.error).toMatch(/depth_exceeded/);
    expect(json.code).toBe("depth_exceeded");
  });

  it("rejects __proto__ inside array element object with 400 (recursive walker covers arrays)", async () => {
    // 동일 이유로 raw JSON payload 사용 — JSON.parse 가 array 원소 내 __proto__ 를 own-key 로 만든다.
    const raw =
      '{"name":"test-proto-array","category":"custom","settings":{"items":[{"__proto__":{"x":1}}]}}';
    const req = makeRawRequest(raw);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string; code?: string };
    expect(json.error).toMatch(/forbidden keys/);
    expect(json.code).toBe("forbidden_keys");
  });
});
