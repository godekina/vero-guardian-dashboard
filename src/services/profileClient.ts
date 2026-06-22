const CACHE_KEY = 'contrib_profiles_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type ContributorProfile = {
  displayName?: string;
  avatarUrl?: string;
};

type CacheRecord = {
  fetchedAt: number;
  data: Record<string, ContributorProfile>;
};

function readCache(): CacheRecord | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheRecord;
    if (!parsed || typeof parsed.fetchedAt !== 'number' || typeof parsed.data !== 'object') return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: Record<string, ContributorProfile>): void {
  try {
    const record: CacheRecord = { fetchedAt: Date.now(), data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }
}

/**
 * Fetch contributor profiles from a configurable service.
 * The service base URL should be set in `NEXT_PUBLIC_PROFILE_SERVICE_URL`.
 * Expected optional endpoint: `${base}/profiles?ids=id1,id2` returning
 * `{ [id]: { displayName?: string, avatarUrl?: string } }`.
 * If no service is configured, resolves to empty results.
 */
export async function fetchContributorProfiles(ids: string[]): Promise<Record<string, ContributorProfile>> {
  if (ids.length === 0) return {};

  const cached = readCache();
  const result: Record<string, ContributorProfile> = { ...(cached?.data ?? {}) };
  const missing = ids.filter((id) => !(id in result));

  const base = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_PROFILE_SERVICE_URL as string | undefined) : undefined;
  if (!base || missing.length === 0) {
    return result;
  }

  try {
    const url = new URL('/profiles', base);
    url.searchParams.set('ids', missing.join(','));
    const resp = await fetch(url.toString());
    if (!resp.ok) return result;
    const body = (await resp.json()) as Record<string, ContributorProfile>;
    for (const id of Object.keys(body)) {
      result[id] = body[id] ?? {};
    }
    writeCache(result);
  } catch {
    // ignore network failures and return whatever we have
  }

  return result;
}
