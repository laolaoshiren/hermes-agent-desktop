# Aurora Desk

Aurora Desk is a Chinese-first desktop AI workspace built around the `NousResearch/hermes-agent` product direction, exposed as an independent open-source desktop layer.

## Product direction

- Chinese-first interface, with English available in onboarding and settings
- Open-source GitHub-hosted desktop product layer
- UI only talks to the local adapter, not directly to the upstream runtime
- Runtime manager, adapter, Electron shell, and frontend are separated for future Hermes syncing
- The upstream Hermes source is vendored under [`vendor/hermes-agent`](./vendor/hermes-agent)

## Workspace layout

```text
apps/
  desktop/
    electron/   Electron main process and preload bridge
    frontend/   React desktop UI
packages/
  shared/       Shared contracts, branding, error definitions
  runtime-manager/
  adapter/      Local HTTP adapter for bootstrap, sessions, settings, streaming chat, updates
vendor/
  hermes-agent/ Upstream runtime source for later integration
```

## v0.1.0 scope

This first public version includes:

- Electron desktop shell
- React frontend with onboarding, chat, capabilities, settings, and status pages
- Chinese default UI with English as a secondary language option
- Local session persistence, attachment handling, diagnostics export, and health endpoints
- Real streaming model calls through the local adapter
- Provider support for:
  - OpenAI
  - OpenRouter
  - Anthropic
  - Ollama
  - OpenAI-compatible endpoints
  - Custom OpenAI-compatible endpoints
- Local smoke test that verifies end-to-end streaming against a mock provider

## Runtime mode in this release

`v0.1.0` is usable today in direct-provider mode on Windows.

- The desktop app connects to configured providers directly through the local adapter
- The repo already vendors the upstream `hermes-agent` source and keeps the product architecture ready for a deeper Hermes-native bridge
- Native Hermes runtime bridging on Windows is still experimental because the upstream runtime currently expects a stronger Python/WSL environment than this release bundles

That means this release is honest about its current execution path: usable desktop chat now, deeper Hermes runtime integration next.

## Development

Requirements:

- Node.js 24+
- npm 11+

Commands:

```bash
npm install
npm run build
npm run smoke
npm run start
```

`npm run smoke` starts a mock OpenAI-compatible provider and verifies the desktop adapter can stream a real response end to end.

## Open source and upstream

- Upstream runtime: [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)
- Upstream license: MIT
- See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for bundled third-party attribution

## License

This repository is released under the MIT License. See [`LICENSE`](./LICENSE).
