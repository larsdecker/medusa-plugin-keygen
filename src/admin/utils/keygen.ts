export const loadRecent = (key: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]")
  } catch {
    return []
  }
}

export const pushRecent = (key: string, value: string) => {
  if (!value) return
  const arr = loadRecent(key).filter((v) => v !== value)
  arr.unshift(value)
  localStorage.setItem(key, JSON.stringify(arr.slice(0, 10)))
}

export interface ValidationResponse {
  ok: boolean
  data?: { name?: string }
  message?: string
}

export async function validateOnServer(
  type: "product" | "policy",
  id: string
): Promise<ValidationResponse> {
  if (!id) return { ok: false, message: "ID missing" }
  const res = await fetch(`/admin/keygen/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, id }),
    credentials: "include",
  })
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    return { ok: false, message: `Error ${res.status}: ${t}` }
  }
  const json = await res.json()
  return { ok: true, data: json }
}
