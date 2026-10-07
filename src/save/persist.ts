import { readSaveHeader } from './apply';
import type { SaveModeName } from './apply';

const DB_NAME = 'myterra';
const DB_VERSION = 1;
const STORE_WORLDS = 'worlds';
const STORE_META = 'meta';
const SETTINGS_KEY = 'settings';

export interface WorldMeta {
  readonly id: string;
  readonly name: string;
  readonly reachWidth: number;
  readonly seed: number;
  readonly mode: SaveModeName;
  readonly createdAt: number;
  readonly lastPlayed: number;
  readonly lastSlot: number;
  readonly spawnX: number;
  readonly spawnY: number;
}

interface StoredSave {
  readonly savedAt: number;
  readonly data: Uint8Array;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error('MyTerra: IndexedDB request failed'));
    };
  });
}

/** IndexedDB storage: rotating save slots per world, a meta index and settings. */
export class SaveStore {
  private db: IDBDatabase | null = null;

  public async open(): Promise<void> {
    if (this.db) return;
    if (typeof indexedDB === 'undefined') {
      throw new Error('MyTerra: IndexedDB is unavailable');
    }
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(STORE_WORLDS)) db.createObjectStore(STORE_WORLDS);
        if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
      };
      open.onsuccess = () => {
        resolve(open.result);
      };
      open.onerror = () => {
        reject(open.error ?? new Error('MyTerra: could not open IndexedDB'));
      };
    });
  }

  public async listWorlds(): Promise<WorldMeta[]> {
    const all = await request<WorldMeta[]>(
      this.store(STORE_META, 'readonly').getAll() as IDBRequest<WorldMeta[]>,
    );
    return all.sort((a, b) => b.lastPlayed - a.lastPlayed);
  }

  public async getMeta(id: string): Promise<WorldMeta | null> {
    const meta = await request<WorldMeta | undefined>(
      this.store(STORE_META, 'readonly').get(id) as IDBRequest<WorldMeta | undefined>,
    );
    return meta ?? null;
  }

  /** Writes to the non-current slot, then flips `lastSlot`. */
  public async saveWorld(meta: WorldMeta, bytes: Uint8Array): Promise<WorldMeta> {
    const slot = meta.lastSlot === 0 ? 1 : 0;
    const record: StoredSave = { savedAt: Date.now(), data: bytes };
    await request(this.store(STORE_WORLDS, 'readwrite').put(record, `${meta.id}#${slot}`));
    const updated: WorldMeta = { ...meta, lastSlot: slot, lastPlayed: Date.now() };
    await request(this.store(STORE_META, 'readwrite').put(updated, meta.id));
    return updated;
  }

  /** Picks the newest slot whose header validates. */
  public async loadWorld(id: string): Promise<{ meta: WorldMeta; bytes: Uint8Array } | null> {
    const meta = await this.getMeta(id);
    if (!meta) return null;

    const order = [meta.lastSlot, meta.lastSlot === 0 ? 1 : 0];
    let best: StoredSave | null = null;
    for (const slot of order) {
      const record = await request<StoredSave | undefined>(
        this.store(STORE_WORLDS, 'readonly').get(`${id}#${slot}`) as IDBRequest<
          StoredSave | undefined
        >,
      );
      if (!record) continue;
      const data = record.data instanceof Uint8Array ? record.data : new Uint8Array(record.data);
      try {
        readSaveHeader(data);
      } catch {
        continue;
      }
      if (!best || record.savedAt > best.savedAt) best = { savedAt: record.savedAt, data };
    }
    if (!best) return null;
    return { meta, bytes: best.data };
  }

  public async deleteWorld(id: string): Promise<void> {
    const worlds = this.store(STORE_WORLDS, 'readwrite');
    await request(worlds.delete(`${id}#0`));
    await request(worlds.delete(`${id}#1`));
    await request(this.store(STORE_META, 'readwrite').delete(id));
  }

  public async saveSettings(settings: unknown): Promise<void> {
    await request(this.store(STORE_META, 'readwrite').put(settings, SETTINGS_KEY));
  }

  public async loadSettings(): Promise<unknown> {
    return request<unknown>(this.store(STORE_META, 'readonly').get(SETTINGS_KEY));
  }

  public close(): void {
    this.db?.close();
    this.db = null;
  }

  private store(name: string, mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error('MyTerra: SaveStore is not open');
    return this.db.transaction(name, mode).objectStore(name);
  }
}
