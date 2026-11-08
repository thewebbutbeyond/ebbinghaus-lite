import {
  decryptArchive, deriveArchiveKey, fileBytes, parseEncryptedArchive,
  type EncryptedArchive,
} from "./archive.ts";

export function archiveStorageKey(id: string, salt: string): string {
  return "ebbinghaus-lite:archive:" + id + ":" + salt;
}

export class ArchiveAccess {
  private archives = new Map<string, Promise<EncryptedArchive>>();
  private files = new Map<string, ReadonlyMap<string, string>>();

  isOpen(id: string): boolean { return this.files.has(id); }

  resourceUrl(id: string, path: string): string {
    const url = this.files.get(id)?.get(path);
    if (!url) throw new Error("Archive resource unavailable");
    return url;
  }

  private async load(id: string): Promise<EncryptedArchive> {
    let pending = this.archives.get(id);
    if (!pending) {
      pending = (async () => {
        const response = await fetch(import.meta.env.BASE_URL + "archives/" + id + ".enc.json");
        if (!response.ok) throw new Error("Archive unavailable");
        return parseEncryptedArchive(await response.json(), id);
      })();
      this.archives.set(id, pending);
    }
    try { return await pending; }
    catch (error) { this.archives.delete(id); throw error; }
  }

  private async open(archive: EncryptedArchive, key: string): Promise<void> {
    const contents = await decryptArchive(archive, key);
    const urls = new Map<string, string>();
    try {
      for (const [path, file] of Object.entries(contents.files)) {
        urls.set(path, URL.createObjectURL(new Blob([fileBytes(file)], { type: file.type })));
      }
    } catch (error) {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      throw error;
    }
    for (const url of this.files.get(archive.id)?.values() ?? []) URL.revokeObjectURL(url);
    this.files.set(archive.id, urls);
  }

  async restore(id: string): Promise<boolean> {
    if (this.isOpen(id)) return true;
    try {
      const prefix = "ebbinghaus-lite:archive:" + id + ":";
      if (!Object.keys(sessionStorage).some(key => key.startsWith(prefix))) return false;
      const archive = await this.load(id);
      const storageKey = archiveStorageKey(id, archive.salt);
      const key = sessionStorage.getItem(storageKey);
      if (!key) return false;
      try { await this.open(archive, key); return true; }
      catch { sessionStorage.removeItem(storageKey); return false; }
    } catch { return false; }
  }

  async unlock(id: string, password: string): Promise<void> {
    const archive = await this.load(id);
    const key = await deriveArchiveKey(password, archive.salt);
    await this.open(archive, key);
    try { sessionStorage.setItem(archiveStorageKey(id, archive.salt), key); }
    catch { /* The archive remains usable in memory when tab storage is unavailable. */ }
  }
}
