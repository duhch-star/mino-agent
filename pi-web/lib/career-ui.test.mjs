import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const { parseCareerUI } = await createJiti(import.meta.url).import("./career-ui.ts");
const base = { version: 1, type: "job-match", title: "产品经理 · 岗位匹配", items: [{ id: "one", title: "需求分析", status: "strength", evidence: "用户提供的项目经历" }] };
const fence = (data) => `\`\`\`minos-ui\n${typeof data === "string" ? data : JSON.stringify(data)}\n\`\`\``;
const isUI = (data) => parseCareerUI(fence(data)).segments[0]?.kind === "ui";

// Follow the existing transpile/VM harness pattern; CSS is deliberately a no-op.
const require = createRequire(import.meta.url);
const componentModule = { exports: {} };
const componentSource = readFileSync(new URL("../components/CareerGeneratedUI.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(componentSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
runInNewContext(outputText, { exports: componentModule.exports, module: componentModule, require: (id) => id.endsWith(".css") ? {} : require(id) });
const { CareerGeneratedUI } = componentModule.exports;
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const render = (data, onAction) => renderToStaticMarkup(React.createElement(CareerGeneratedUI, { data, onAction }));

test("all eight scenarios use the exact v1 protocol", () => {
  for (const type of ["job-match", "resume-review", "interview-feedback", "action-plan", "application-tracker", "learning-roadmap", "offer-compare", "skill-matrix"]) {
    const data = { ...base, type, summary: "对照真实材料", actions: [{ label: "继续完善", prompt: "帮我完善这项经历" }] };
    assert.deepEqual(parseCareerUI(fence(data)), { segments: [{ kind: "ui", data }], pending: false });
  }
});
test("text before, between and after cards is retained in order", () => {
  const parsed = parseCareerUI(`前言\n${fence(base)}\n中间\n${fence({ ...base, title: "下一步" })}\n结语`);
  assert.deepEqual(parsed.segments.map((segment) => segment.kind), ["text", "ui", "text", "ui", "text"]);
  assert.equal(parsed.segments[0].text, "前言\n");
  assert.equal(parsed.segments[2].text, "中间\n");
  assert.equal(parsed.segments[4].text, "结语");
});
test("invalid complete JSON or schema round-trips verbatim without throwing", () => {
  for (const data of ["{", "null", "[]", "true", { ...base, version: 2 }, { ...base, type: "html" }, { ...base, title: " " }, { ...base, html: "<b>unsafe</b>" }, { ...base, url: "https://example.org" }, { ...base, items: [{ id: "a", title: "x", href: "javascript:x" }] }, { ...base, actions: [{ label: "go", prompt: "draft", autoSend: true }] }]) {
    const source = `before\n${fence(data)}\nafter`;
    assert.deepEqual(parseCareerUI(source), { segments: [{ kind: "text", text: source }], pending: false });
  }
});
test("streamed incomplete protocol hides raw JSON but preserves preceding text/cards", () => {
  for (const partial of ["```minos-ui", "```minos-ui\n", '```minos-ui\n{"version":1', `\`\`\`minos-ui\n${JSON.stringify(base)}\n\`\``]) {
    assert.deepEqual(parseCareerUI(`前言\n${partial}`), { segments: [{ kind: "text", text: "前言\n" }], pending: true });
  }
  const parsed = parseCareerUI(`${fence(base)}\n后续\n\`\`\`minos-ui\n{`);
  assert.deepEqual(parsed.segments.map((segment) => segment.kind), ["ui", "text"]);
  assert.equal(parsed.segments[1].text, "后续\n");
  assert.equal(parsed.pending, true);
});
test("normal Markdown/code examples are not accidentally interpreted", () => {
  for (const source of ["", "ordinary text", 'inline ```minos-ui\n{}\n```', `\`\`\`\`markdown\n${fence(base)}\n\`\`\`\``, `~~~markdown\n${fence(base)}\n~~~`, "```json\n{}\n```", "```minos-ui-extra\n{}\n```", "    ```minos-ui\n{}\n    ```"]) {
    assert.deepEqual(parseCareerUI(source), { segments: source ? [{ kind: "text", text: source }] : [], pending: false });
  }
});
test("CRLF and adjacent empty fences terminate correctly", () => {
  assert.equal(parseCareerUI(fence(base).replaceAll("\n", "\r\n")).segments[0].kind, "ui");
  assert.equal(parseCareerUI("```minos-ui\n```\n").pending, false);
  assert.equal(parseCareerUI(`${fence(base)}\n${fence(base)}`).segments.length, 2);
});
test("bounds, duplicate IDs, strict optional field types and nested records", () => {
  assert.equal(isUI({ ...base, items: [] }), true);
  assert.equal(isUI({ ...base, items: Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, title: "ok" })) }), true);
  for (const data of [
    { ...base, items: Array.from({ length: 21 }, (_, i) => ({ id: `${i}`, title: "x" })) },
    { ...base, items: [base.items[0], base.items[0]] },
    { ...base, title: "x".repeat(161) }, { ...base, summary: null },
    { ...base, items: [{ ...base.items[0], description: {} }] },
    { ...base, items: [{ ...base.items[0], status: "applied" }] },
    { ...base, actions: Array.from({ length: 5 }, () => ({ label: "x", prompt: "x" })) },
    { ...base, actions: [{ label: "x", prompt: " " }] },
    { ...base, items: [{ ...base.items[0], evidence: "x".repeat(4001) }] },
  ]) assert.equal(isUI(data), false);
  assert.equal(isUI(`{"version":1,"type":"job-match","title":"x","items":[],"__proto__":{}}`), false);
  assert.equal(isUI(" ".repeat(64001) + JSON.stringify(base)), false);
});
test("score fields must be finite bounded numbers with a valid range", () => {
  for (const item of [{ score: -1 }, { maxScore: 0 }, { score: 11, maxScore: 10 }, { score: "5", maxScore: 10 }, { maxScore: 1000001 }]) {
    assert.equal(isUI({ ...base, items: [{ ...base.items[0], ...item }] }), false);
  }
  assert.equal(isUI({ ...base, items: [{ ...base.items[0], score: 0, maxScore: 5 }] }), true);
  // Incomplete score metadata may be retained as data, but must never produce a visual score.
  assert.equal(isUI({ ...base, items: [{ id: "x", title: "x", score: 3 }] }), true);
  assert.equal(isUI('{"version":1,"type":"job-match","title":"x","items":[{"id":"x","title":"x","score":1e999}]}'), false);
});
test("all layouts render accessible content with evidence and literal escaped strings", () => {
  for (const type of ["job-match", "resume-review", "interview-feedback", "action-plan", "application-tracker", "learning-roadmap", "offer-compare", "skill-matrix"]) {
    const html = render({ ...base, type, items: [{ ...base.items[0], before: "原始版本", after: "建议版本", score: 4, maxScore: 5 }] });
    assert.match(html, /用户提供的项目经历/);
    assert.match(html, /依据/);
    assert.match(html, /aria-labelledby=/);
    if (type === "resume-review") { assert.match(html, /原始版本/); assert.match(html, /建议版本/); }
    if (type === "interview-feedback") assert.match(html, /<progress/);
    if (type === "action-plan") { assert.match(html, /type="checkbox"/); assert.match(html, /本地勾选，不代表已执行/); }
    if (type === "application-tracker") assert.match(html, /用户信息，不自动投递/);
  }
  const html = render({ ...base, title: '<img src=x onerror="alert(1)">' });
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/);
});
test("visual scores require explicit score, maxScore and nonempty evidence", () => {
  for (const item of [{ score: 4 }, { score: 4, maxScore: 5 }, { score: 4, maxScore: 5, evidence: " " }, { score: 9, maxScore: 5, evidence: "依据" }, { score: NaN, maxScore: 5, evidence: "依据" }]) {
    const html = render({ ...base, type: "interview-feedback", items: [{ id: "x", title: "表达", ...item }] });
    assert.doesNotMatch(html, /<progress|career-score-value/);
  }
  const html = render({ ...base, type: "interview-feedback", items: [{ ...base.items[0], score: 0, maxScore: 5 }] });
  assert.match(html, /<progress/);
  assert.match(html, /value="0"/);
});
test("actions are omitted without callback, and server render never invokes callback", () => {
  const data = { ...base, actions: [{ label: "完善经历", prompt: "请完善经历" }] };
  assert.doesNotMatch(render(data), /career-actions|完善经历/);
  assert.match(render(data), /复制内容/);
  assert.match(render(data), /aria-expanded="true"/);
  let calls = 0;
  const html = render(data, () => { calls++; });
  assert.match(html, /完善经历/);
  assert.match(html, /仅填入草稿/);
  assert.equal(calls, 0);
});
test("model strings stay literal; no HTML/URL rendering or automatic actions", () => {
  assert.equal(isUI({ ...base, title: '<script>alert("x")</script> https://example.org' }), true);
  const component = readFileSync(new URL("../components/CareerGeneratedUI.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /dangerouslySetInnerHTML|fetch\(|window\.open|href=/);
  assert.match(component, /onAction\(action\.prompt\)/);
  assert.match(component, /onAction &&/);
  assert.match(component, /本地勾选，不代表已执行/);
  assert.match(component, /用户信息，不自动投递/);
  assert.match(component, /!evidence\?\.trim\(\)/);
  const css = readFileSync(new URL("../components/career-generated-ui.css", import.meta.url), "utf8");
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
});
