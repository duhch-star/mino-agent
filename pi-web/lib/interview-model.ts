import { createAgentSessionServices, getAgentDir, SettingsManager } from '@earendil-works/pi-coding-agent';
import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import { getAllowedFileRoots, isExistingFilePathAllowed } from './file-access';
import { projectTrustReloadOptions } from './project-trust';
import { getModelRuntimeWithExtensions } from './model-runtime';
import { configuredModelRefs } from './configured-model-refs';
import { resolveVisibleModels, selectInitialModelScope, orderSelectorModels } from './model-scope';

// Only protocols exercised by this text-only feedback adapter. OAuth and custom
// stream implementations remain the SDK's responsibility; no key/URL is copied.
const SUPPORTED_APIS = new Set(['openai-completions', 'openai-responses', 'anthropic-messages', 'google-generative-ai']);
export function interviewModelSupported(model: { api: string; input?: string[] }) {
  return SUPPORTED_APIS.has(model.api) && (!model.input || model.input.includes('text'));
}
export async function loadInterviewModels(requestedCwd?: string) {
  const agentDir = getAgentDir();
  const cwd = requestedCwd ? resolve(requestedCwd) : agentDir;
  if (requestedCwd) {
    const roots = await getAllowedFileRoots();
    if (!isExistingFilePathAllowed(cwd, roots) || !(await stat(cwd)).isDirectory()) throw new Error('Invalid workspace');
  }
  const trust = requestedCwd ? projectTrustReloadOptions(cwd, agentDir) : undefined;
  const services = requestedCwd ? await createAgentSessionServices({ cwd, agentDir, ...(trust ? { resourceLoaderReloadOptions: trust } : {}) }) : null;
  const runtime = services?.modelRuntime ?? await getModelRuntimeWithExtensions();
  const settings = services?.settingsManager ?? SettingsManager.create(agentDir, agentDir);
  const scope = await resolveVisibleModels(runtime, settings.getEnabledModels());
  const provider = settings.getDefaultProvider(), modelId = settings.getDefaultModel();
  const initial = selectInitialModelScope(scope, { configuredModels: configuredModelRefs(), ...(provider && modelId ? { defaultModel: { provider, modelId } } : {}) });
  return { runtime, scope, initial, models: orderSelectorModels(scope).map(model => ({
    provider: model.provider, modelId: model.id, name: model.name,
    supported: interviewModelSupported(model),
    ...(!interviewModelSupported(model) ? { reason: '此供应商协议暂未接入面试反馈；请另选兼容模型。' } : {}),
  })) };
}
export function selectInterviewModel(scope: Parameters<typeof selectInitialModelScope>[0], initial: ReturnType<typeof selectInitialModelScope>, ref?: { provider: string; modelId: string }) {
  const model = ref ? selectInitialModelScope(scope, { requestedModel: ref }).model : initial.model;
  if (!model) throw new Error('请先在对话设置中配置可用模型。');
  if (!interviewModelSupported(model)) throw new Error('当前默认模型协议暂不支持面试反馈，请明确选择兼容模型；不会自动换用其他供应商。');
  return model;
}
