#!/bin/sh
# Шрифты МГТС (MTS Wide, Compact, Text) берём с сайта чемпионата и кладём локально.
# В git их нет: это закрытые шрифты группы МТС. Без них интерфейс падает на системный шрифт.
set -e
dir="$(dirname "$0")/../src/styles/fonts"
mkdir -p "$dir"
for f in MTSWide-Medium MTSWide-Bold MTSCompact-Regular MTSCompact-Medium MTSCompact-Bold MTSText-Regular MTSText-Medium; do
  [ -s "$dir/$f.woff2" ] || curl -fsSL --max-time 30 -o "$dir/$f.woff2" "https://studchamp.mgts.ru/assets/fonts/$f.woff2"
done
echo "Шрифты МГТС на месте: $dir"
