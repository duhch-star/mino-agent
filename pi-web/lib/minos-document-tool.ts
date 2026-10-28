import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { getBridgeToken } from './minos-auth';

/** Uploaded documents live in the account workspace, not the legacy chat DB. */
export function createMinosDocumentTool(base: string) {
  return defineTool({
    name: 'document_read', label: '读取上传文档', exposure: 'model-only',
    description: '提取上传到当前 MINOS 工作区的 PDF、DOCX、DOC 文本。用户以 @文件 引用这些文档时先调用本工具，不要用普通 read 读取二进制，不要猜测内容。扫描PDF无文字时会明确报错（本地无OCR）。',
    parameters: Type.Object({ path: Type.String({ description: '上传文档的相对工作区路径或工作区内绝对路径；不含 @ 前缀。' }) }),
    async execute(_id, args, signal) {
      const token = getBridgeToken();
      if (!token) throw new Error('请从 MINOS 重新连接聊天后读取文档');
      const response = await fetch(`${base}/api/pi-web/document-read`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
        body: JSON.stringify({ bridgeSecret: process.env.MINOS_PI_BRIDGE_SECRET, token, path: args.path }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `文档解析失败 (${response.status})`);
      }
      const result = await response.json();
      return { content: [{ type: 'text', text: `文档：${result.name}\n${result.truncated ? '（内容已截断）\n' : ''}${result.text}` }], details: { kind: 'minos-document', name: result.name, truncated: result.truncated } };
    },
  });
}
