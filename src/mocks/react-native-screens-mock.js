// Returns null so every consumer's null-guard falls through to the View fallback.
// @react-navigation/stack: if (Screens != null) → false → uses View
// @react-navigation/bottom-tabs: if (Screens?.screensEnabled?.()) → undefined → uses View
module.exports = null;
