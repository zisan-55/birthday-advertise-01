import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { birthdayConfig } from "./config/birthdayConfig";
import { useCountdown } from "./hooks/useCountdown";
import { validateBirthdayConfig } from "./lib/validateConfig";

type SceneId = "cinema" | "reveal" | "introduction" | "gallery" | "scrapbook" | "universe";
type CurtainPhase = "closed" | "opening" | "open" | "message";
type GalleryPhoto = (typeof birthdayConfig.gallery.photos)[number];
type CarouselPhoto = (typeof birthdayConfig.photoCarousel.photos)[number];
type AlbumPage = (typeof birthdayConfig.scrapbook.pages)[number];
type SelectedPhoto = { src: string; alt: string; caption: string };
type SceneItem = { id: SceneId; label: string; enabled: boolean };
type RevealPhase = "counting" | "holding" | "burning" | "revealing" | "celebrating";
type NotePosition = { left: number; top: number };

const PHOTO_CAROUSEL_HOLD_MS = 2000;
const PHOTO_CAROUSEL_TRANSITION_MS = 850;
const CINEMA_CURTAIN_OPEN_MS = 2500;

function clampNotePosition(note: HTMLElement, left: number, top: number): NotePosition {
  const margin = 12;
  const compact = window.matchMedia("(max-width: 1050px)").matches;
  const styles = window.getComputedStyle(note);
  const safeTop = Number.parseFloat(styles.getPropertyValue("--note-safe-top")) || 0;
  const safeBottom = Number.parseFloat(styles.getPropertyValue("--note-safe-bottom")) || 0;
  const dockReserve = (compact ? 208 : 176) + safeBottom;
  const bounds = note.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - bounds.width - margin);
  const maxTop = Math.max(margin + safeTop, window.innerHeight - bounds.height - dockReserve);
  return {
    left: Math.min(maxLeft, Math.max(margin, left)),
    top: Math.min(maxTop, Math.max(margin + safeTop, top)),
  };
}
const CINEMA_POST_CURTAIN_DELAY_MS = 500;
const CINEMA_MESSAGE_REVEAL_MS = 1000;
const CINEMA_PREVIEW_MESSAGE_HOLD_MS = 1000;
const CINEMA_DAY_MESSAGE_HOLD_MS = 2000;

function cinemaCurtainStorageKey(birthdayDate: string): string {
  return "birthday-curtain-opened:" + birthdayConfig.siteId + ":" + birthdayDate;
}

function hasCinemaCurtainOpened(birthdayDate: string): boolean {
  if (typeof window === "undefined") return false;
  const key = cinemaCurtainStorageKey(birthdayDate);
  try {
    if (window.localStorage.getItem(key) === "true") return true;
  } catch { /* Fall back to tab storage below. */ }
  try { return window.sessionStorage.getItem(key) === "true"; } catch { return false; }
}

function rememberCinemaCurtainOpened(birthdayDate: string): void {
  if (typeof window === "undefined") return;
  const key = cinemaCurtainStorageKey(birthdayDate);
  try {
    window.localStorage.setItem(key, "true");
    return;
  } catch { /* Fall back to tab storage below. */ }
  try { window.sessionStorage.setItem(key, "true"); } catch { /* The open state still remains correct for this visit. */ }
}

function forgetCinemaCurtainOpened(birthdayDate: string): void {
  if (typeof window === "undefined") return;
  const key = cinemaCurtainStorageKey(birthdayDate);
  try { window.localStorage.removeItem(key); } catch { /* The session marker is cleared below when available. */ }
  try { window.sessionStorage.removeItem(key); } catch { /* The replay still resets this visit's in-memory state. */ }
}

const REVEAL_TIMING = {
  entrance: 700,
  countStep: 95,
  hold: 1400,
  burn: 1450,
  ageGrow: 850,
  buttonDelay: 560,
} as const;
const BURN_PARTICLES = Array.from({ length: 54 }, (_, index) => index);
const CELEBRATION_STICKERS = ["🎉", "🎂", "🎈"] as const;
const BALLOON_LEFT = [4, 17, 31, 57, 74, 88];
const BALLOON_SIZE = [0.78, 0.96, 0.7, 1.12, 0.86, 1.03];

function isEmptyList(items: readonly unknown[]): boolean {
  return items.length === 0;
}

const sceneItems: SceneItem[] = [
  { id: "cinema", label: birthdayConfig.navigation.cinema, enabled: birthdayConfig.cinema.enabled },
  { id: "reveal", label: birthdayConfig.navigation.reveal, enabled: birthdayConfig.reveal.enabled },
  { id: "introduction", label: birthdayConfig.navigation.introduction, enabled: birthdayConfig.introduction.enabled },
  { id: "gallery", label: birthdayConfig.navigation.gallery, enabled: birthdayConfig.gallery.enabled },
  { id: "scrapbook", label: birthdayConfig.navigation.scrapbook, enabled: birthdayConfig.scrapbook.enabled },
  { id: "universe", label: birthdayConfig.navigation.universe, enabled: birthdayConfig.photoUniverse.enabled },
];

const validationWarnings = validateBirthdayConfig();
if (import.meta.env.DEV) validationWarnings.forEach((warning) => console.warn("Birthday template: " + warning));

function birthdayDateLabels() {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dateParts = birthdayConfig.recipient.birthdayDate.split("-").map(Number);
  const month = months[dateParts[1] - 1];
  const day = dateParts[2];
  if (!month || !Number.isFinite(day)) return { short: "DATE TBD", long: "DATE TBD" };
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
  return { short: month + " " + day, long: month + " " + day + suffix };
}

function publicAssetPath(src: string): string {
  if (/^(?:[a-z]+:|\/\/|data:|blob:)/i.test(src)) return src;
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + "/";
  if (src.startsWith(base)) return src;
  return base + src.replace(/^\/+/, "");
}

function productionLabel() {
  return [birthdayConfig.cinema.productionLead, birthdayConfig.recipient.nickname, birthdayConfig.cinema.productionSuffix].filter(Boolean).join(" ");
}

function firstEnabledScene(): SceneId {
  return sceneItems.find((scene) => scene.enabled)?.id ?? "reveal";
}

function adjacentEnabledScene(current: SceneId, direction: 1 | -1 = 1): SceneId {
  const available = sceneItems.filter((item) => item.enabled);
  if (available.length === 0) return current;
  const currentIndex = available.findIndex((item) => item.id === current);
  const start = currentIndex < 0 ? 0 : currentIndex;
  return available[(start + direction + available.length) % available.length].id;
}

