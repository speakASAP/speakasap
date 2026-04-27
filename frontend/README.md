This is the `speakasap-frontend` scaffold for Phase 5.

## Gateway-only contract

All backend calls must go through `speakasap-api-gateway` only.
Do not call domain services directly from frontend code.

Required env key (from root `speakasap/.env`):

- `NEXT_PUBLIC_API_URL` (gateway base URL, for example `http://api-gateway:4210`)

## Run

From this directory:

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Scaffold routes

- `/` - gateway-bound scaffold landing page
- `/learner` - learner portal shell
- `/teacher` - teacher portal shell
- `/admin` - admin portal shell

TASK-70 maps route-level frontend usage to frozen gateway contracts.

## Notes

- This scaffold intentionally avoids domain feature implementation.
- Keep `.env.example` key-only discipline (no secret values).
