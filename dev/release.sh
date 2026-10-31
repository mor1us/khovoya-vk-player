#!/usr/bin/env bash
# Новая версия: поднять version в package.json и запушить master.
# GitHub Actions (.github/workflows/release.yml) сам соберёт установщик под Windows
# и выложит выпуск в mor1us/khovoya-vk-player — приложение подхватит его автообновлением.
set -euo pipefail
npm test >/dev/null
git push origin master
echo "Запушено. Сборка: https://github.com/mor1us/khovoya-vk-player/actions"