function PhotoMedia({ src, alt, variant = 0, className = "", loading = "lazy" }: { src: string; alt: string; variant?: number; className?: string; loading?: "eager" | "lazy" }) {
  const [failed, setFailed] = useState(false);
  const tone = Math.abs(variant) % 8;

  if (failed) {
    return (
      <div className={"photo-fallback photo-fallback--" + tone + " " + className} role="img" aria-label={alt}>
        <span className="photo-fallback__sun" aria-hidden="true" />
        <span className="photo-fallback__horizon" aria-hidden="true" />
        <span className="photo-fallback__label">{birthdayConfig.preferences.missingPhotoLabel}</span>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={publicAssetPath(src)}
      alt={alt}
      loading={loading}
      onError={() => {
        if (import.meta.env.DEV) console.warn("Birthday template: photo not found at " + src + ". Add the file or update birthdayConfig.ts.");
        setFailed(true);
      }}
    />
  );
}

function SceneNavigation({ current, onChange }: { current: SceneId; onChange: (scene: SceneId) => void }) {
  const [expanded, setExpanded] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const available = sceneItems.filter((scene) => scene.enabled);

  useEffect(() => {
    const collapseOutsideNavigation = (event: globalThis.PointerEvent) => {
      const nav = navRef.current;
      if (!nav || nav.contains(event.target as Node)) return;
      setExpanded(false);
      const focusedElement = document.activeElement;
      if (focusedElement instanceof HTMLElement && nav.contains(focusedElement)) focusedElement.blur();
    };

    document.addEventListener("pointerdown", collapseOutsideNavigation);
    return () => document.removeEventListener("pointerdown", collapseOutsideNavigation);
  }, []);

  if (available.length < 2) return null;
  return (
    <nav
      ref={navRef}
      className="scene-navigation"
      data-expanded={expanded ? "true" : "false"}
      aria-label="Birthday experience scenes"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false);
      }}
    >
      <span className="scene-navigation__mark" aria-hidden="true">✦</span>
      {available.map((scene, index) => (
        <button
          key={scene.id}
          type="button"
          className={"scene-navigation__item" + (current === scene.id ? " is-current" : "")}
          aria-current={current === scene.id ? "page" : undefined}
          onClick={() => {
            setExpanded(true);
            onChange(scene.id);
          }}
        >
          <span className="scene-navigation__number">0{index + 1}</span>
          <span>{scene.label}</span>
        </button>
      ))}
    </nav>
  );
}

function CinemaScene({ countdown, curtainPhase, onCurtainPreview }: { countdown: ReturnType<typeof useCountdown>; curtainPhase: CurtainPhase; onCurtainPreview: () => void }) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    <section className="scene cinema-scene" data-curtain-phase={curtainPhase} data-countdown-complete={countdown.complete ? "true" : "false"} aria-labelledby="cinema-heading">
      <div className={"cinema-curtain" + (curtainPhase !== "closed" ? " cinema-curtain--opening" : "")} aria-hidden="true" />
      <div className="film-rail film-rail--left" aria-hidden="true" />
      <div className="film-rail film-rail--right" aria-hidden="true" />
      <div className="cinema-frame" aria-hidden="true"><span>✦</span><span>✦</span><span>✦</span><span>✦</span></div>
      <div className="cinema-banner" aria-hidden="true">
        <span>{birthdayConfig.cinema.topBannerText} · {birthdayDateLabels().short} · </span>
        <span>{birthdayConfig.cinema.topBannerText} · {birthdayDateLabels().short} · </span>
        <span>{birthdayConfig.cinema.topBannerText} · {birthdayDateLabels().short} · </span>
      </div>
      <div className="cinema-topline">
        <button className="preview-button" type="button" onClick={onCurtainPreview}>{birthdayConfig.cinema.previewButtonText}<span aria-hidden="true"> ↗</span></button>
      </div>

      <div className="cinema-content">
        <div className="cinema-kicker"><i aria-hidden="true">✦</i><span>THE BIRTHDAY PREMIERE</span><i aria-hidden="true">✦</i></div>
        <h1 id="cinema-heading" className="cinema-title">{birthdayConfig.cinema.mainHeading}</h1>
        <p className="cinema-subtitle">{productionLabel()}, {birthdayConfig.cinema.subtitleLead} {birthdayDateLabels().long}</p>

        <div className="countdown" aria-live="polite" aria-atomic="true">
          {curtainPhase === "message" && <p className="countdown-label">The Day Is Here</p>}
          {countdown.valid && !countdown.complete && curtainPhase === "closed" ? (
            <>
              <div className="countdown-small" aria-label={pad(countdown.hours) + " hours, " + pad(countdown.minutes) + " minutes, " + pad(countdown.seconds) + " seconds"}>
                {[{ label: "HRS", value: countdown.hours }, { label: "MIN", value: countdown.minutes }, { label: "SEC", value: countdown.seconds }].map((unit, index) => (
                  <div className="countdown-unit" key={unit.label} style={{ "--unit-index": index } as CSSProperties}><strong key={unit.value}>{pad(unit.value)}</strong><span>{unit.label}</span></div>
                ))}
              </div>
            </>
          ) : !countdown.valid ? (
            <div className="countdown-setup"><span>SET YOUR BIRTHDAY DATE</span><small>Update the recipient date and time in the configuration file.</small></div>
          ) : null}
        </div>
        <p className="cinema-footer">{birthdayConfig.cinema.footerText}</p>
      </div>
      <div className="cinema-bottom-note"><span>VOL. 01</span><span>{birthdayConfig.recipient.name.toUpperCase()} · A STORY IN SIX SCENES</span><span>EST. WITH LOVE</span></div>
    </section>
  );
}

