# BirthdayWebsite-ProductionTemplate

Reusable six-scene birthday website with centralized client configuration, deterministic 10/15/20 photo allocation and prebuild validation. This template contains generic identities and ten neutral SVG illustrations, not customer photos.

## Customer workflow

1. Use GitHub's **Use this template** to create a new customer repository. Clone that repository and confirm its origin before editing or pushing.
2. Personalize src/config/client.json; supply exactly 10, 15 or 20 approved local client photos. Follow CLIENT_PERSONALIZATION_GUIDE.md. Never commit private intake documents or credentials.
3. Run npm ci, npm run validate, npm test and npm run build. Review all six scenes on desktop/mobile.
4. Commit and push the customer repository when authorized.
5. In the customer repository, set Settings → Pages → Source to GitHub Actions. Set repository Actions variable ENABLE_PAGES_DEPLOY=true only after client approval, then push main or run the workflow.

Deployment is opt-in for every repository, including this production template. Main pushes/manual runs perform validation, tests and build; deployment additionally requires the Actions repository variable ENABLE_PAGES_DEPLOY=true and Pages source set to GitHub Actions. Future client repositories need their own configuration and deployment approval. Account/plan and Pages permissions must support the repository visibility.

## Local commands

```sh
npm ci
npm run dev
npm run validate
npm test
npm run build
```

Vite base remains ./ for relative GitHub Pages paths. CI builds dist and uploads it as a Pages artifact; dist and node_modules must not be committed. Website configuration and public assets are public when deployed.

The existing default birthday-song.mp3 and title Tum Ho Toh are retained from the source template. Existing default messages, notes, layouts and animations remain available.
