# Client personalization guide

## Scope

This guide applies to BirthdayWebsite-ProductionTemplate. Edit only the authorized repository for the current client. Never replace another repository’s codebase, change its origin, or publish/commit/push without authorization. The existing six scenes, layouts, animations, relative Vite base and deployment workflow are preserved.

## Central intake

Edit src/config/client.json. Keep recipient name/nickname, turning age, birthday date (YYYY-MM-DD), 24-hour time, IANA timezone and independent sender name there. siteId must be unique per website (3–80 lowercase letters, numbers or hyphens) and stable across updates. The curtain key includes siteId and birthday date. The source defaults stay in birthdayConfig.ts; do not edit component code or CSS for client personalization.

The checked-in fixture uses generic identities and neutral SVG illustrations. All ten existing sample entries are labeled Regular Photos; no couple classification has been inferred from the pictures. Replace the fixture with client-approved data before delivery. CLIENT_INFO.example.json is a placeholder-only intake example; it deliberately fails validation until completed.

## Exactly 10, 15 or 20 unique photos

Set photoPackage to 10, 15 or 20. photos is an object with two required arrays: regular (Regular Photos) and couple (Couple Photos). Either may be empty, but their combined count MUST equal photoPackage. Couple photos are included in the package, not an extra allowance. For example, a 15-photo package may contain 10 regular + 5 couple photos, or 15 regular + 0 couple photos.

Each photo is { src, alt, caption }; alt and caption may be null to retain the existing slot text. Use approved local files inside public, for example /images/client/regular-01.jpg. Supported types: JPG/JPEG, PNG, WebP, AVIF, GIF and SVG. Duplicate paths/aliases across either category and byte-identical duplicate files are rejected. Visual near-duplicates or resized copies require human review. Remote media, path traversal, missing/empty files, malformed entries, unsupported counts and count mismatches stop validation. Paths must have exact case for Linux CI.

### Deterministic section allocation

| Section | Frames | Allocation |
|---|---:|---|
| Introduction carousel | 5 | Regular first, then couple fallback |
| Memories | 10 | Regular first, then couple fallback |
| Scrapbook | 16 across 8 pages | Couple first, then regular fallback |
| Photo Universe | 35 | Every supplied photo once in regular-then-couple order, followed by cyclic reuse |

Order within each category is preserved. “Couple first” means the scrapbook starts with supplied couple photos, then uses regular photos when capacity remains, then cycles if needed. If more than 16 couple photos are supplied, the first 16 fill the scrapbook; all still appear in the Universe. Photos repeat as needed, without adjacent duplicate sources or cyclic boundary repeats for these package sizes. No random selection is used. A custom caption/alt follows its image across sections. The existing frame IDs, rotations, sizes, stickers and page metadata are retained.

The Universe now receives all 35 assigned entries, rather than ten source photos. Its renderer keeps the original ten-template layout cycle separately, preserving every frame’s x/y/z, scale, rotation and depth layer. No new frames, animations or layout geometry are added.

## Messages, scrapbook and music

Leave messages.reveal, introduction, closing or signature null for existing defaults, or provide nonempty custom strings. scrapbookNotes has eight entries; each is null for default notes or exactly two custom strings. Review relationship-specific default captions/notes with the client.

Leave music.src and music.title null for the existing default birthday song. Custom local music requires src plus title. music.artwork may be null for the repository’s existing policy or a local supported image path for an explicit override. The first photo in Regular Photos, or the first Couple Photo when regular is empty, remains the default music artwork. The persistent music player’s controls and scene behavior are unchanged.

The reveal background remains the included hero-dusk.svg and does not count toward the photo package. Photo artwork reuses existing/default media rather than requiring an extra package photo.

## Migration from earlier configuration

The old flat photos array and 10/20/35 packages are replaced. Choose 10, 15 or 20 explicitly, move existing entries into photos.regular and photos.couple, and remove duplicate entries. Keep couple photos inside the selected total. A 35-photo intake is no longer accepted: select 20 or fewer approved unique photos before building. Existing unrelated client projects are not migrated automatically.

## Verification before publication

Run in this checkout:

```sh
npm ci
npm run validate
npm test
npm run typecheck
npm run test:packages
npm run build:check
```

npm test checks all 48 package/category splits, invalid data, 5/10/16/35 capacities, couple priority, complete Universe coverage, custom captions/notes, artwork policy and pre-change layout snapshots. test:packages additionally creates full Vite production builds for 10-, 15- and 20-photo synthetic client fixtures under .build-check/packages. Synthetic fixture media is created temporarily inside this checkout and cleaned afterward; real client files are untouched.

The supported npm run build runs prebuild validation and tests before TypeScript and Vite. Invalid data exits nonzero with labeled errors before the production build. Do not bypass it with direct vite build for delivery. Its existing workflow runs tests and builds before deployment. ENABLE_PAGES_DEPLOY=true and Pages source GitHub Actions remain required. Vite base stays ./ for GitHub Pages project paths.

The mobile-only Page 3 button below the carousel is preserved. Review desktop/tablet/phone layouts, all eight scrapbook pages, carousel/lightbox, Universe and music playback in a browser before client delivery. Automated file checks do not decode every image or prove audio codec/browser support.

## Git and private files

.gitignore excludes dependencies, local secrets and generated verification output. Generated dist is untracked. Do not commit private intake forms, credentials, customer photos without authorization, test evidence or generated output. Review staged file names and correct origin before any commit/push. Changes require a separate report and owner approval before publication.
