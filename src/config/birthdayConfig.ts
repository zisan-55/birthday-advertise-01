import clientData from "./client.json";
import type { ClientConfig, ClientPhoto } from "./clientTypes";
import { allocatePhotoSections, allClientPhotos } from "../lib/distributePhotos";

// The prebuild validator checks this JSON before production compilation.
const client = clientData as ClientConfig;
export const CLIENT_ARTWORK_MODE = "first-photo" as const;

// ============================================================================
// CLIENT INTAKE: edit src/config/client.json for names, dates, messages and photos.
// This file retains scene defaults and frame metadata; layout code stays untouched.
// ============================================================================

// Recipient aliases come from the centralized client intake.
export const BIRTHDAY_NAME = client.recipient.name;
export const BIRTHDAY_NICKNAME = client.recipient.nickname;
export const BIRTHDAY_AGE = client.recipient.age;
export const BIRTHDAY_DATE = client.recipient.birthdayDate; // YYYY-MM-DD
export const BIRTHDAY_TIME = client.recipient.birthdayTime; // 24-hour HH:MM:SS
export const BIRTHDAY_TIMEZONE = client.recipient.timezone; // IANA timezone, e.g. Asia/Dhaka

// The reveal counts to BIRTHDAY_AGE - 1, burns that number, then reveals the age.

