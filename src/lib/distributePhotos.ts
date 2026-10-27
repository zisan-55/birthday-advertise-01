import type { ClientPhoto, PhotoIntake } from "../config/clientTypes";
export type { ClientPhoto } from "../config/clientTypes";
export const PHOTO_PACKAGES = [10, 15, 20] as const;
export function allClientPhotos(photos: PhotoIntake): ClientPhoto[] {
  return [...photos.regular, ...photos.couple];
}
/** Stable cyclic reuse. Validated unique input prevents adjacent repeats. */
export function distributePhotos<T extends ClientPhoto>(photos: readonly T[], capacity: number): T[] {
  if (!photos.length) throw new Error("Client photos must not be empty.");
  const result = Array.from({ length: capacity }, (_, index) => photos[index % photos.length]);
  if (result.length > 1 && result.at(-1)!.src === result[0].src) {
    const alternative = photos.find(photo => photo.src !== result[0].src && photo.src !== result.at(-2)!.src);
    if (alternative) result[result.length - 1] = alternative;
  }
  return result;
}
export function allocatePhotoSections(photos: PhotoIntake) {
  const regularFirst = allClientPhotos(photos);
  const coupleFirst = [...photos.couple, ...photos.regular];
  return {
    carousel: distributePhotos(regularFirst, 5),
    memories: distributePhotos(regularFirst, 10),
    scrapbook: distributePhotos(coupleFirst, 16),
    universe: distributePhotos(regularFirst, 35),
  };
}
