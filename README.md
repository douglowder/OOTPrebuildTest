# OOT test project for tvOS

## 🚀 How to use

```sh
pnpm
pnpm prebuild:tv
pnpm tvos:pod-install
pnpm tvos:build
```

Then start the packager, and copy the OOTPrebuildTest image from tvos/build/Build/Products/Debug-appletvsimulator into your running Apple TV simulator, and run it.

## Things that work

- pod install
- tvOS build
- tvOS debug app runs
- tvOS debug app connects to packager
- tvOS debug app renders correctly with no errors or warnings


## Things that don't work

- tvOS release build crashing, still debugging this
- Published canary bare-minimum template is missing the tvos folder
- `expo.icon` not copied into tvos folder
- Pod install not automatically run for tvos on prebuild
- No `expo run:tvos` command yet
- 
