/* Generate a standalone file with Node.js built-ins; no packages needed. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, 'dist', 'Petal.html'));
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const inlineScript = (name) => `<script>\n${read(name).replace(/<\/script/gi, '<\\/script')}\n</script>`;

let html = read('index.html');
html = html.replace('  <link rel="stylesheet" href="styles.css">', () => `  <style>\n${read('styles.css')}\n</style>`);
// Place the scripts after the DOM. External scripts use defer; inline scripts
// execute immediately, so keeping their original head location would break it.
html = html.replace('  <script src="calculator.js" defer></script>\n', '');
html = html.replace('  <script src="app.js" defer></script>\n', '');
html = html.replace('</body>', () => `${inlineScript('calculator.js')}\n${inlineScript('app.js')}\n</body>`);

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
console.log(`Petal exportada: ${output} (${Buffer.byteLength(html)} bytes)`);
