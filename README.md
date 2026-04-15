# vue-nmt

A browser-based neural machine translation (NMT) application built with **Vue 3 + Vite**.

This project runs translation directly in the browser using web workers and local model assets. It supports:

- **Text translation** with configurable generation settings.
- **Document translation** for DOCX/PPTX-style zipped XML documents.
- **Progress tracking** for model loading and translation steps.
- **Parallel translation workers** tuned to available CPU cores.

## What this project is about

`vue-nmt` is designed as a local-first translation UI that combines:

- A Vue frontend for interaction and configuration.
- A Pinia store to orchestrate translation state and worker pooling.
- Hugging Face `@huggingface/transformers` running in the browser.
- Prepackaged model/tokenizer files under `public/models`.

The app includes two main workflows:

1. **Translate Text**: paste/type English input and get translated output.
2. **Translate Document**: upload a compatible office document, translate extracted text segments, and reconstruct a downloadable translated file.

## Tech stack

- Vue 3
- Vite
- TypeScript
- Pinia
- Tailwind CSS
- Web Workers
- Hugging Face Transformers.js

## Project setup

```sh
pnpm install
```

### Development

```sh
pnpm dev
```

### Type-check and build

```sh
pnpm build
```

### Lint

```sh
pnpm lint
```

## License

This repository is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.
