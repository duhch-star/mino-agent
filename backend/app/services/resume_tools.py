"""OpenAI-compatible tool declarations for the shared multi-turn chat harness."""
from app.resume_schemas import Resume


def _complete(schema):
    if schema.get('type') == 'object':
        schema['required'] = list(schema.get('properties', {}))
        schema['additionalProperties'] = False
    for value in schema.values():
        if isinstance(value, dict):
            _complete(value)
        elif isinstance(value, list):
            for child in value:
                if isinstance(child, dict):
                    _complete(child)
    return schema


RESUME_SCHEMA = _complete(Resume.model_json_schema())
# Move $defs to the parameters root so local JSON references resolve correctly.
DEFINITIONS = RESUME_SCHEMA.pop('$defs', {})
RULES = ('仅操作当前登录账号的当前会话简历。修改前先 resume_read 读取最新完整状态与 revision；'
         '只改用户明确要求的内容，保留其他履历、entries、column。禁止虚构公司、学校、学历、经历、'
         '技能、时间、职位或量化结果；缺少信息应向用户询问，空简历保持为空。所有字段是纯文本，禁止生成或执行 TeX。')


def _tool(name, description, properties=None, required=None, definitions=False):
    parameters = {'type': 'object', 'properties': properties or {}, 'required': required or [], 'additionalProperties': False}
    if definitions:
        parameters['$defs'] = DEFINITIONS
    return {'type': 'function', 'function': {'name': name, 'description': description + RULES, 'parameters': parameters}}


REVISION = {'type': 'integer', 'minimum': 0, 'description': 'resume_read 返回的当前 revision；冲突后重新读取，不得猜测。'}
TOOLS = [
    _tool('resume_read', '读取当前会话完整简历、模板与修订号。不存在时返回空 draft revision=0。'),
    _tool('resume_update', '提交完整简历替换（非 patch）；必须保留所有未涉及字段以及每个 section 的 entries/column、每个 entry 的全部字段。成功返回完整最新状态。',
          {'resume': RESUME_SCHEMA, 'expectedRevision': REVISION}, ['resume', 'expectedRevision'], definitions=True),
    _tool('resume_set_template', '只切换模板，不改变简历正文。成功返回完整最新状态。',
          {'template': {'type': 'string', 'enum': ['classic', 'sidebar', 'mcdowell', 'hunner', 'minimal']}, 'expectedRevision': REVISION}, ['template', 'expectedRevision']),
    _tool('resume_compile', '用当前修订和当前原版模板安全编译 PDF，返回 revision/template/pdfUrl/warnings。仅当前修订可预览，不能传入源码或路径。'),
]