function RevealScene({ onContinue }: { onContinue: () => void }) {
  const [heroFailed, setHeroFailed] = useState(false);
  const [motionAllowedOnEntry] = useState(() =>
    birthdayConfig.preferences.animationsEnabled &&
    !birthdayConfig.preferences.reducedMotion &&
    !(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches),
  );
  const finalAge = birthdayConfig.recipient.age;
  const lastCountdownNumber = finalAge - 1;
  const [phase, setPhase] = useState<RevealPhase>(motionAllowedOnEntry ? "counting" : "celebrating");
  const [count, setCount] = useState(motionAllowedOnEntry ? 1 : finalAge);
  const [showStoryButton, setShowStoryButton] = useState(!motionAllowedOnEntry);
  const timerRef = useRef<number | undefined>(undefined);
  const balloons = birthdayConfig.reveal.balloons;

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cancelled = false;
    let current = 1;

    const clearTimer = () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
    const schedule = (delay: number, callback: () => void) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        if (!cancelled) callback();
      }, delay);
    };
    const finishWithoutMotion = () => {
      if (cancelled) return;
      cancelled = true;
      clearTimer();
      setCount(finalAge);
      setPhase("celebrating");
      setShowStoryButton(true);
    };

    const startCelebration = () => {
      setPhase("celebrating");
      schedule(REVEAL_TIMING.buttonDelay, () => setShowStoryButton(true));
    };
    const revealFinalAge = () => {
      setCount(finalAge);
      setPhase("revealing");
      schedule(REVEAL_TIMING.ageGrow, startCelebration);
    };
    const burnCountdown = () => {
      setPhase("burning");
      schedule(REVEAL_TIMING.burn, revealFinalAge);
    };
    const holdFinalCountdown = () => {
      setCount(lastCountdownNumber);
      setPhase("holding");
      schedule(REVEAL_TIMING.hold, burnCountdown);
    };
    const tick = () => {
      if (current < lastCountdownNumber) {
        current += 1;
        setCount(current);
        if (current < lastCountdownNumber) schedule(REVEAL_TIMING.countStep, tick);
        else holdFinalCountdown();
        return;
      }
      holdFinalCountdown();
    };

    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) finishWithoutMotion();
    };
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    if (!motionAllowedOnEntry || reducedMotionQuery.matches) {
      finishWithoutMotion();
    } else {
      setCount(1);
      setPhase("counting");
      setShowStoryButton(false);
      schedule(REVEAL_TIMING.entrance, tick);
    }

    return () => {
      cancelled = true;
      clearTimer();
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
    };
  }, [finalAge, lastCountdownNumber, motionAllowedOnEntry]);

  const headlineWords = birthdayConfig.reveal.headlinePrefix.trim().split(/\s+/).filter(Boolean);
  let headlineLetterOffset = 0;
  const headlineMarkup = headlineWords.map((word, wordIndex) => {
    const wordOffset = headlineLetterOffset;
    headlineLetterOffset += word.length;
    return (
      <span className="reveal-title__word" key={word + wordIndex}>
        {Array.from(word).map((letter, letterIndex) => {
          const index = wordOffset + letterIndex;
          return <span className="reveal-title__letter" key={letterIndex} style={{
            "--letter-index": index,
            "--letter-tilt": (((index * 7) % 17) - 8) + "deg",
            "--letter-float": (index % 2 ? -1 : 1) * (3 + (index % 4)) + "px",
            "--letter-lift": (((index % 5) - 2) * 11) + "px",
          } as CSSProperties}>{letter}</span>;
        })}
      </span>
    );
  });

  return (
    <section className="scene reveal-scene" data-phase={phase} aria-label="Birthday reveal">
      {!heroFailed && <img className="reveal-backdrop" src={publicAssetPath(birthdayConfig.reveal.backgroundImage)} alt="" onError={() => {
        if (import.meta.env.DEV) console.warn("Birthday template: hero image not found at " + birthdayConfig.reveal.backgroundImage + ". Add the file or update birthdayConfig.ts.");
        setHeroFailed(true);
      }} />}
      <div className="reveal-backdrop-art" aria-hidden="true" />
      <div className="reveal-vignette" aria-hidden="true" style={{ opacity: birthdayConfig.reveal.backgroundOverlayOpacity }} />
      <div className="reveal-blackout" aria-hidden="true" />
      <div className="balloon-field" aria-hidden="true">
        {balloons.map((color, index) => (
          <span
            className="balloon-launch"
            key={color + index}
            style={{
              "--balloon-color": color,
              "--balloon-index": index,
              "--balloon-left": (BALLOON_LEFT[index % BALLOON_LEFT.length]) + "%",
              "--balloon-top": (5 + (index % 3) * 14) + "%",
              "--balloon-width": `clamp(${44 * BALLOON_SIZE[index % BALLOON_SIZE.length]}px, ${7 * BALLOON_SIZE[index % BALLOON_SIZE.length]}vw, ${104 * BALLOON_SIZE[index % BALLOON_SIZE.length]}px)`,
              "--balloon-height": `clamp(${65 * BALLOON_SIZE[index % BALLOON_SIZE.length]}px, ${9.5 * BALLOON_SIZE[index % BALLOON_SIZE.length]}vw, ${148 * BALLOON_SIZE[index % BALLOON_SIZE.length]}px)`,
              "--balloon-duration": (7.2 + (index % 4) * 0.8) + "s",
              "--balloon-delay": (index * 135) + "ms",
              "--balloon-drift": ((index % 2 ? 1 : -1) * (18 + (index % 4) * 9)) + "px",
              "--balloon-drift-end": ((index % 2 ? -1 : 1) * (22 + (index % 3) * 11)) + "px",
            } as CSSProperties}
          >
            <span className="balloon" />
          </span>
        ))}
      </div>
      <div className="reveal-copy">
        <div className="age-stage" data-phase={phase}>
          {birthdayConfig.reveal.displayAge && phase === "burning" && (
            <div className="burn-effects" aria-hidden="true">
              {BURN_PARTICLES.map((particle) => (
                <span
                  className={"burn-particle" + (particle % 9 === 0 ? " burn-particle--smoke" : particle % 5 === 0 ? " burn-particle--streak" : " burn-particle--ember")}
                  key={particle}
                  style={{
                    "--particle-x": ((((particle * 37) % 133) - 66) * 4.3) + "px",
                    "--particle-y": ((((particle * 53) % 121) - 60) * 3.3) + "px",
                    "--particle-drift": (((particle * 17) % 121) - 60) + "px",
                    "--particle-rise": (54 + (particle % 5) * 19) + "px",
                    "--particle-delay": ((particle % 11) * 34) + "ms",
                    "--particle-size": (2 + (particle % 5)) + "px",
                  } as CSSProperties}
                />
              ))}
            </div>
          )}
          {birthdayConfig.reveal.displayAge && (
            <div
              className={"reveal-age" + (phase === "revealing" || phase === "celebrating" ? " reveal-age--final" : "") + (phase === "burning" ? " reveal-age--burning" : "")}
              key={count}
              aria-hidden="true"
            >
              {String(count).split("").map((digit, digitIndex) => (
                <span className="age-digit" key={digitIndex} style={{ "--digit-index": digitIndex } as CSSProperties}>
                  <span className="age-digit__solid">{digit}</span>
                </span>
              ))}
            </div>
          )}
          {phase === "celebrating" && (
            <div className="birthday-stickers" aria-hidden="true">
              {CELEBRATION_STICKERS.map((sticker, index) => <span className="birthday-sticker" key={sticker} style={{ "--sticker-index": index } as CSSProperties}>{sticker}</span>)}
            </div>
          )}
          <div className={"reveal-copy__heading" + (phase === "celebrating" ? " is-visible" : "")} aria-hidden={phase !== "celebrating"}>
            <h1 id="reveal-heading" className="reveal-title" aria-label={birthdayConfig.reveal.headlinePrefix + " " + birthdayConfig.recipient.name}>
              <span className="reveal-title__phrase">{headlineMarkup}</span>
            </h1>
          </div>
        </div>

        <div className={"reveal-details" + (phase === "celebrating" ? " is-visible" : "")} aria-hidden={phase !== "celebrating"}>
          <strong>{birthdayConfig.recipient.name}</strong>
          <p>{birthdayConfig.reveal.message}</p>
        </div>

        <div className="reveal-action-slot">
          <button type="button" className="light-cta" onClick={onContinue} hidden={!showStoryButton}>
            {birthdayConfig.reveal.buttonText}<span aria-hidden="true">↗</span>
          </button>
        </div>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {phase === "holding" ? String(lastCountdownNumber) : phase === "burning" ? "The countdown number is burning away." : phase === "revealing" ? String(finalAge) : phase === "celebrating" ? "Happy Birthday " + birthdayConfig.recipient.name + ". The Story of You button is available." : ""}
        </p>
      </div>
      <p className="reveal-side-note">AN EXTRAORDINARY PERSON<br />A VERY ORDINARY KIND OF MAGIC</p>
    </section>
  );
}

