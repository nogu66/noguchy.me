# Claude Mods cheat sheet

Source for https://noguchy.me/claude-mods-cheatsheet/ (ja) and /en/claude-mods-cheatsheet/ (en).

## Updating

1. Compare `cheatsheet.html` (the `DATA` block, `{ ja, en }` pairs) against
   https://code.claude.com/docs/en/plugins/mods/reference and the types Claude Code
   writes for the current build (`.claude-plugin/types/claude-code/index.d.ts` in any mod).
2. Edit `src/data/claude-mods-cheatsheet.json`: set `version` and `date`, and prepend a
   `history` entry. The sheet header and the site pages both read this file.
3. `node tools/claude-mods-cheatsheet/export.mjs` writes PNG / SVG / WebP for both
   languages into `public/claude-mods-cheatsheet/`, plus `ogp.png` from `ogp.html`.

Open `cheatsheet.html` in a browser to preview (`?lang=en` for English). The text is
auto-fitted to A4 (2480 × 3508 px), so adding rows shrinks everything.
