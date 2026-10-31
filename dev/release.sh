#!/usr/bin/env bash
# Выпуск новой версии в GitHub Releases (mor1us/khovoya-vk-player) — оттуда её подхватит автообновление.
set -euo pipefail
V=$(node -p "require('./package.json').version")
npm test >/dev/null
npm run build >/dev/null
rm -rf dist && WINEDEBUG=-all npx electron-builder --win --x64 --publish never >/dev/null
git push -q origin master
git tag -f "v$V" && git push -q -f origin "v$V"
gh release create "v$V" --repo mor1us/khovoya-vk-player --title "Хвоя $V" --notes "${1:-Обновление}" \
  "dist/Khvoya-Setup-$V.exe" "dist/Khvoya-Setup-$V.exe.blockmap" dist/latest.yml "dist/Khvoya-Portable-$V.exe"
echo "released v$V"
