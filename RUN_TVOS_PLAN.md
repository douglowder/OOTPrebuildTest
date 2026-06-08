# Plan: `expo run:tvos`

Add an `expo run:tvos` command to `@expo/cli` that mirrors `expo run:ios`, building and launching an Apple TV app on a tvOS simulator/device.

Status: **proposal for team review** (not yet implemented).
Source references are to `packages/@expo/cli/src` in the `expo/expo` monorepo.

## TL;DR

`run:ios` is already substantially parameterized by `osType`, and the lower layers are already tvOS-aware. So this is mostly: add a `run:tvos` entry, thread the Expo platform (`'tvos'`) + native dir (`tvos/`) through the four places `runIosAsync` hardcodes `'ios'`, force `osType: 'tvOS'`, and add two small `tvOS`-case additions. No parallel build stack needed.

## Background

The new `outOfTreePlatforms` workflow puts the tvOS native project in `tvos/` (separate from `ios/`), with `react-native` + `react-native-tvos` as distinct packages and a Metro out-of-tree redirect. `run:ios` currently can't target it.

## Current state

### Already generic / tvOS-aware — reuse as-is
- `run/ios/XcodeBuild.ts` `getGenericSimulatorDestination(osType)` — already has `case 'tvOS': return 'generic/platform=tvOS Simulator'`.
- `run/ios/XcodeBuild.ts` `getAppBinaryPath` / `matchEstimatedBinaryPath` — matches `Debug|Release-<sdk>` generically (works for `*-appletvsimulator`).
- `start/platforms/ios/simctl.ts` — `OSType = 'iOS' | 'tvOS' | 'watchOS' | 'macOS' | 'xrOS'`; simctl lists tvOS sims with `osType`.
- `run/ios/options/resolveDevice.ts` — filters by `osType`; the default branch (`device.osType === osType`) already handles tvOS. Simulator detection is generic (`com.apple.CoreSimulator.SimDeviceType.` prefix).
- Code signing, `launchApp.ts`, `AppleAppIdResolver`, dev-server/bundler start (`startBundler`), `validateExternalBinary`.

### iOS-hardcoded seams to make platform-aware
1. **Command registration** — `run/index.ts` dispatches only `android`/`ios` (~L55–66) and the interactive platform prompt lists only those two.
2. **`run/ios/runIosAsync.ts` pipeline** passes the Expo platform `'ios'` literally to:
   - `ensureNativeProjectAsync({ platform: 'ios', install })` (L36) — must be `'tvos'` so prebuild generates the tvOS project.
   - `exportEagerAsync({ platform: 'ios' })` (L107, L127) — must be `'tvos'` (Release eager bundle).
   - `resolveBuildCache` / `uploadBuildCache({ platform: 'ios' })` (L48, L158, L222).
3. **`osType` defaulting** — `run/ios/options/resolveOptions.ts:34` derives `osType` from the scheme, defaulting to `'iOS'`. `run:tvos` must resolve/force `'tvOS'`.
4. **Native project directory** — `run/ios/options/resolveXcodeProject.ts` looks in `ios/`; the tvOS project is in `tvos/`. Needs to be platform-parameterized.
5. **`run/ios/options/appleDestinations.ts` `coerceDestinationPlatformToOsType`** — add a `case 'tvOS'` (currently hits the warn/default branch).
6. **`assertPlatform`** (darwin check, `runIosAsync.ts:231`) — applies to tvOS too; reuse, just adjust the message.

## Proposed approach

Generalize the Apple run flow rather than fork it.

1. **Refactor `runIosAsync` → `runAppleAsync(projectRoot, options, ctx)`** where `ctx = { platform: 'ios' | 'tvos', osType: OSType, nativeDir: string }`. Keep `runIosAsync` as a thin wrapper passing `{ platform: 'ios', osType: 'iOS', nativeDir: 'ios' }`. Replace the four hardcoded `'ios'` pipeline args with `ctx.platform`.
2. **Add `run/tvos/index.ts`** mirroring `run/ios/index.ts` — same args (`--device`, `--configuration`, `--scheme`, `--binary`, `--port`, `--no-build-cache`, `--output`, …), help text `expo run:tvos`, calling `runAppleAsync(..., { platform: 'tvos', osType: 'tvOS', nativeDir: 'tvos' })`.
3. **`run/index.ts`** — add `case 'tvos'` dispatch; add tvOS to the interactive prompt, gated on the project actually targeting tvOS (`outOfTreePlatforms` / a tvOS scheme present).
4. **`resolveOptions.ts` + `resolveXcodeProject.ts`** — thread `osType`/`nativeDir` so the tvOS scheme and `tvos/` workspace resolve; force `osType: 'tvOS'` for the tvos command.
5. **`appleDestinations.ts`** — add the `tvOS` coercion case.

