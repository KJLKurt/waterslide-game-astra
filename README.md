# Splashline

An original, mobile-first 3D waterslide racer. Thirteen procedural swimmers race a 704 m tropical course with banked bends, two launch ramps, a jumpable shortcut, and a checkered finish. Built with Three.js, Vite, and browser APIs. All assets are local or generated in code.

## Run

```sh
npm ci
npm run dev
```

Open the URL Vite prints. To use another port: `npm run dev -- --port 5188`.

```sh
npm test                 # Actual mesh raycasts and full race simulations
npm run build            # Static production files in dist/
npm run preview          # Test the production PWA locally
npx playwright install chromium
npm run test:browser     # Build first; browser flows, touch, offline and sibling-PWA isolation
```

## GitHub Pages

1. Put these files in a GitHub repository, with `main` as its default branch.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. Push to `main` or run **Deploy Splashline to GitHub Pages** from Actions. The included workflow tests, builds and publishes `dist/`.

Vite uses `base: './'`, so the build works unchanged at `https://username.github.io/repo-name/` or a custom-domain root. For an explicit deployment prefix, build with `BASE_PATH=/repo-name/ npm run build`. There are no client-side routes that require a Pages fallback. Use the trailing slash in the project URL.

No repository remote is configured in the delivered workspace; publication happens when you push it to your chosen repository. The deploy workflow follows [Vite's GitHub Pages deployment guidance](https://vite.dev/guide/static-deploy.html#github-pages).

## Offline and isolation

The production build generates `sw.js` with a content-versioned precache of the app shell, bundled JS/CSS, manifest and icons. The menu displays **Offline ready** after installation. Visit once online, then reload offline. Service workers require HTTPS or localhost; they do not register in the Vite development server.

- The manifest's `id`, `start_url`, and `scope` are `./` relative to the manifest.
- `sw.js` registers with the exact deployment directory scope. It never registers at the host root unless this game is deliberately hosted there.
- Fetch interception is limited to that origin and directory; only this build's assets are cache-served. Navigations use network with a cached shell fallback.
- Cache names include the directory (`splashline:/repo-name/:<revision>`). Activation only removes old versions with that exact prefix. Other PWA caches and service workers are left intact.
- Saves use the same directory namespace (`splashline:/repo-name/:v1`). Two copies hosted on sibling paths have separate settings and progress.

## How to play

- **Phone:** drag the left thumbstick to steer. Tap the right button to jump. Both pointers work simultaneously. Choose the opposite arrangement in settings.
- **Keyboard:** A/D or left/right arrows steer; Space jumps; P or Escape pauses; F toggles fullscreen where supported.
- Acceleration is automatic. The center current adds speed. Move around slower swimmers to overtake; slide contact gently spaces the pack.
- Ramps launch automatically. At **JUMP RIGHT**, steer into the right lane and jump just before the branch splits. Clear its 13 m gap, recenter, and rejoin the main course about 24 m sooner.
- In **Race**, falling eliminates a swimmer. In **Practice**, falling returns to the last checkpoint while the timer keeps running.
- First place is earned. NPC skill, risk and aggression affect steering, overtaking and shortcut attempts; failed landings use the same fall rules as the player.
- Finish once for First Finish, finish via the shortcut for Gap Jumper, and win a race to unlock the procedural champion crown. Race and practice records are separate.

## Implementation

| File | Responsibility |
| --- | --- |
| `src/track.js` | Arc-length-sampled spline frames, banked slide chunks, ramps, gap and downward surface raycasts |
| `src/race.js` | Fixed-step s/u/speed/vertical-velocity simulation, racer state machine, AI, progress mapping and standings |
| `src/characters.js` | Humanoid animation rigs with shared primitive geometry; five instanced mesh batches for all racers |
| `src/world.js` | Ocean, sky, islands, palms, lighting, chase camera, particles and optional color postprocessing |
| `src/input.js` | Independent pointer capture, touch cancellation, keyboard state and browser-gesture suppression |
| `src/ui.js`, `src/style.css` | Responsive menu, HUD, settings, countdown, controls and results |
| `src/main.js` | Game lifecycle, fixed 60 Hz stepping, settings, records, unlocks and PWA registration |
| `src/storage.js` | Validated, failure-tolerant, path-scoped localStorage |
| `src/audio.js` | Original procedural sound effects and optional melody; no audio assets or network |

The core physics does not use rigid bodies. Sliding racers are constrained to the sampled track and snapped to actual slide geometry using downward raycasts. Leaving the usable width or missing geometry beyond a grace period starts a fall. Jumps are ballistic in world Y with limited lateral steering; the branch owns its own sampled path and maps to continuous main-course progress. Finished racers rank by arrival; active racers rank by normalized progress, then speed.

Quality defaults to adaptive with a device-pixel-ratio cap of 1.5. Sustained rendering below 43 fps lowers the cap to 1.0 and bypasses optional postprocessing. Low explicitly caps it at 1.0. Shadows and postprocessing default off, and effects are optional. Scenery and humanoids use shared geometries/materials and instancing. The normal full scene is around 70–80 draw calls; visibility changes with camera angle. Real mid-range phone performance still depends on the device and browser.

## Verification

`tests/physics.test.js` checks raycast/frame alignment, a complete race, both ramp landings, real elimination, checkpoint recovery, jump limits, shortcut gap traversal/reconnection, pause behavior, standings, and NPC variability across deterministic seeds.

`scripts/verify.mjs` serves the production build at two sibling subpaths, checks UI and settings persistence, runs finish/fall/practice flows, uses real Chrome multi-touch dispatch, captures both orientations, and reloads both PWAs offline. It also checks for console errors and external runtime requests. Screenshots and the verification report go to `output/verification/`.

The web-game skill's action client is included unchanged at `scripts/web_game_playwright_client.js` so it uses this project's Playwright dependency. `window.render_game_to_text()` and `window.advanceTime(ms)` support automated playtesting. `window.splashline` exposes the track, race and renderer for local inspection; no data is transmitted.

## Assets and privacy

All course geometry, swimmers, accessories, scenery, icons, music and effects were created for this project. Three.js and development dependencies retain their respective licenses. No CDN, analytics, accounts, API keys or server runtime are used. Browser storage is the only persistence. If storage is unavailable the game still runs and displays a save notice.

# Codex Usage 
| Metric | Amount |
|---|---:|
| **Total elapsed time** | **34 min 59.892 sec** |
| **Time to first token** | **2.653 sec** |
| **Input tokens** | **3,719,691** |
| └ Cached input tokens | **3,553,152** |
| └ Uncached input tokens | **166,539** |
| **Output tokens** | **59,945** |
| └ Reasoning output tokens | **9,809** |
| └ Other output tokens | **50,136** |
| **Total tokens** | **3,779,636** |
| Model context window | **258,400 tokens** |

- Model: gpt-6-astra
- Effort: extra high
- Site: https://kjlkurt.github.io/waterslide-game-astra/
