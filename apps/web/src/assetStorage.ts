export type CustomAssetCategory =
  | "Faith"
  | "Education"
  | "Health"
  | "Commercial"
  | "Community"
  | "Street"
  | "Park"
  | "Utility"
  | "Custom";

export type CustomAsset = {
  id: string;
  name: string;
  category: CustomAssetCategory;
  width: number;
  depth: number;
  height: number;
  fileName: string;
  size: number;
  createdAt: string;
  blob: Blob;
};

const DB_NAME = "sitecraft.assets.v1";
const STORE = "assets";
const urls = new Map<string, string>();

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}

export async function listCustomAssets(): Promise<CustomAsset[]> {
  const db = await database();
  try {
    return await request(
      db.transaction(STORE, "readonly").objectStore(STORE).getAll(),
    );
  } finally {
    db.close();
  }
}

export async function importCustomAsset(
  file: File,
  values: Pick<CustomAsset, "name" | "category" | "width" | "depth" | "height">,
): Promise<CustomAsset> {
  if (!file.name.toLowerCase().endsWith(".glb"))
    throw Error("Choose one .glb model. GLTF folders are not supported yet.");
  if (!file.size) throw Error("The selected model is empty.");
  if (file.size > 25 * 1024 * 1024)
    throw Error("The model is larger than the 25 MB limit.");
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (String.fromCharCode(...header) !== "glTF")
    throw Error("This file is not a valid binary GLB model.");
  const asset: CustomAsset = {
    id: crypto.randomUUID(),
    ...values,
    fileName: file.name,
    size: file.size,
    createdAt: new Date().toISOString(),
    blob: file,
  };
  const db = await database();
  try {
    await request(
      db.transaction(STORE, "readwrite").objectStore(STORE).put(asset),
    );
  } finally {
    db.close();
  }
  registerUrl(asset);
  window.dispatchEvent(new Event("sitecraft-assets-changed"));
  return asset;
}

function registerUrl(asset: CustomAsset) {
  if (urls.has(asset.id)) return;
  urls.set(asset.id, URL.createObjectURL(asset.blob));
}

export async function hydrateCustomAssetUrls() {
  const assets = await listCustomAssets();
  assets.forEach(registerUrl);
  return assets;
}

export function getCustomAssetUrlSync(assetRef: string) {
  if (!assetRef.startsWith("custom:")) return undefined;
  return urls.get(assetRef.slice("custom:".length));
}

export async function deleteCustomAsset(id: string) {
  const db = await database();
  try {
    await request(
      db.transaction(STORE, "readwrite").objectStore(STORE).delete(id),
    );
  } finally {
    db.close();
  }
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
  window.dispatchEvent(new Event("sitecraft-assets-changed"));
}
