// Builds the minified files the pages load from the readable sources.
// Run `npm install` once, then `npm run build` after editing any CSS or JS.
//
//   css/grid.css + css/style.css   -> css/site.min.css   (every page)
//   css/tools.css                  -> css/tools.min.css  (loaded with a tool)
//   js/main.js                     -> js/main.min.js
//   js/cv-analyser.js + cv-review.js                          -> js/cv.min.js
//   js/interview-questions.js + interview-analyser.js + interview.js -> js/interview.min.js
//   js/questionnaire-data.js + questionnaire-profile.js + questionnaire.js -> js/profile.min.js
import { transform } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const css = {
  'css/site.min.css': ['css/grid.css', 'css/style.css'],
  'css/tools.min.css': ['css/tools.css']
};
const js = {
  'js/main.min.js': ['js/main.js'],
  'js/cv.min.js': ['js/cv-analyser.js', 'js/cv-review.js'],
  'js/interview.min.js': ['js/interview-questions.js', 'js/interview-analyser.js', 'js/interview.js'],
  'js/profile.min.js': ['js/questionnaire-data.js', 'js/questionnaire-profile.js', 'js/questionnaire.js']
};

async function join(files, sep) {
  const parts = await Promise.all(files.map((f) => readFile(f, 'utf8')));
  // Only the first file may open with @charset.
  return parts.map((p, i) => (i ? p.replace(/^@charset "UTF-8";/, '') : p)).join(sep);
}

for (const [out, files] of Object.entries(css)) {
  const { code } = await transform(await join(files, '\n'), { loader: 'css', minify: true });
  await writeFile(out, code);
  console.log(out, code.length);
}
for (const [out, files] of Object.entries(js)) {
  const { code } = await transform(await join(files, ';\n'), { loader: 'js', minify: true, target: 'es2018' });
  await writeFile(out, code);
  console.log(out, code.length);
}
