#!/bin/sh
set -eu

if [ "$#" -eq 0 ]; then
  echo '用法：在项目根目录执行 sh scripts/build-with-docs.sh <服务构建命令> [参数...]' >&2
  exit 2
fi

mdsite build . -o "${MDSITE_OUTPUT:-public/docs/index.html}"
exec "$@"
