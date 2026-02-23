# E2E Regression Flows

## Logout Regression (Maestro)

File: `e2e/maestro/logout-regression.yaml`

Purpose:
- Reproduces and guards the critical auth bug where logout did not return users to login.

What it validates:
1. Sign out from `More` tab works.
2. Native confirmation is accepted.
3. Login screen is shown (`login-button` and `Welcome back`).

Run:
```bash
npm run e2e:logout:maestro
```

Prerequisites:
- Maestro CLI installed locally.
- Built app installed on emulator/device with app id `com.surreyalign.app`.
- Existing authenticated session before test starts.
