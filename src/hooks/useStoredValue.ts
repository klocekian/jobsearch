import { useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * A value kept in browser storage. Renders `serverValue` on the server and
 * while hydrating, then the stored value — reading storage in a useState
 * initializer makes the first client render disagree with the server's HTML.
 * `read` must return a primitive: it's called and compared on every render.
 */
export function useStoredValue<T extends string | number | boolean | null>(
  read: () => T,
  write: (value: T) => void,
  serverValue: T,
): [T, (value: T) => void] {
  const stored = useSyncExternalStore(noSubscribe, read, () => serverValue);
  const [chosen, setChosen] = useState<{ value: T } | null>(null);
  const set = (value: T) => {
    write(value);
    setChosen({ value });
  };
  return [chosen ? chosen.value : stored, set];
}
