import { useSyncExternalStore } from "react";

// Estado compartilhado: painéis abertos (ex.: detalhes da partida) escondem a
// navegação inferior, que volta quando o painel fecha.
let hidden = false;
const listeners = new Set<() => void>();

export function setNavHidden(next: boolean) {
  if (hidden === next) return;
  hidden = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return hidden;
}

function getServerSnapshot() {
  return false;
}

export function useNavHidden() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
