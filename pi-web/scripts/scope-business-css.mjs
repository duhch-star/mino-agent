// Migration helper: keep imported business selectors out of upstream Pi UI.
import postcss from 'postcss';
import { readFileSync, writeFileSync } from 'node:fs';
for (const name of ['pages', 'pi-knowledge']) {
  const file = new URL(`../components/minos/styles/${name}.css`, import.meta.url);
  const root = postcss.parse(readFileSync(file, 'utf8'));
  root.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    rule.selectors = rule.selectors.map(selector => selector.startsWith('.minos-native ') ? selector : `.minos-native ${selector}`);
  });
  writeFileSync(file, root.toString());
}
