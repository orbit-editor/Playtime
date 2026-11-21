#!/bin/sh
# 把 plugins/ 里的内置扩展与 SDK 同步到 Go 的嵌入目录。
# 构建前由 Makefile 调用；生成物一并提交，CI 只装 Go 也能编译。
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
dst="$root/internal/plugins/builtin/assets"

rm -rf "$dst"
mkdir -p "$dst/_sdk"
cp -R "$root/plugins/_sdk/." "$dst/_sdk/"
cp -R "$root/plugins/math-sprint" "$dst/math-sprint"
find "$dst" -name ".DS_Store" -delete
echo "synced builtin assets to $dst"
