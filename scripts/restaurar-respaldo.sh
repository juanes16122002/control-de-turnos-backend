#!/usr/bin/env bash
# Restaura un respaldo cifrado generado por .github/workflows/respaldo-db.yml
#
# Uso:
#   bash scripts/restaurar-respaldo.sh <respaldo_AAAA-MM-DD_HHMM.dump.gpg> "<DATABASE_URL destino>"
#
# - Pide la contraseña de cifrado (RESPALDO_CLAVE) y una confirmación escrita.
# - Reemplaza las tablas del esquema public del destino por las del respaldo, en UNA transacción:
#   si algo falla, el destino queda como estaba.
# - Requiere gpg y pg_restore >= 17 (Git Bash en Windows trae gpg).
#
# Automatización / pruebas (opcional):
#   RESPALDO_CLAVE_ARCHIVO=<archivo con la clave>   evita la pregunta de contraseña
#   CONFIRMAR=RESTAURAR                             evita la confirmación interactiva
set -euo pipefail

ARCHIVO="${1:-}"
DESTINO="${2:-}"
if [ -z "$ARCHIVO" ] || [ -z "$DESTINO" ]; then
  sed -n '2,7p' "$0"; exit 1
fi
[ -f "$ARCHIVO" ] || { echo "No existe el archivo: $ARCHIVO"; exit 1; }
for c in gpg pg_restore psql; do command -v "$c" >/dev/null || { echo "Falta '$c' en el PATH"; exit 1; }; done
VERSION=$(pg_restore --version | grep -oE '[0-9]+' | head -1)
[ "$VERSION" -ge 17 ] || { echo "pg_restore $VERSION es muy antiguo: se necesita 17 o superior"; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "1/3 Descifrando $ARCHIVO…"
if [ -n "${RESPALDO_CLAVE_ARCHIVO:-}" ]; then
  gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$RESPALDO_CLAVE_ARCHIVO" \
      --decrypt --output "$TMP/respaldo.dump" "$ARCHIVO"
else
  gpg --quiet --pinentry-mode loopback --decrypt --output "$TMP/respaldo.dump" "$ARCHIVO"
fi

# El esquema public ya existe en el destino: se omite su creación
pg_restore --list "$TMP/respaldo.dump" | grep -v " SCHEMA - public " > "$TMP/lista.txt"
TABLAS=$(grep -c " TABLE public " "$TMP/lista.txt" || true)
HOST=$(printf '%s' "$DESTINO" | sed -E 's#^[a-z]+://([^@]*@)?([^/:?]+).*#\2#')
BASE=$(printf '%s' "$DESTINO" | sed -E 's#^[^/]*//[^/]*/([^?]*).*#\1#')

echo "2/3 El respaldo contiene $TABLAS tablas."
echo "    Destino: base '$BASE' en $HOST"
echo "    ATENCIÓN: se REEMPLAZARÁN las tablas del esquema public del destino."
if [ "${CONFIRMAR:-}" != "RESTAURAR" ]; then
  read -r -p "    Escribe RESTAURAR para continuar: " respuesta
  [ "$respuesta" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }
fi

echo "3/3 Restaurando (una sola transacción)…"
pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error --single-transaction \
  --use-list="$TMP/lista.txt" --dbname="$DESTINO" "$TMP/respaldo.dump"

echo
echo "Restauración completa. Filas por tabla:"
for t in empleados empresas turnos asistencias configuracion; do
  printf '  %-14s %s\n' "$t" "$(psql "$DESTINO" -Atc "SELECT count(*) FROM public.$t" 2>/dev/null || echo '-')"
done
