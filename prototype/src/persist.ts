/* Persistence: the artifact `db` capability when available, localStorage otherwise. */
type Doc = Record<string, unknown>;
declare global { interface Window { claude?: { use: (name: string) => Promise<any> } } }

export type Persist = {
  mode: "db" | "local";
  loadAll(collections: string[]): Promise<Record<string, Doc[]>>;
  save(collection: string, id: string, doc: Doc): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
};

const LS_KEY = "ni-prototype-v1";
function lsRead(): Record<string, Record<string, Doc>> { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } }
function lsWrite(all: Record<string, Record<string, Doc>>) { try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch { /* storage unavailable */ } }

export async function createPersist(): Promise<Persist> {
  let db: any = null;
  try {
    if (window.claude?.use) db = await Promise.race([window.claude.use("db"), new Promise((r) => setTimeout(() => r(null), 4000))]);
  } catch { db = null; }
  if (db) {
    return {
      mode: "db",
      async loadAll(collections) {
        const out: Record<string, Doc[]> = {};
        await Promise.all(collections.map(async (c) => {
          try { const snap = await db.collection(c).limit(1000).get(); out[c] = snap.docs.filter((d: any) => d.exists).map((d: any) => ({ ...(d.data() as Doc), id: d.id })); }
          catch { out[c] = []; }
        }));
        return out;
      },
      async save(c, id, doc) { await db.doc(`${c}/${id}`).set(doc); },
      async remove(c, id) { await db.doc(`${c}/${id}`).delete(); },
    };
  }
  return {
    mode: "local",
    async loadAll(collections) { const all = lsRead(); const out: Record<string, Doc[]> = {}; for (const c of collections) out[c] = Object.values(all[c] ?? {}); return out; },
    async save(c, id, doc) { const all = lsRead(); (all[c] ??= {})[id] = doc; lsWrite(all); },
    async remove(c, id) { const all = lsRead(); if (all[c]) delete all[c][id]; lsWrite(all); },
  };
}
