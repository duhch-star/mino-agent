import { Type } from '@earendil-works/pi-ai';
import { defineTool, type InlineExtension } from '@earendil-works/pi-coding-agent';
import { mkdir, writeFile, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { getBridgeToken } from './minos-auth';
import { CAREER_UI_PROMPT } from './career-ui-prompt';
import { createMinosDocumentTool } from './minos-document-tool';

const entry = Type.Object({ heading: Type.String(), subtitle: Type.String(), location: Type.String(), dates: Type.String(), items: Type.Array(Type.String()) });
const section = Type.Object({ title: Type.String(), items: Type.Array(Type.String()), entries: Type.Array(entry), column: Type.Union([Type.Literal('auto'), Type.Literal('left'), Type.Literal('right')]) });
const resume = Type.Object({ name: Type.String(), contact: Type.String(), summary: Type.String(), sections: Type.Array(section) });
const revision = Type.Integer({ minimum: 0 });
const definitions = [
  { name: 'resume_read', label: '读取简历', description: '读取当前会话完整简历及修订号。', parameters: Type.Object({}) },
  { name: 'resume_update', label: '保存简历', description: '以完整结构保存简历，成功后自动编译并下载本次版本PDF；返回真实保存前后changes和previousRevision。', parameters: Type.Object({ resume, expectedRevision: revision }) },
  { name: 'resume_set_template', label: '切换原版模板', description: '只切换原版 classic 单栏或 sidebar 双栏模板，保存后自动编译并下载本次版本PDF；返回真实模板changes和previousRevision。', parameters: Type.Object({ template: Type.Union([Type.Literal('classic'), Type.Literal('sidebar')]), expectedRevision: revision }) },
  { name: 'resume_compile', label: '编译简历PDF', description: '只编译当前版本并保存PDF到会话工作区，可用于重试编译；不得保存或修改简历正文，不得为编译调用resume_update/resume_set_template。', parameters: Type.Object({}) },
];

export function createMinosResumeExtension(getSessionId: () => string): InlineExtension {
  return { name: 'minos-resume', hidden: true, factory(pi) {
    if (!process.env.MINOS_PI_BRIDGE_SECRET) return;
    pi.on('before_agent_start', (event) => ({ systemPrompt: event.systemPrompt + '\n' + CAREER_UI_PROMPT + '\n用户上传或以 @ 引用 PDF、DOCX、DOC 时，必须先用 document_read 提取其文字，再基于提取内容回答；不要用普通 read 读取二进制，不要猜测文档内容。工具报告空内容、扫描件或格式错误时如实说明并请用户提供可读文本/DOCX。' }));
    const base = process.env.MINOS_API_BASE_URL || 'http://127.0.0.1:8000';
    pi.registerTool(createMinosDocumentTool(base));
    for (const tool of definitions) pi.registerTool(defineTool({
      ...tool, exposure: 'model-only',
      description: tool.description + ' 用户要求建立/完善并保存简历时必须真实调用；用户仅要求建议、分析或明确不保存时不得调用保存/切换模板工具。修改前先resume_read，完整保留未修改字段，不虚构学校公司成绩。发生版本冲突先重读。保存成功后自动生成PDF；compileError仅表示PDF生成失败，不代表保存失败，不要重复保存。',
      async execute(_id, args, signal) {
        const token = getBridgeToken();
        if (!token) throw new Error('请从 MINOS 重新连接聊天后使用简历工具');
        const sessionId = getSessionId();
        const auth = { bridgeSecret: process.env.MINOS_PI_BRIDGE_SECRET, token, piSessionId: sessionId };
        const call = async (name: string, arguments_: unknown) => {
          const response = await fetch(`${base}/api/pi-web/resume-tool`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...auth, name, arguments: arguments_ }), signal });
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `简历操作失败 (${response.status})，请重新读取后重试`);
          }
          return response.json();
        };
        const result = await call(tool.name, args);
        const save = tool.name === 'resume_update' || tool.name === 'resume_set_template';
        if (save || tool.name === 'resume_compile') {
          // Saving is already committed. Compilation/download failures must never
          // disguise that success, including cancellation after the save response.
          if (save) { result.saved = true; result.pdfPath = null; }
          try {
            if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) throw new Error('Invalid session id');
            if (!Number.isSafeInteger(result.revision) || result.revision < 0) throw new Error('Invalid PDF revision');
            const compiled = save ? await call('resume_compile', {}) : result;
            // The server compiles its current revision, which may have advanced
            // since our save. Never attribute another writer's PDF to this save.
            if (compiled.revision !== result.revision) throw new Error('保存后简历已更新，本次版本PDF不可用，请重新读取后编译');
            const pdf = await fetch(`${base}/api/pi-web/resume-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...auth, revision: result.revision }), signal });
            if (!pdf.ok || !pdf.headers.get('content-type')?.includes('application/pdf')) throw new Error('PDF已编译，但获取失败或版本已更新，请重新读取后编译');
            if (!process.env.MINOS_PI_WORKSPACE) throw new Error('PDF workspace is not configured');
            const folder = join(resolve(process.env.MINOS_PI_WORKSPACE), 'resume-previews');
            await mkdir(folder, { recursive: true });
            if ((await lstat(folder)).isSymbolicLink()) throw new Error('PDF folder must not be a link');
            const data = Buffer.from(await pdf.arrayBuffer());
            if (data.length > 20 * 1024 * 1024) throw new Error('PDF too large');
            // Unique exclusive creation: never trust an existing file (or symlink)
            // on EEXIST, and never return it as this request's downloaded PDF.
            const target = join(folder, `${sessionId}-r${result.revision}-${randomUUID()}.pdf`);
            await writeFile(target, data, { flag: 'wx', mode: 0o600 });
            result.pdfPath = target.replaceAll('\\', '/');
            if (save) result.warnings = compiled.warnings;
          } catch (error) {
            if (!save) throw error;
            result.compileError = `简历已保存（修订 ${result.revision}），但PDF生成或下载失败：${error instanceof Error ? error.message : String(error)}`;
          }
        }
        return { content: [{ type: 'text', text: JSON.stringify(result) }], details: { kind: 'minos-resume', result } };
      },
    }));
  } };
}
