export const NICKNAME_STORAGE_KEY = "user_nickname";
export const NICKNAME_MIN = 4;
export const NICKNAME_MAX = 12;

export function isValidNickname(value: string): boolean {
  const length = value.trim().length;
  return length >= NICKNAME_MIN && length <= NICKNAME_MAX;
}

type StoredNickname = {
  nickname: string;
  email?: string | null;
};

function parseStored(raw: string | null): StoredNickname | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredNickname;
    if (parsed && typeof parsed.nickname === "string") return parsed;
  } catch {
    if (isValidNickname(raw)) return { nickname: raw.trim() };
  }
  return null;
}

export function readStoredNickname(email?: string | null): string | null {
  if (typeof window === "undefined") return null;
  const stored = parseStored(window.localStorage.getItem(NICKNAME_STORAGE_KEY));
  if (!stored || !isValidNickname(stored.nickname)) return null;
  if (stored.email && email && stored.email !== email) return null;
  return stored.nickname.trim();
}

export function writeStoredNickname(nickname: string, email?: string | null) {
  if (typeof window === "undefined") return;
  const payload: StoredNickname = { nickname: nickname.trim(), email: email ?? null };
  window.localStorage.setItem(NICKNAME_STORAGE_KEY, JSON.stringify(payload));
}