const defaults = {
  // 1. RECIPIENT AND BIRTHDAY
  recipient: {
    name: BIRTHDAY_NAME,
    nickname: BIRTHDAY_NICKNAME,
    age: BIRTHDAY_AGE,
    birthdayDate: BIRTHDAY_DATE,
    birthdayTime: BIRTHDAY_TIME,
    timezone: BIRTHDAY_TIMEZONE,
  },

  // 2. THEATRE COUNTDOWN
  cinema: {
    enabled: true,
    topBannerText: "SAVE THE DATE",
    productionLead: "A",
    productionSuffix: "production",
    subtitleLead: "live",
    mainHeading: "NOW SHOWING",
    footerText: "DOORS OPEN AT MIDNIGHT",
    previewButtonText: "PREVIEW",
  },

  // 3. CINEMATIC BIRTHDAY REVEAL
  reveal: {
    enabled: true,
    displayAge: true,
    headlinePrefix: "Happy Birthday",
    backgroundImage: "/images/hero-dusk.svg",
    backgroundOverlayOpacity: 0.48,
    balloons: ["#3daf69", "#a855c8", "#298de0", "#efb837", "#db4051", "#ec6cae"],
    message: "Today, the whole world gets to celebrate you.",
    buttonText: "The Story of You",
  },

  // 4. EDITORIAL INTRODUCTION
  introduction: {
    enabled: true,
    headingLine1: "Happy",
    headingLine2: "Birthday",
    accentColor: "#F39800",
    message: "Wishing you a day filled with love, laughter, and all the happiness your heart can hold. May this year bring you endless joy and unforgettable memories. Happy Birthday!",
    footerLabel: "MADE FOR YOU, WITH LOVE",
    continueLabel: "Next Page",
  },

  // 5. THIRD-SCENE PHOTO CAROUSEL. Replace these paths; keep no more than five unique photos.
  photoCarousel: {
    enabled: true,
    photos: [
      { id: "carousel-01", src: "/images/gallery/photo-01.svg", alt: "A favorite memory, photo 1" },
      { id: "carousel-02", src: "/images/gallery/photo-02.svg", alt: "A favorite memory, photo 2" },
      { id: "carousel-03", src: "/images/gallery/photo-03.svg", alt: "A favorite memory, photo 3" },
      { id: "carousel-04", src: "/images/gallery/photo-04.svg", alt: "A favorite memory, photo 4" },
      { id: "carousel-05", src: "/images/gallery/photo-06.svg", alt: "A favorite memory, photo 5" },
    ],
  },

  // 6. FLOATING POLAROID COLLAGE
  gallery: {
    enabled: true,
    title: "Little pieces of us",
    eyebrow: "A COLLECTION OF FAVORITE MOMENTS",
    backgroundColor: "#D4CEC1",
    showGrid: true,
    albumButtonText: "OPEN THE SCRAPBOOK",
    universeButtonText: "ENTER THE PHOTO UNIVERSE",
    photos: [
      { id: "photo-01", src: "/images/gallery/photo-01.svg", caption: "Cutie 🥺", alt: "A favorite portrait", rotation: -6, size: "large", sticker: "heart" },
      { id: "photo-02", src: "/images/gallery/photo-02.svg", caption: "Baddie 😎", alt: "A playful memory", rotation: 4, size: "medium", sticker: "sparkle" },
      { id: "photo-03", src: "/images/gallery/photo-03.svg", caption: "Always You 🫶", alt: "A memory together", rotation: -3, size: "medium", sticker: "heart" },
      { id: "photo-04", src: "/images/gallery/photo-04.svg", caption: "Beautiful 🌸", alt: "A beautiful day", rotation: 7, size: "large", sticker: "flower" },
      { id: "photo-05", src: "/images/gallery/photo-05.svg", caption: "Dream Girl 💫", alt: "A favorite moment", rotation: -5, size: "small", sticker: "sparkle" },
      { id: "photo-06", src: "/images/gallery/photo-06.svg", caption: "Queen 👑", alt: "A favorite portrait", rotation: 3, size: "medium", sticker: "heart" },
      { id: "photo-07", src: "/images/gallery/photo-07.svg", caption: "My happy place", alt: "A happy memory", rotation: -7, size: "medium", sticker: "butterfly" },
      { id: "photo-08", src: "/images/gallery/photo-08.svg", caption: "This day ✨", alt: "A day to remember", rotation: 5, size: "small", sticker: "heart" },
      { id: "photo-09", src: "/images/gallery/photo-09.svg", caption: "My favorite", alt: "A favorite memory", rotation: -2, size: "large", sticker: "flower" },
      { id: "photo-10", src: "/images/gallery/photo-10.svg", caption: "Us, always 🤍", alt: "A memory together", rotation: 6, size: "medium", sticker: "heart" },
    ],
  },

  // 7. SCRAPBOOK. Pages are data-driven; add or remove page objects freely.
  scrapbook: {
    enabled: true,
    title: "Our little scrapbook",
    initialPage: 1,
    closeLabel: "CLOSE ALBUM",
    pages: [
      { id: "page-01", title: "The beginning", paperColor: "#171615", photos: [{ src: "/images/gallery/photo-01.svg", alt: "The beginning, first photograph", caption: "A little hello", rotation: -5 }, { src: "/images/gallery/photo-02.svg", alt: "The beginning, second photograph", caption: "And then you", rotation: 4 }], notes: ["Some stories start quietly.", "This one became my favorite."], stickers: ["flower", "star", "heart"] },
      { id: "page-02", title: "The first adventures", paperColor: "#171719", photos: [{ src: "/images/gallery/photo-03.svg", alt: "A first adventure", caption: "Out we go", rotation: 4 }, { src: "/images/gallery/photo-04.svg", alt: "A day out together", caption: "Just us", rotation: -3 }], notes: ["New places felt like home with you.", "Keep this day forever."], stickers: ["butterfly", "heart", "sparkle"] },
      { id: "page-03", title: "Ordinary magic", paperColor: "#191716", photos: [{ src: "/images/gallery/photo-05.svg", alt: "An ordinary happy moment", caption: "The little things", rotation: -4 }, { src: "/images/gallery/photo-06.svg", alt: "A small everyday memory", caption: "Our kind of day", rotation: 5 }], notes: ["The tiny moments became the big ones.", "Nothing fancy. Everything special."], stickers: ["heart", "flower", "star"] },
      { id: "page-04", title: "My favorite day", paperColor: "#1b1714", photos: [{ src: "/images/gallery/photo-07.svg", alt: "A favorite day together", caption: "Still smiling", rotation: -6 }, { src: "/images/gallery/photo-08.svg", alt: "A favorite memory", caption: "One for the books", rotation: 3 }], notes: ["I would choose this day again.", "You make every frame brighter."], stickers: ["sparkle", "heart", "butterfly"] },
      { id: "page-05", title: "A little celebration", paperColor: "#171719", photos: [{ src: "/images/gallery/photo-09.svg", alt: "A little celebration", caption: "Cake was involved", rotation: 5 }, { src: "/images/gallery/photo-10.svg", alt: "A joyful celebration", caption: "Make a wish", rotation: -4 }], notes: ["More candles, more reasons to celebrate.", "Save me a piece."], stickers: ["flower", "star", "heart"] },
      { id: "page-06", title: "The in-between", paperColor: "#1a1716", photos: [{ src: "/images/gallery/photo-01.svg", alt: "A quiet moment together", caption: "No plans, just us", rotation: -3 }, { src: "/images/gallery/photo-02.svg", alt: "A peaceful memory", caption: "Slow days", rotation: 6 }], notes: ["My favorite plan is time with you.", "Let's keep making room for this."], stickers: ["heart", "butterfly", "sparkle"] },
      { id: "page-07", title: "All the laughs", paperColor: "#191713", photos: [{ src: "/images/gallery/photo-03.svg", alt: "A laughing memory", caption: "You started it", rotation: 4 }, { src: "/images/gallery/photo-04.svg", alt: "A funny day together", caption: "Still laughing", rotation: -5 }], notes: ["The best jokes never get old.", "A little bit silly, a lot of joy."], stickers: ["star", "heart", "flower"] },
      { id: "page-08", title: "To be continued", paperColor: "#171617", photos: [{ src: "/images/gallery/photo-05.svg", alt: "A memory for the next chapter", caption: "Next page soon", rotation: -4 }, { src: "/images/gallery/photo-06.svg", alt: "A favorite person", caption: "Still my favorite", rotation: 5 }], notes: ["Here is to every memory still to come.", "There are so many good days ahead."], stickers: ["heart", "sparkle", "butterfly"] },
    ],
  },

  // 8. DARK FLOATING PHOTO UNIVERSE. Positions use viewport widths/heights
  // around the center and a depth value in pixels.
  photoUniverse: {
    enabled: true,
    title: "You Are My Universe",
    backgroundColor: "#050506",
    showStars: true,
    movementEnabled: true,
    autoDrift: true,
    returnLabel: "BACK TO THE PHOTOS",
    photos: [
      { id: "universe-01", src: "/images/gallery/photo-01.svg", caption: "A favorite memory", alt: "A favorite memory", scale: 1.12, rotation: -7, position: { x: -30, y: -16, z: 100 } },
      { id: "universe-02", src: "/images/gallery/photo-02.svg", caption: "My favorite memory", alt: "A favorite memory together", scale: 0.88, rotation: 5, position: { x: 25, y: -28, z: -80 } },
      { id: "universe-03", src: "/images/gallery/photo-03.svg", caption: "Always you", alt: "A memory to keep", scale: 1.0, rotation: 3, position: { x: 4, y: 21, z: 30 } },
      { id: "universe-04", src: "/images/gallery/photo-04.svg", caption: "This little moment", alt: "A happy memory", scale: 0.72, rotation: -5, position: { x: -45, y: 28, z: -150 } },
      { id: "universe-05", src: "/images/gallery/photo-05.svg", caption: "The good days", alt: "A day together", scale: 0.86, rotation: 8, position: { x: 46, y: 10, z: 180 } },
      { id: "universe-06", src: "/images/gallery/photo-06.svg", caption: "My sunshine", alt: "A favorite portrait", scale: 0.78, rotation: -3, position: { x: -14, y: -35, z: -220 } },
      { id: "universe-07", src: "/images/gallery/photo-07.svg", caption: "One for the books", alt: "A memorable day", scale: 0.92, rotation: 6, position: { x: 34, y: 37, z: -50 } },
      { id: "universe-08", src: "/images/gallery/photo-08.svg", caption: "Us, always", alt: "A memory together", scale: 1.06, rotation: -8, position: { x: -52, y: -4, z: -30 } },
      { id: "universe-09", src: "/images/gallery/photo-09.svg", caption: "A happy place", alt: "A happy memory", scale: 0.74, rotation: 4, position: { x: 13, y: 39, z: 220 } },
      { id: "universe-10", src: "/images/gallery/photo-10.svg", caption: "To more memories", alt: "A memory for the future", scale: 0.82, rotation: -2, position: { x: 54, y: -39, z: -170 } },
    ],
  },

  // 9. BACKGROUND MUSIC (one player stays mounted across Pages 2–6)
  audio: {
    enabled: true,
    src: `${import.meta.env.BASE_URL}audio/birthday-song.mp3`,
    showControls: true,
    defaultVolume: 0.5,
    title: "Tum Ho Toh",
    subtitle: "BIRTHDAY PLAYLIST",
    artwork: `${import.meta.env.BASE_URL}images/gallery/photo-01.svg`,
  },

  // 10. SMALL CLOSING NOTE, AVAILABLE INSIDE THE FINAL SCENE
  closing: {
    enabled: true,
    heading: "One last thing...",
    message: "May your life always be filled with beautiful memories and endless happiness.",
    signature: "With love",
    buttonText: "Replay the Experience",
    openButtonText: "A LITTLE NOTE",
  },

  // 11. LAYOUT PREFERENCES
  preferences: {
    animationsEnabled: true,
    reducedMotion: false,
    showCaptions: true,
    enablePhotoLightbox: true,
    mobileOptimized: true,
    missingPhotoLabel: "ADD YOUR PHOTO",
  },

  // 12. NAVIGATION LABELS
  navigation: {
    cinema: "Premiere",
    reveal: "The reveal",
    introduction: "The note",
    gallery: "Memories",
    scrapbook: "Scrapbook",
    universe: "Photo universe",
  },
} as const;



