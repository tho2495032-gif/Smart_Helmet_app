/**
 * App-only privacy mode. Set to 1 to skip raw alcohol and continuous GPS
 * telemetry listeners, then rebuild the Android app.
 */
export const MODE_PRIVATE = 1 as 0 | 1;

export const isPrivateMode = MODE_PRIVATE === 1;
