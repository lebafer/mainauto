# Security notes

## Dependency audit exception

The web application is a client-side Vite SPA using `BrowserRouter`. It does not
enable React Router's RSC framework mode, server actions, or RSC action
endpoints.

`GHSA-qwww-vcr4-c8h2` currently has no patched React Router 7 release and only
affects RSC mode. CI therefore ignores this single advisory while still failing
for every other high or critical advisory. Remove the exception as soon as a
compatible patched release is available, or immediately if RSC/framework mode
is introduced.

All other production dependencies must pass `bun audit --audit-level high`.