// Preserve section layouts; assign client content without changing frame geometry.
export function buildBirthdayConfig(input: ClientConfig) {
  const assigned = allocatePhotoSections(input.photos);
  function fill<T extends { src: string; alt: string; caption?: string }>(slot: T, photo: ClientPhoto): T {
    return { ...slot, src: photo.src, alt: photo.alt ?? slot.alt,
      ...("caption" in slot ? { caption: photo.caption ?? slot.caption } : {}) };
  }
  return {
    ...defaults, siteId: input.siteId, recipient: input.recipient, sender: input.sender,
    reveal: { ...defaults.reveal, message: input.messages.reveal ?? defaults.reveal.message },
    introduction: { ...defaults.introduction, message: input.messages.introduction ?? defaults.introduction.message },
    photoCarousel: { ...defaults.photoCarousel, photos: defaults.photoCarousel.photos.map((slot, i) => fill(slot, assigned.carousel[i])) },
    gallery: { ...defaults.gallery, photos: defaults.gallery.photos.map((slot, i) => fill(slot, assigned.memories[i])) },
    scrapbook: { ...defaults.scrapbook, pages: defaults.scrapbook.pages.map((page, i) => ({
      ...page, notes: input.scrapbookNotes[i] ?? page.notes,
      photos: page.photos.map((slot, j) => fill(slot, assigned.scrapbook[i * 2 + j])),
    })) },
    photoUniverse: { ...defaults.photoUniverse, layoutPhotoCount: defaults.photoUniverse.photos.length,
      photos: assigned.universe.map((photo, i) => ({
        ...fill(defaults.photoUniverse.photos[i % defaults.photoUniverse.photos.length], photo),
        id: "universe-slot-" + (i + 1),
      })),
    },
    audio: { ...defaults.audio, src: input.music.src ?? defaults.audio.src, title: input.music.title ?? defaults.audio.title,
      artwork: input.music.artwork ?? allClientPhotos(input.photos)[0].src,
    },
    closing: { ...defaults.closing, message: input.messages.closing ?? defaults.closing.message,
      signature: input.messages.signature ?? defaults.closing.signature },
  };
}
export const birthdayConfig = buildBirthdayConfig(client);