## Prerequisites & gotchas
- **`babel-preset-expo` `Platform.OS` → `'ios'` for tvos builds is effectively a prerequisite** for `run:tvos --configuration Release`: without it, `exportEagerAsync({ platform: 'tvos' })` ships a bundle where `Platform.OS === 'ios'` checks (e.g. `View.js` `isTVSelectable`) are dead-code-eliminated, breaking TV focus. (Confirmed root cause of the release-only focus bug; fix verified.) Land that first/together.
- **`outOfTreePlatforms`**: `ensureNativeProjectAsync({ platform: 'tvos' })` must route prebuild to `--platform tvos` and the `tvos/` output dir.
- **Scheme resolution**: `resolveNativeScheme` already returns an `osType` per scheme — use it to pick the tvOS scheme.
- **Default device**: `resolveDevice` with `osType: 'tvOS'` filters to tvOS sims; verify the default-device pick / boot path handles an Apple TV sim.

## Related fix: `prebuild --platform tvos` should run install / pod install

Today `expo prebuild --platform tvos` skips the CocoaPods install step, and the Apple install path is hardcoded to `ios/`. This must be fixed so the tvOS project is install-complete after prebuild (and so `run:tvos`'s `ensureNativeProjectAsync` + `maybePromptToSyncPodsAsync` work).

- `prebuild/prebuildAsync.ts:182` — pod-install gate is `options.platforms.includes('ios') && options.install && needsPodInstall`; `'tvos'` is never included, so tvOS never installs Pods. (Same iOS-only gate at L190 for inline modules.)
- `utils/cocoapods.ts` hardcodes `ios/` throughout: `installCocoaPodsAsync` cwd `path.join(projectRoot, 'ios')` (L80); `doesProjectUseCocoaPods` → `ios/Podfile` (L134); the needs-install check → `ios/Podfile.lock` / `ios/Pods` (L138, L143). So even if triggered for tvOS it would install in `ios/`.

Fix:
1. `prebuildAsync.ts` — include `'tvos'` in the install gate and pass the target native dir (`tvos`) through.
2. `utils/cocoapods.ts` — parameterize the Apple native dir (`'ios' | 'tvos'`) across `installCocoaPodsAsync`, `doesProjectUseCocoaPods`, the pod-install-needed check, and `maybePromptToSyncPodsAsync` (which `run:ios`/`run:tvos` call). Default to `ios` to preserve existing behavior.

Note: `configureProjectAsync.ts:55–57` already widens `tvos`→adds `ios` for mods, and `ensureConfigAsync.ts`/`configureProjectAsync.ts` already treat `tvos` alongside `ios` — so the config/mods side handles tvOS; only the **install** step is missing.

## Testing
- Unit: extend `run/ios/options/__tests__` with `osType: 'tvOS'` fixtures (destination string, device filtering, `*-appletvsimulator` binary-path match).
- Manual e2e: `expo run:tvos` (debug, simulator); `--configuration Release`; `--device generic` (build-only); `--device <tvOS sim>`; physical Apple TV if available.
- Prebuild install: `expo prebuild --platform tvos` (no `--no-install`) runs `pod install` in `tvos/` and leaves the project install-complete; `--no-install` skips it; `ios`-only and `android`-only prebuilds are unaffected.

## Open questions for the team
- Command surface: dedicated `run:tvos` vs. `run:ios --platform tvos` / an `--os` flag? (Proposal: dedicated `run:tvos`, consistent with `run:ios`/`run:android`.)
- Should the tvOS prompt option always appear, or only when the project targets tvOS?
- Naming: `runAppleAsync` vs. keeping `runIosAsync` generalized in place.
