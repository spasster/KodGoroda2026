#!/usr/bin/env bash
# Выкатка стенда. На сервере лежит как /usr/local/sbin/kodgoroda-deploy и привязана к ключу
# GitHub Actions через command= в authorized_keys: с этим ключом можно запустить только её.
# Вход: SHA коммита в SSH_ORIGINAL_COMMAND (или первым аргументом), токен GHCR первой строкой stdin.
# Новая версия не ответила на /api/health — возвращается прежняя, код выхода 1.
set -euo pipefail

APP_DIR=/root/kodgoroda
HEALTH=http://127.0.0.1:8090/api/health
STATE="$APP_DIR/.deployed"
# Запуск до CI/CD: образы, загруженные на сервер вручную. Нужен только для отката первой выкатки.
LEGACY="$APP_DIR/compose.stand.yml"

compose() {
  TAG="$1" docker compose -p kodgoroda --project-directory "$APP_DIR" -f "$APP_DIR/deploy/compose.stand.yml" "${@:2}"
}

healthy() {
  for _ in $(seq 1 20); do
    curl -fsS -m 3 "$HEALTH" >/dev/null 2>&1 && return 0
    sleep 3
  done
  return 1
}

up() {
  compose "$1" pull --quiet && compose "$1" up -d --remove-orphans --wait --wait-timeout 90 && healthy
}

main() {
  local tag="${SSH_ORIGINAL_COMMAND:-${1:-}}"
  if [[ ! "$tag" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Нужен SHA коммита из 40 символов" >&2
    exit 2
  fi
  local token=""
  IFS= read -r token || true

  cd "$APP_DIR"
  exec 9>"$APP_DIR/.deploy.lock"
  flock -n 9 || { echo "Выкатка уже идёт" >&2; exit 3; }

  local prev="" prev_commit
  [[ -f "$STATE" ]] && prev="$(cat "$STATE")"
  prev_commit="$(git rev-parse HEAD)"

  if [[ -n "$token" ]]; then
    printf '%s' "$token" | docker login ghcr.io -u github-actions --password-stdin >/dev/null
    trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
  fi

  # Анкета, пороги и данные подключаются томами из репозитория: берём их той же версии, что и код.
  git fetch --quiet --depth 1 origin "$tag"
  git checkout --quiet --detach FETCH_HEAD

  if up "$tag"; then
    echo "$tag" > "$STATE"
    docker image prune -f >/dev/null
    echo "Стенд обновлён до $tag"
    return
  fi

  echo "Версия $tag не поднялась, возвращаю прежнюю" >&2
  git checkout --quiet --detach "$prev_commit"
  if [[ -n "$prev" ]]; then
    up "$prev" || echo "Прежняя версия $prev тоже не отвечает" >&2
  elif [[ -f "$LEGACY" ]]; then
    docker compose -p kodgoroda --project-directory "$APP_DIR" -f "$LEGACY" up -d --remove-orphans
    healthy || echo "Прежний запуск тоже не отвечает" >&2
  fi
  exit 1
}

main "$@"
