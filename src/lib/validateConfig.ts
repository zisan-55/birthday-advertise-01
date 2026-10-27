import { birthdayConfig } from "../config/birthdayConfig";
import { getCountdown } from "./time";

type MediaRecord = { id: string; src: string };

function isEmptyList(items: readonly unknown[]): boolean {
  return items.length === 0;
}

function validateMedia(label: string, items: readonly MediaRecord[], warnings: string[]) {
  const ids = new Set<string>();
  items.forEach((item) => {
    if (!item.id || ids.has(item.id)) warnings.push(label + " photo IDs must be present and unique: " + item.id);
    ids.add(item.id);
    if (!item.src || !(item.src.startsWith("/") || item.src.startsWith("https://"))) {
      warnings.push(label + " photo " + item.id + " needs a local /... path or an https:// URL.");
    }
  });
}

export function validateBirthdayConfig(config = birthdayConfig): string[] {
  const warnings: string[] = [];
  const recipient = config.recipient;
  if (!recipient.name.trim()) warnings.push("Add a recipient name in config.ts.");
  if (config.reveal.displayAge && (!Number.isInteger(recipient.age) || recipient.age < 1)) {
    warnings.push("The displayed age must be a positive whole number.");
  }
  if (config.cinema.enabled) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: recipient.timezone });
      if (!getCountdown(recipient.birthdayDate, recipient.birthdayTime, recipient.timezone).valid) {
        warnings.push("The birthday date or time is invalid. The countdown will show a setup message.");
      }
    } catch {
      warnings.push("The timezone is not recognized. Check recipient.timezone in config.ts.");
    }
  }
  validateMedia("Birthday carousel", config.photoCarousel.photos, warnings);
  if (config.photoCarousel.photos.length > 5) {
    warnings.push("Birthday carousel supports at most five photos; remove extra entries from photoCarousel.photos.");
  }
  validateMedia("Gallery", config.gallery.photos, warnings);
  validateMedia("Universe", config.photoUniverse.photos, warnings);
  const pageIds = new Set<string>();
  config.scrapbook.pages.forEach((page) => {
    if (!page.id || pageIds.has(page.id)) warnings.push("Scrapbook page IDs must be present and unique: " + page.id);
    pageIds.add(page.id);
    page.photos.forEach((photo, index) => {
      if (!photo.src || !(photo.src.startsWith("/") || photo.src.startsWith("https://"))) {
        warnings.push("Scrapbook page " + page.id + " photo " + (index + 1) + " needs a local /... path or an https:// URL.");
      }
    });
  });
  if (config.scrapbook.enabled && isEmptyList(config.scrapbook.pages)) {
    warnings.push("Add at least one page or disable the scrapbook.");
  }
  const firstPage = config.scrapbook.initialPage;
  if (config.scrapbook.pages.length > 0 && (firstPage < 1 || firstPage > config.scrapbook.pages.length)) {
    warnings.push("The initial scrapbook page must be within the configured page count.");
  }
  if (config.audio.defaultVolume < 0 || config.audio.defaultVolume > 1) {
    warnings.push("Audio volume must be between 0 and 1.");
  }
  return warnings;
}