function BirthdayPhotoCarousel({
  photos,
  enabled,
  reducedMotion,
  buttonText,
  onPhotoOpen,
  onContinue,
}: {
  photos: readonly CarouselPhoto[];
  enabled: boolean;
  reducedMotion: boolean;
  buttonText: string;
  onPhotoOpen: (photo: SelectedPhoto) => void;
  onContinue: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [carouselPhase, setCarouselPhase] = useState<"holding" | "transitioning">("holding");
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = useState(false);
  const carouselPhotos = photos.slice(0, 5);
  const reducedMotionActive = reducedMotion || systemPrefersReducedMotion;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = (event: MediaQueryListEvent) => setSystemPrefersReducedMotion(event.matches);
    setSystemPrefersReducedMotion(query.matches);
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (carouselPhotos.length < 2 || !enabled) return;
    if (reducedMotionActive) {
      setCarouselPhase("holding");
      return;
    }

    const timer = window.setTimeout(() => {
      if (carouselPhase === "holding") {
        setCarouselPhase("transitioning");
        return;
      }

      setActiveIndex((index) => (index + 1) % carouselPhotos.length);
      setCarouselPhase("holding");
    }, carouselPhase === "holding" ? PHOTO_CAROUSEL_HOLD_MS : PHOTO_CAROUSEL_TRANSITION_MS);

    return () => window.clearTimeout(timer);
  }, [activeIndex, carouselPhase, carouselPhotos.length, enabled, reducedMotionActive]);

  if (!enabled) return null;

  const button = (
    <button type="button" className="birthday-carousel__next is-visible" onClick={onContinue}>
      {buttonText}<span aria-hidden="true">→</span>
    </button>
  );

  if (isEmptyList(carouselPhotos)) {
    return (
      <>
        <div className={"birthday-carousel" + (reducedMotionActive ? " birthday-carousel--reduced-motion" : "")} role="region" aria-label="Birthday photo carousel">
          <div className="birthday-carousel__track">
            <article className="birthday-carousel__card birthday-carousel__card--center birthday-carousel__card--empty">
              <div className="birthday-carousel__empty">Add up to five photos in birthdayConfig.ts.</div>
            </article>
          </div>
        </div>
        <div className="birthday-carousel__controls">{button}</div>
      </>
    );
  }

  const photoAt = (index: number) => carouselPhotos[((index % carouselPhotos.length) + carouselPhotos.length) % carouselPhotos.length]!;
  const currentPhoto = photoAt(activeIndex);
  const nextPhoto = photoAt(activeIndex + 1);
  const previousPhoto = photoAt(activeIndex - 1);
  const upcomingPhoto = photoAt(activeIndex + 2);
  const transitioning = carouselPhase === "transitioning";
  const leftPreviewKey = (photo: CarouselPhoto) =>
    carouselPhotos.length === 2 ? photo.id + "-left-preview" : carouselPhotos.length === 3 ? photo.id + "-incoming" : photo.id;
  const cards = carouselPhotos.length === 1
    ? [{ key: currentPhoto.id, photo: currentPhoto, position: "center" }]
    : transitioning
    ? [
        { key: currentPhoto.id, photo: currentPhoto, position: "center-to-right" },
        { key: leftPreviewKey(nextPhoto), photo: nextPhoto, position: "left-to-center" },
        ...(carouselPhotos.length >= 3
          ? [
              { key: leftPreviewKey(upcomingPhoto), photo: upcomingPhoto, position: "incoming-left" },
              { key: previousPhoto.id, photo: previousPhoto, position: "right-to-exit" },
            ]
          : []),
      ]
    : [
        { key: currentPhoto.id, photo: currentPhoto, position: "center" },
        { key: leftPreviewKey(nextPhoto), photo: nextPhoto, position: "left" },
        ...(carouselPhotos.length >= 3 ? [{ key: previousPhoto.id, photo: previousPhoto, position: "right" }] : []),
      ];

  return (
    <>
      <div className={"birthday-carousel" + (reducedMotionActive ? " birthday-carousel--reduced-motion" : "")} role="region" aria-label="Birthday photo carousel">
        <div className="birthday-carousel__track">
          {cards.map((card, index) => (
            <article
              key={card.key}
              className={"birthday-carousel__card birthday-carousel__card--" + card.position}
              aria-label={card.photo.alt}
            >
              <button
                type="button"
                className="birthday-carousel__photo"
                disabled={!birthdayConfig.preferences.enablePhotoLightbox}
                aria-label={"Open photograph: " + card.photo.alt}
                onClick={() => onPhotoOpen({ src: card.photo.src, alt: card.photo.alt, caption: card.photo.alt })}
              >
                <PhotoMedia src={card.photo.src} alt={card.photo.alt} variant={index} loading="eager" />
              </button>
            </article>
          ))}
        </div>
      </div>
      <div className="birthday-carousel__controls">{button}</div>
    </>
  );
}

function IntroductionScene({ onContinue, onPhotoOpen }: { onContinue: () => void; onPhotoOpen: (photo: SelectedPhoto) => void }) {
  return (
    <section className="scene introduction-scene" aria-labelledby="intro-heading">
      <div className="intro-date"><span>A LITTLE CELEBRATION</span></div>
      <div className="intro-copy" style={{ "--intro-accent": birthdayConfig.introduction.accentColor } as CSSProperties}>
        <h1 id="intro-heading" className="intro-heading">
          <span>{birthdayConfig.introduction.headingLine1}</span>
          <strong>{birthdayConfig.introduction.headingLine2}</strong>
          <strong className="intro-heading__accent">{birthdayConfig.recipient.name}</strong>
        </h1>
        <div className="intro-rule" />
        <p className="intro-message">{birthdayConfig.introduction.message}</p>
        <p className="intro-signoff">{birthdayConfig.introduction.footerLabel}</p>
      </div>
      <BirthdayPhotoCarousel
        photos={birthdayConfig.photoCarousel.photos}
        enabled={birthdayConfig.photoCarousel.enabled}
        reducedMotion={birthdayConfig.preferences.reducedMotion}
        buttonText={birthdayConfig.introduction.continueLabel}
        onPhotoOpen={onPhotoOpen}
        onContinue={onContinue}
      />
      <div className="intro-corner-note" aria-hidden="true">A GALLERY OF<br />FAVORITE THINGS</div>
    </section>
  );
}

function stickerMark(sticker: string): string {
  const marks: Record<string, string> = { heart: "♥", flower: "✿", butterfly: "❋", sparkle: "✦", star: "★" };
  return marks[sticker] ?? "✦";
}

