// Build-time config read from Expo public env vars. Populate `mobile/.env`
// (gitignored) from `.env.example` to point the LIVE page at your board.
//
// EXPO_PUBLIC_BOARD_HOST — "<ip>" or "<ip>:<port>" of the ESP32's HTTP server.
// Leave unset to force the LIVE page into OFFLINE.

const raw = process.env.EXPO_PUBLIC_BOARD_HOST;
export const BOARD_HOST: string | null = raw && raw.length > 0 ? raw : null;
