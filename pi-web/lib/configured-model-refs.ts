import { readModelsConfig } from './models-config-store';
// Project only identity out of the server-side config; never return config,
// provider URLs, headers or credentials to the client.
export function configuredModelRefs(): { provider: string; modelId: string }[] {
  try {
    const providers = readModelsConfig().providers;
    if (!providers || typeof providers !== 'object' || Array.isArray(providers)) return [];
    return Object.entries(providers).flatMap(([provider, value]) => {
      if (!value || typeof value !== 'object' || !Array.isArray(value.models)) return [];
      return value.models.flatMap((model: unknown) => model && typeof model === 'object' && 'id' in model && typeof model.id === 'string' ? [{ provider, modelId: model.id }] : []);
    });
  } catch { return []; }
}