function PolaroidCard({ photo, index, onOpen }: { photo: GalleryPhoto; index: number; onOpen: (photo: SelectedPhoto) => void }) {
  return (
    <button
      type="button"
      className={"polaroid polaroid--" + photo.size}
      disabled={!birthdayConfig.preferences.enablePhotoLightbox}
      style={{ "--photo-rotation": photo.rotation + "deg", "--card-index": index } as CSSProperties}
      onClick={() => onOpen({ src: photo.src, alt: photo.alt, caption: photo.caption })}
      aria-label={"Open " + photo.caption}
    >
      <span className="polaroid__image"><PhotoMedia src={photo.src} alt={photo.alt} variant={index} /></span>
      {photo.sticker && <span className={"polaroid__sticker polaroid__sticker--" + photo.sticker} aria-hidden="true">{stickerMark(photo.sticker)}</span>}
      {birthdayConfig.preferences.showCaptions && <span className="polaroid__caption">{photo.caption}</span>}
    </button>
  );
}

function GalleryScene({ onPhotoOpen, onOpenScrapbook, onEnterUniverse }: {
  onPhotoOpen: (photo: SelectedPhoto) => void;
  onOpenScrapbook: () => void;
  onEnterUniverse: () => void;
}) {
  return (
    <section className="scene gallery-scene" aria-labelledby="gallery-heading" style={{ "--gallery-paper": birthdayConfig.gallery.backgroundColor } as CSSProperties}>
      <div className="gallery-wash" aria-hidden="true" />
      <div className="gallery-header">
        <p className="gallery-eyebrow">{birthdayConfig.gallery.eyebrow}</p>
        <h1 id="gallery-heading">{birthdayConfig.gallery.title}</h1>
        <p className="gallery-intro">The tiny details, the loud laughs, the days I want to keep close.</p>
        <div className="gallery-actions">
          {birthdayConfig.scrapbook.enabled && <button type="button" className="paper-button" onClick={onOpenScrapbook}><span aria-hidden="true">✦</span>{birthdayConfig.gallery.albumButtonText}</button>}
          {birthdayConfig.photoUniverse.enabled && <button type="button" className="paper-button paper-button--dark" onClick={onEnterUniverse}><span aria-hidden="true">↗</span>{birthdayConfig.gallery.universeButtonText}</button>}
        </div>
      </div>
      <div className={"polaroid-board" + (birthdayConfig.gallery.showGrid ? " polaroid-board--grid" : "")}>
        {birthdayConfig.gallery.photos.map((photo, index) => <PolaroidCard key={photo.id} photo={photo} index={index} onOpen={onPhotoOpen} />)}
        {isEmptyList(birthdayConfig.gallery.photos) && <p className="gallery-empty">Add photographs in the gallery section of birthdayConfig.ts.</p>}
      </div>
      <div className="gallery-bottom-note"><span>MEMORIES, COLLECTED WITH LOVE</span><span>{String(birthdayConfig.gallery.photos.length).padStart(2, "0")} PHOTOGRAPHS</span></div>
    </section>
  );
}

function AlbumPageView({ page, pageNumber, onPhotoOpen, interactive = true }: { page: AlbumPage; pageNumber: number; onPhotoOpen: (photo: SelectedPhoto) => void; interactive?: boolean }) {
  return (
    <article className={"album-page album-page--composition-" + (((pageNumber - 1) % 4) + 1)} style={{ backgroundColor: page.paperColor }} aria-label={"Page " + pageNumber + ": " + page.title}>
      <div className="album-page__topline"><span>OUR LITTLE SCRAPBOOK</span><span>{String(pageNumber).padStart(2, "0")}</span></div>
      <h2>{page.title}</h2>
      <div className="album-page__collage">
        {page.photos.map((photo, index) => (
          <button
            className={"album-photo album-photo--" + (index % 2 + 1)}
            style={{ "--album-rotation": photo.rotation + "deg" } as CSSProperties}
            disabled={!birthdayConfig.preferences.enablePhotoLightbox || !interactive}
            tabIndex={interactive ? undefined : -1}
            key={photo.src + index}
            type="button"
            onClick={() => onPhotoOpen({ src: photo.src, alt: photo.alt, caption: photo.caption })}
            aria-label={"Open scrapbook photograph: " + photo.caption}
          >
            <PhotoMedia src={photo.src} alt={photo.alt} variant={pageNumber + index} />
            {birthdayConfig.preferences.showCaptions && <span>{photo.caption}</span>}
          </button>
        ))}
      </div>
      <div className="album-page__notes">
        {page.notes.map((note, index) => <p className={index % 2 === 0 ? "album-note album-note--script" : "album-note"} key={note}>{note}</p>)}
      </div>
      <div className="album-page__stickers" aria-label="Page decorations">
        {page.stickers.map((sticker, index) => <span className="album-sticker" key={sticker + index} aria-hidden="true">{stickerMark(sticker)}</span>)}
      </div>
      <span className="tape tape--top" aria-hidden="true" />
      <span className="tape tape--side" aria-hidden="true" />
    </article>
  );
}

