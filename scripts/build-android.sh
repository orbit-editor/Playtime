#!/bin/sh
# 构建 Playtime 的 Android 调试包。
#
# 步骤：同步内置扩展与前端 -> gomobile bind 生成 AAR -> Gradle assembleDebug。
# 可重复执行；环境变量 ANDROID_HOME、JAVA_HOME 可覆盖默认位置。
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

# Go 与 gomobile 通常装在用户目录，不在默认 PATH 里。
export PATH="${HOME}/.local/go/bin:${HOME}/go/bin:${PATH}"

if [ -z "${ANDROID_HOME:-}" ]; then
  export ANDROID_HOME="${HOME}/Library/Android/sdk"
fi
if [ -z "${ANDROID_NDK_HOME:-}" ]; then
  # 取最新一个完整安装的 NDK（跳过只剩目录壳的版本）。
  for candidate in "$ANDROID_HOME"/ndk/*; do
    if [ -d "$candidate/toolchains/llvm/prebuilt" ]; then
      ANDROID_NDK_HOME=$candidate
    fi
  done
  export ANDROID_NDK_HOME
fi
if [ -z "${JAVA_HOME:-}" ]; then
  # Homebrew 的 JDK 不会注册到 /usr/libexec/java_home，先从 java 自身读。
  if [ -x /usr/libexec/java_home ]; then
    JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || true)
  fi
  if [ -z "${JAVA_HOME:-}" ] && command -v java >/dev/null 2>&1; then
    JAVA_HOME=$(java -XshowSettings:properties -version 2>&1 | awk -F' = ' '/java.home =/ {print $2; exit}')
  fi
  if [ -n "${JAVA_HOME:-}" ]; then
    export JAVA_HOME
  else
    echo "找不到 Java 17，请设置 JAVA_HOME" >&2
    exit 1
  fi
fi

command -v go >/dev/null 2>&1 || {
  echo "找不到 go，请先安装 Go 并加入 PATH" >&2
  exit 1
}
command -v gomobile >/dev/null 2>&1 || {
  echo "找不到 gomobile，请先执行：" >&2
  echo "  go install golang.org/x/mobile/cmd/gomobile@latest && gomobile init" >&2
  exit 1
}

echo "==> 同步内置扩展与 SDK"
# 用 sh 调用，避免脚本没有可执行位时失败。
sh "$root/scripts/sync-builtin.sh"

echo "==> 准备前端产物"
if [ ! -f "$root/web/dist/index.html" ]; then
  (cd "$root/web" && npm run build)
fi
# 清掉上一次的 hash 资源，避免旧文件一直堆在嵌入目录里（.keep 是仓库占位文件）。
find "$root/internal/webui/dist" -mindepth 1 -maxdepth 1 ! -name .keep -exec rm -rf {} +
cp -R "$root/web/dist/." "$root/internal/webui/dist/"

echo "==> gomobile bind"
mkdir -p "$root/android/app/libs"
(cd "$root" && gomobile bind -target=android -androidapi 24 -o "$root/android/app/libs/playtime.aar" ./mobile)

echo "==> 写入 local.properties"
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$root/android/local.properties"

echo "==> Gradle assembleDebug"
# 先 clean：AGP 增量打包在 Go 原生库变化时会留下几十 MB 的旧数据，清掉更稳妥。
cd "$root/android"
./gradlew --console=plain clean assembleDebug

apk="$root/android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$apk" ]; then
  echo "构建结束但没有找到 $apk" >&2
  exit 1
fi
echo
echo "APK: $apk"
du -h "$apk" | awk '{print "大小: " $1}'
