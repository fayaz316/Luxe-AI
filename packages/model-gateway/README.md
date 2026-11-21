# @luxe/model-gateway

Provider-agnostic completion gateway for the luxe platform. Consumers code against a single
`ModelProvider` interface while this package maps requests onto the concrete vendor protocol,
keeping prompt assembly and provider selection out of application code.

## Providers

| Provider               | `id`            | Selected when                                              |
| ---------------------- | --------------- | ---------------------------------------------------------- |
| `GeminiApiKeyProvider` | `gemini-api-key` | `GEMINI_API_KEY` is set (Google AI Studio key)              |
| `VertexGeminiProvider` | `vertex-gemini`  | `GOOGLE_PROJECT` or `GOOGLE_PROJECT_ID` is set              |
| `MockProvider`         | `mock`           | neither is set — deterministic scripted reply for dev/tests |

API-key mode has no runtime dependencies. Vertex mode uses `google-auth-library` (a declared
dependency of this package) loaded lazily, so a missing or broken installation surfaces as
`ProviderError('vertex credentials unavailable')` instead of an import crash. Both Gemini
providers share one `generateContent` body mapping (`src/gemini-protocol.ts`): the request's
`system` string becomes `systemInstruction`, assistant turns map to the Gemini `model` role,
and `temperature`/`maxTokens` map to `generationConfig`.

## Usage

```ts
import { resolveProvider } from '@luxe/model-gateway';

const provider = resolveProvider(process.env);
const result = await provider.complete({
  system: 'You draft client communications for a luxury property.',
  messages: [{ role: 'user', content: 'Client asks for a table on Saturday.' }],
});
console.log(result.text, result.providerId);
```

## Environment variables

| Variable                        | Purpose                                                             |
| ------------------------------- | ------------------------------------------------------------------- |
| `GEMINI_API_KEY`                | Google AI Studio API key; enables the API-key provider (priority 1)  |
| `GOOGLE_PROJECT` / `GOOGLE_PROJECT_ID` | Google Cloud project id; enables the Vertex provider (priority 2) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional service-account key file for Vertex; ambient Application Default Credentials are used when unset |

## Development

```bash
pnpm --filter @luxe/model-gateway build
pnpm --filter @luxe/model-gateway typecheck
pnpm --filter @luxe/model-gateway test
```

Network calls are never made in tests: providers take an injectable `fetchImpl` (or auth
client), and the shared Gemini protocol mapping is unit-tested directly.

## License

Apache-2.0