function ScrapbookScene({ onPhotoOpen, onBack, onEnterUniverse }: { onPhotoOpen: (photo: SelectedPhoto) => void; onBack: () => void; onEnterUniverse: () => void }) {
  const pages = birthdayConfig.scrapbook.pages;
  const startIndex = Math.min(Math.max(birthdayConfig.scrapbook.initialPage - 1, 0), Math.max(pages.length - 1, 0));
  const [pageIndex, setPageIndex] = useState(startIndex);
  const [turningPage, setTurningPage] = useState<{ page: AlbumPage; pageNumber: number; direction: "next" | "previous" } | null>(null);
  const turnInProgress = useRef(false);
  const turnTimer = useRef<number | undefined>(undefined);
  const rightPage = pages[pageIndex + 1];

  useEffect(() => {
    return () => {
      if (turnTimer.current !== undefined) window.clearTimeout(turnTimer.current);
    };
  }, []);

  function turnTo(nextIndex: number, direction: "next" | "previous") {
    if (nextIndex === pageIndex || turnInProgress.current) return;
    const useMobileFlip = birthdayConfig.preferences.animationsEnabled &&
      !birthdayConfig.preferences.reducedMotion &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      window.matchMedia("(max-width: 760px)").matches;

    if (useMobileFlip) {
      turnInProgress.current = true;
      setTurningPage({ page: pages[pageIndex], pageNumber: pageIndex + 1, direction });
      if (turnTimer.current !== undefined) window.clearTimeout(turnTimer.current);
      turnTimer.current = window.setTimeout(() => {
        turnInProgress.current = false;
        turnTimer.current = undefined;
        setTurningPage(null);
      }, 720);
    }
    setPageIndex(nextIndex);
  }

  if (!birthdayConfig.scrapbook.enabled) return null;
  return (
    <section className="scene scrapbook-scene" aria-labelledby="scrapbook-title">
      <div className="scrapbook-shell">
        <div className="scrapbook-heading"><span className="scrapbook-heading__eyebrow">A FEW PAGES FROM OUR STORY</span><h1 id="scrapbook-title">{birthdayConfig.scrapbook.title}</h1></div>
        <button type="button" className="dialog-close" aria-label={birthdayConfig.scrapbook.closeLabel} onClick={onBack}>×</button>
        {isEmptyList(pages) ? <p className="album-empty">Add one or more pages to birthdayConfig.ts.</p> : (
          <>
            <div className="album-spread" aria-live="polite">
              <AlbumPageView key={pages[pageIndex].id} page={pages[pageIndex]} pageNumber={pageIndex + 1} onPhotoOpen={onPhotoOpen} />
              {rightPage ? <AlbumPageView key={rightPage.id} page={rightPage} pageNumber={pageIndex + 2} onPhotoOpen={onPhotoOpen} /> : <div key="blank-page" className="album-page album-page--blank" aria-hidden="true"><span>THE NEXT CHAPTER IS YOURS</span><i>✦</i></div>}
              {turningPage && (
                <div className={"album-flip-overlay album-flip-overlay--" + turningPage.direction} aria-hidden="true">
                  <AlbumPageView page={turningPage.page} pageNumber={turningPage.pageNumber} onPhotoOpen={onPhotoOpen} interactive={false} />
                </div>
              )}
            </div>
            <div className="album-controls">
              <button type="button" className="album-nav-button" onClick={() => turnTo(Math.max(0, pageIndex - 1), "previous")} disabled={pageIndex === 0 || turnInProgress.current}><span aria-hidden="true">‹</span> PREV</button>
              <span className="album-page-count">{pageIndex + 1} <i>/</i> {pages.length}</span>
              <button type="button" className="album-nav-button" onClick={() => turnTo(Math.min(pages.length - 1, pageIndex + 1), "next")} disabled={pageIndex >= pages.length - 1 || turnInProgress.current}>NEXT <span aria-hidden="true">›</span></button>
            </div>
            {pageIndex === pages.length - 1 && !turningPage && (
              <button type="button" className="scrapbook-universe-cta" onClick={onEnterUniverse}>
                <span aria-hidden="true">✦</span> Photo Universe <span aria-hidden="true">↗</span>
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function UniverseScene({ onPhotoOpen, onBack, onReplay }: {
  onPhotoOpen: (photo: SelectedPhoto) => void;
  onBack: () => void;
  onReplay: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [notePosition, setNotePosition] = useState<NotePosition | null>(null);
  const noteRef = useRef<HTMLElement>(null);
  const notePositionRef = useRef<NotePosition | null>(null);
  const noteDragRef = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number } | null>(null);
  const universeWorldRef = useRef<HTMLDivElement>(null);
  const sourcePhotos: readonly (typeof birthdayConfig.photoUniverse.photos[number])[] = birthdayConfig.photoUniverse.photos;
  const columnPositions = [-42, -28, -14, 0, 14, 28, 42];
  const rowPositions = [-38, -20, -2, 16, 34];
  const layerScales = [0.78, 0.84, 0.92, 1.0];
  const layerDepths = [-200, -85, 45, 170];
  const photos = sourcePhotos.length === 0 ? [] : Array.from({ length: 35 }, (_, index) => {
    const photo = sourcePhotos[index % sourcePhotos.length];
    const column = index % columnPositions.length;
    const row = Math.floor(index / columnPositions.length);
    const generation = Math.floor(index / birthdayConfig.photoUniverse.layoutPhotoCount);
    const jitterX = ((index * 7) % 5 - 2) * 1.4;
    const jitterY = ((index * 11) % 5 - 2) * 1.1;
    return {
      ...photo,
      id: photo.id + "-frame-" + index,
      scale: Math.min(1.08, Math.max(0.68, photo.scale * layerScales[generation % layerScales.length] * (0.96 + (index % 4) * 0.02))),
      rotation: photo.rotation + ((index * 7) % 9 - 4),
      position: {
        x: Math.max(-47, Math.min(47, columnPositions[column] + photo.position.x * 0.08 + jitterX)),
        y: Math.max(-43, Math.min(43, rowPositions[row] + photo.position.y * 0.12 + jitterY)),
        z: layerDepths[generation % layerDepths.length] + photo.position.z * 0.16,
      },
    };
  });

  function moveCamera(event: PointerEvent<HTMLElement>) {
    if (!birthdayConfig.photoUniverse.movementEnabled || birthdayConfig.preferences.reducedMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    const world = universeWorldRef.current;
    if (!world) return;
    world.style.setProperty("--camera-x", x * 7 + "deg");
    world.style.setProperty("--camera-y", y * -6 + "deg");
  }

  function resetCamera() {
    const world = universeWorldRef.current;
    if (!world) return;
    world.style.setProperty("--camera-x", "0deg");
    world.style.setProperty("--camera-y", "0deg");
  }

  useLayoutEffect(() => {
    if (!noteOpen) return;
    const positionNote = () => {
      const note = noteRef.current;
      if (!note) return;
      const bounds = note.getBoundingClientRect();
      const current = notePositionRef.current;
      const safeTop = Number.parseFloat(window.getComputedStyle(note).getPropertyValue("--note-safe-top")) || 0;
      const next = clampNotePosition(
        note,
        current?.left ?? window.innerWidth - bounds.width - 24,
        current?.top ?? Math.max(20 + safeTop, window.innerHeight * 0.12),
      );
      notePositionRef.current = next;
      setNotePosition(next);
    };
    positionNote();
    window.addEventListener("resize", positionNote);
    window.visualViewport?.addEventListener("resize", positionNote);
    return () => {
      window.removeEventListener("resize", positionNote);
      window.visualViewport?.removeEventListener("resize", positionNote);
    };
  }, [noteOpen]);

  function moveNoteTo(left: number, top: number) {
    const note = noteRef.current;
    if (!note) return;
    const next = clampNotePosition(note, left, top);
    notePositionRef.current = next;
    setNotePosition(next);
  }

  function startNoteDrag(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const note = noteRef.current;
    if (!note) return;
    const bounds = note.getBoundingClientRect();
    const current = notePositionRef.current ?? { left: bounds.left, top: bounds.top };
    noteDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, ...current };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function continueNoteDrag(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    const drag = noteDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    moveNoteTo(drag.left + event.clientX - drag.startX, drag.top + event.clientY - drag.startY);
  }

  function endNoteDrag(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (noteDragRef.current?.pointerId === event.pointerId) noteDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function moveNoteWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    const offsets: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const note = noteRef.current;
    if (!note) return;
    const bounds = note.getBoundingClientRect();
    const current = notePositionRef.current ?? { left: bounds.left, top: bounds.top };
    const step = event.shiftKey ? 36 : 12;
    moveNoteTo(current.left + offset[0] * step, current.top + offset[1] * step);
  }

  return (
    <section className="scene universe-scene" aria-labelledby="universe-heading" onPointerMove={moveCamera} onPointerLeave={resetCamera} style={{ "--universe-bg": birthdayConfig.photoUniverse.backgroundColor } as CSSProperties}>
      {birthdayConfig.photoUniverse.showStars && <div className="universe-stars" aria-hidden="true" />}
      <div className="universe-vignette" aria-hidden="true" />
      <header className="universe-header"><p>THE LAST STOP</p><h1 id="universe-heading">{birthdayConfig.photoUniverse.title}</h1><span>DRIFT THROUGH A FEW FAVORITE MOMENTS</span></header>
      <div className="universe-world" ref={universeWorldRef} style={{ transform: "perspective(1200px) rotateX(var(--camera-y, 0deg)) rotateY(var(--camera-x, 0deg))" }}>
        {photos.map((photo, index) => (
          <button
            type="button"
            className={"universe-photo" + (birthdayConfig.photoUniverse.autoDrift ? " is-drifting" : "")}
            key={photo.id}
            disabled={!birthdayConfig.preferences.enablePhotoLightbox}
            style={{
              left: "calc(50% " + (photo.position.x < 0 ? "- " : "+ ") + Math.abs(photo.position.x) + "vw)",
              top: "calc(50% " + (photo.position.y < 0 ? "- " : "+ ") + Math.abs(photo.position.y) + "vh)",
              transform: "translate(-50%, -50%) translateZ(" + photo.position.z + "px) rotate(" + photo.rotation + "deg) scale(" + photo.scale + ")",
              "--universe-index": index,
              "--drift-x": (index % 2 === 0 ? -1 : 1) * (8 + (index % 3) * 4) + "px",
              "--drift-y": (index % 3 === 0 ? -1 : 1) * (7 + (index % 4) * 2) + "px",
              "--drift-rotation": (index % 2 === 0 ? -1 : 1) * (1 + (index % 3)) + "deg",
              zIndex: 10 + index,
            } as CSSProperties}
            onClick={() => onPhotoOpen({ src: photo.src, alt: photo.alt, caption: photo.caption })}
            aria-label={"Open memory: " + photo.caption}
          >
            <PhotoMedia src={photo.src} alt={photo.alt} variant={index + 3} />
            {birthdayConfig.preferences.showCaptions && <span>{photo.caption}</span>}
          </button>
        ))}
        {isEmptyList(photos) && <p className="universe-empty">Add photographs in the photoUniverse section of birthdayConfig.ts.</p>}
      </div>
      <div className="universe-controls">
        <button type="button" className="universe-back" onClick={onBack}>← {birthdayConfig.photoUniverse.returnLabel}</button>
        {birthdayConfig.closing.enabled && <button type="button" className="closing-trigger" onClick={() => setNoteOpen((isOpen) => !isOpen)}>{noteOpen ? "CLOSE NOTE ×" : birthdayConfig.closing.openButtonText}</button>}
      </div>
      <button type="button" className="universe-replay-cta" onClick={onReplay}>{birthdayConfig.closing.buttonText}<span aria-hidden="true">↗</span></button>
      {noteOpen && birthdayConfig.closing.enabled && typeof document !== "undefined" && createPortal(
        <aside
          ref={noteRef}
          className={"closing-note" + (birthdayConfig.preferences.reducedMotion ? " is-motion-reduced" : "")}
          aria-label={birthdayConfig.closing.heading}
          style={notePosition ? { left: notePosition.left, top: notePosition.top, transform: "none" } : undefined}
          onPointerMove={(event) => event.stopPropagation()}
        >
          <button type="button" aria-label="Close note" onClick={() => setNoteOpen(false)}>×</button>
          <div
            className="closing-note__drag-handle"
            role="group"
            tabIndex={0}
            aria-label="Move note. Drag with a pointer or use the arrow keys; hold Shift for larger steps."
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
            title="Drag to move · Arrow keys also work"
            onPointerDown={startNoteDrag}
            onPointerMove={continueNoteDrag}
            onPointerUp={endNoteDrag}
            onPointerCancel={endNoteDrag}
            onLostPointerCapture={() => { noteDragRef.current = null; }}
            onKeyDown={moveNoteWithKeyboard}
          >
            <span>✦ A NOTE FOR {birthdayConfig.recipient.name.toUpperCase()}</span>
            <span className="closing-note__move-label" aria-hidden="true">⠿ MOVE</span>
          </div>
          <h2>{birthdayConfig.closing.heading}</h2>
          <p>{birthdayConfig.closing.message}</p>
          <em>{birthdayConfig.closing.signature}, {birthdayConfig.sender.name}</em>
        </aside>,
        document.body,
      )}
    </section>
  );
}

function PhotoViewer({ photo, onClose }: { photo: SelectedPhoto | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (photo && !dialog.open) dialog.showModal();
    if (!photo && dialog.open) dialog.close();
  }, [photo]);

  return (
    <dialog className="photo-viewer" ref={dialogRef} aria-label={photo?.caption ?? "Photograph"} onClose={onClose} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}>
      <button className="dialog-close" type="button" aria-label="Close photograph" onClick={onClose}>×</button>
      {photo && <><PhotoMedia src={photo.src} alt={photo.alt} variant={5} /><p>{photo.caption}</p></>}
    </dialog>
  );
}

function formatAudioTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const wholeSeconds = Math.floor(value);
  return Math.floor(wholeSeconds / 60) + ":" + String(wholeSeconds % 60).padStart(2, "0");
}

function AudioDock({ visible }: { visible: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState<number>(birthdayConfig.audio.defaultVolume);
  const [artworkFailed, setArtworkFailed] = useState(false);
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!visible) {
      audio.pause();
      audio.currentTime = 0;
      setPlaying(false);
      setCurrentTime(0);
      setAutoplayBlocked(false);
      return;
    }
    if (unavailable) return;

    let cancelled = false;
    audio.play().then(() => {
      if (!cancelled) setAutoplayBlocked(false);
    }).catch((error: unknown) => {
      if (cancelled) return;
      setPlaying(false);
      setAutoplayBlocked(true);
      if (import.meta.env.DEV && error instanceof Error && error.name !== "NotAllowedError") {
        console.warn("Birthday music could not start automatically. Use the Play button to try again.", error);
      }
    });
    return () => { cancelled = true; };
  }, [unavailable, visible]);

  async function toggleAudio() {
    const audio = audioRef.current;
    if (!audio || unavailable) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
      setAutoplayBlocked(false);
    } catch {
      setPlaying(false);
      setAutoplayBlocked(true);
    }
  }

  return (
    <div className="audio-dock" hidden={!visible || !birthdayConfig.audio.enabled || !birthdayConfig.audio.showControls}>
      <audio
        ref={audioRef}
        className="audio-dock__source"
        src={publicAssetPath(birthdayConfig.audio.src)}
        preload="metadata"
        loop
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          setUnavailable(true);
          setPlaying(false);
          if (import.meta.env.DEV) console.warn("Birthday music could not load from " + birthdayConfig.audio.src + ". Check the file path in src/config/birthdayConfig.ts.");
        }}
      />
      <img className="audio-dock__artwork" src={publicAssetPath(birthdayConfig.audio.artwork)} alt="" onError={() => setArtworkFailed(true)} hidden={artworkFailed} />
      {artworkFailed && <div className="audio-dock__artwork-fallback" aria-hidden="true">✦</div>}
      <div className="audio-dock__track">
        <strong className="audio-dock__title">{birthdayConfig.audio.title}</strong>
        <span className="audio-dock__subtitle" role={unavailable || autoplayBlocked ? "status" : undefined}>
          {unavailable ? "SONG FILE COULD NOT LOAD" : autoplayBlocked && !playing ? "TAP PLAY TO START" : birthdayConfig.audio.subtitle}
        </span>
      </div>
      <button className="audio-dock__play" type="button" onClick={toggleAudio} disabled={unavailable} aria-label={playing ? "Pause birthday music" : "Play birthday music"}>
        <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
      </button>
      <div className="audio-dock__timeline">
        <span className="audio-dock__time" aria-label="Elapsed time">{formatAudioTime(currentTime)}</span>
        <input
          aria-label="Seek birthday music"
          type="range"
          min="0"
          max={duration || 1}
          step="0.1"
          value={duration ? Math.min(currentTime, duration) : 0}
          disabled={unavailable || !duration}
          onChange={(event) => {
            const audio = audioRef.current;
            const nextTime = Number(event.target.value);
            if (!audio || !Number.isFinite(nextTime)) return;
            audio.currentTime = nextTime;
            setCurrentTime(nextTime);
          }}
        />
        <span className="audio-dock__time" aria-label="Track duration">{duration ? formatAudioTime(duration) : "--:--"}</span>
      </div>
      <label className="audio-dock__volume">
        <span className="sr-only">Music volume</span>
        <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
      </label>
    </div>
  );
}

