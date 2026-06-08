# OOT test project for tvOS

## 🚀 How to use

Have a booted Apple TV simulator running.

```sh
pnpm
pnpm prebuild:tv
pnpm tvos:pod-install
pnpm tvos:debug:build
pnpm tvos:debug:install
```

Then start the packager, and run the app on the Apple TV simulator.

## Things that work

- pod install
- tvOS build
- tvOS debug app runs
- tvOS debug app connects to packager
- tvOS debug app renders correctly with no errors or warnings
- tvOS release build compiles and runs


## Things that don't work yet

- Published canary bare-minimum template is missing the tvos folder
- `expo.icon` not copied into tvos folder
- Pod install not automatically run for tvos on prebuild
- No `expo run:tvos` command yet

## Notes

- Since we are still patching react-native-tvos, we need the buildReactNativeFromSource flag set 
