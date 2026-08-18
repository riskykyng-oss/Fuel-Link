import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

import { getFirebaseApp, isFirebaseConfigured } from "./firebase";

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/** True when a real Firebase project is wired up and uploads will work. */
export function canUpload(): boolean {
  return isFirebaseConfigured();
}

async function upload(file: File, path: string): Promise<string> {
  const app = getFirebaseApp();
  if (!app) throw new UploadError("Firebase Storage is not configured yet.");
  const storage = getStorage(app);
  const snapshot = await uploadBytes(ref(storage, path), file);
  return getDownloadURL(snapshot.ref);
}

function ext(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1) : "jpg";
}

/** Motorist breakdown/request photo, shown to the supplier on the job. */
export async function uploadBreakdownPhoto(file: File, userId: number, orderRef?: string): Promise<string> {
  return upload(file, `breakdowns/u${userId}/${orderRef ?? "new"}-${Date.now()}.${ext(file.name)}`);
}

/** Garage logo shown to motorists and on supplier profiles. */
export async function uploadGarageLogo(file: File, userId: number): Promise<string> {
  return upload(file, `garages/u${userId}/logo-${Date.now()}.${ext(file.name)}`);
}

/** Station photo used on the fuel-prices screen. */
export async function uploadStationPhoto(file: File, stationId: number): Promise<string> {
  return upload(file, `stations/s${stationId}/photo-${Date.now()}.${ext(file.name)}`);
}