export default function App() {
  const [scene, setScene] = useState<SceneId>(firstEnabledScene);
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null);
  const countdown = useCountdown(birthdayConfig.recipient.birthdayDate, birthdayConfig.recipient.birthdayTime, birthdayConfig.recipient.timezone);
  const [cinemaCurtainPhase, setCinemaCurtainPhase] = useState<CurtainPhase>(() =>
    countdown.complete && hasCinemaCurtainOpened(birthdayConfig.recipient.birthdayDate) ? "message" : "closed",
  );
  const curtainOpenedForBirthday = useRef<string | null>(null);
  const [cinemaPreviewRequest, setCinemaPreviewRequest] = useState(0);
  const handledCinemaPreviewRequest = useRef(0);
  const motionMode = birthdayConfig.preferences.animationsEnabled && !birthdayConfig.preferences.reducedMotion ? "on" : "off";
  const navLabel = useMemo(() => sceneItems.find((item) => item.id === scene)?.label ?? "Birthday story", [scene]);
  const showSceneNavigation = scene !== "scrapbook" && (scene !== "cinema" || cinemaCurtainPhase === "closed");

  useEffect(() => {
    const birthdayHasArrived = countdown.valid && countdown.complete;
    const isManualPreview = scene === "cinema" && cinemaPreviewRequest > handledCinemaPreviewRequest.current;
    if (scene !== "cinema" || (!birthdayHasArrived && !isManualPreview)) {
      setCinemaCurtainPhase("closed");
      return;
    }

    if (isManualPreview) handledCinemaPreviewRequest.current = cinemaPreviewRequest;
    const birthdayDate = birthdayConfig.recipient.birthdayDate;
    const messageDuration = CINEMA_MESSAGE_REVEAL_MS + (isManualPreview ? CINEMA_PREVIEW_MESSAGE_HOLD_MS : CINEMA_DAY_MESSAGE_HOLD_MS);
    const alreadyOpened = birthdayHasArrived && (curtainOpenedForBirthday.current === birthdayDate || hasCinemaCurtainOpened(birthdayDate));
    let sequenceTimer: number | undefined;
    if (alreadyOpened) {
      curtainOpenedForBirthday.current = birthdayDate;
      setCinemaCurtainPhase("message");
      sequenceTimer = window.setTimeout(() => setScene(adjacentEnabledScene("cinema")), messageDuration);
      return () => {
        if (sequenceTimer !== undefined) window.clearTimeout(sequenceTimer);
      };
    }

    setCinemaCurtainPhase("opening");
    const curtainOpenDuration = birthdayConfig.preferences.animationsEnabled &&
      !birthdayConfig.preferences.reducedMotion &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? CINEMA_CURTAIN_OPEN_MS
      : 0;
    sequenceTimer = window.setTimeout(() => {
      if (birthdayHasArrived) {
        curtainOpenedForBirthday.current = birthdayDate;
        rememberCinemaCurtainOpened(birthdayDate);
      }
      setCinemaCurtainPhase("open");
      const showMessage = () => {
        setCinemaCurtainPhase("message");
        sequenceTimer = window.setTimeout(() => setScene(adjacentEnabledScene("cinema")), messageDuration);
      };
      if (birthdayHasArrived && !isManualPreview) {
        sequenceTimer = window.setTimeout(showMessage, CINEMA_POST_CURTAIN_DELAY_MS);
      } else {
        showMessage();
      }
    }, curtainOpenDuration);

    return () => {
      if (sequenceTimer !== undefined) window.clearTimeout(sequenceTimer);
    };
  }, [cinemaPreviewRequest, countdown.complete, countdown.valid, scene]);

  function previewCurtain() {
    if (scene !== "cinema" || cinemaCurtainPhase !== "closed") return;
    setCinemaPreviewRequest((request) => request + 1);
  }

  function changeScene(next: SceneId) {
    if (!sceneItems.find((item) => item.id === next)?.enabled) return;
    setScene(next);
    setSelectedPhoto(null);
  }

  function replayExperience() {
    forgetCinemaCurtainOpened(birthdayConfig.recipient.birthdayDate);
    curtainOpenedForBirthday.current = null;
    handledCinemaPreviewRequest.current = 0;
    setCinemaPreviewRequest(0);
    setCinemaCurtainPhase("closed");
    changeScene(sceneItems.find((item) => item.id === "cinema" && item.enabled)?.id ?? firstEnabledScene());
  }

  const photoOpener = birthdayConfig.preferences.enablePhotoLightbox ? setSelectedPhoto : () => undefined;
  const musicVisible = scene !== "cinema";
  return (
    <main className="birthday-app" data-motion={motionMode} data-scene={scene} data-music-visible={musicVisible ? "true" : "false"} aria-label={navLabel}>
      {showSceneNavigation && <SceneNavigation current={scene} onChange={changeScene} />}
      <div className="scene-stage" key={scene}>
        {scene === "cinema" && <CinemaScene countdown={countdown} curtainPhase={cinemaCurtainPhase} onCurtainPreview={previewCurtain} />}
        {scene === "reveal" && <RevealScene onContinue={() => changeScene(adjacentEnabledScene("reveal"))} />}
        {scene === "introduction" && <IntroductionScene onContinue={() => changeScene(adjacentEnabledScene("introduction"))} onPhotoOpen={photoOpener} />}
        {scene === "gallery" && <GalleryScene onPhotoOpen={photoOpener} onOpenScrapbook={() => changeScene("scrapbook")} onEnterUniverse={() => changeScene("universe")} />}
        {scene === "scrapbook" && <ScrapbookScene onPhotoOpen={photoOpener} onBack={() => changeScene("gallery")} onEnterUniverse={() => changeScene("universe")} />}
        {scene === "universe" && <UniverseScene onPhotoOpen={photoOpener} onBack={() => changeScene("gallery")} onReplay={replayExperience} />}
      </div>
      <PhotoViewer photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
      <AudioDock visible={musicVisible} />
    </main>
  );
}

