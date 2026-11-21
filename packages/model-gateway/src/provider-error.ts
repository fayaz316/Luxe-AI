// SPDX-License-Identifier: Apache-2.0

/** Error raised for provider configuration or response failures. */
export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}
