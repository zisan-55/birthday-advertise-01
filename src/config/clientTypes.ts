export type ClientPhoto = { src: string; alt?: string | null; caption?: string | null };
export type PhotoIntake = { regular: readonly ClientPhoto[]; couple: readonly ClientPhoto[] };
export type PhotoPackage = 10 | 15 | 20;
export type ClientConfig = {
  siteId: string;
  recipient: { name: string; nickname: string; age: number; birthdayDate: string; birthdayTime: string; timezone: string };
  sender: { name: string };
  photoPackage: PhotoPackage;
  photos: PhotoIntake;
  messages: { reveal?: string | null; introduction?: string | null; closing?: string | null; signature?: string | null };
  music: { src?: string | null; title?: string | null; artwork?: string | null };
  scrapbookNotes: readonly (readonly string[] | null)[];
};
