export function validateWish(payload: unknown): { data: { requestId: string; name: string; message: string }; error?: never } | { data?: never; error: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { error: "입력 내용을 확인해 주세요." };
  const value = payload as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name || name.length > 20 || /[\x00-\x1F\x7F]/.test(name)) return { error: "이름을 1~20자로 적어 주세요." };
  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (!message || message.length > 300 || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(message)) return { error: "축하 메시지를 1~300자로 적어 주세요." };
  if (typeof value.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId)) return { error: "요청 정보가 올바르지 않습니다. 페이지를 새로고침해 주세요." };
  return { data: { requestId: value.requestId, name, message } };
}
