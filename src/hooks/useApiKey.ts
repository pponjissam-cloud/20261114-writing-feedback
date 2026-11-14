import { useEffect, useState, useSyncExternalStore } from "react";
import { apiKeyStore, hashKey } from "@/lib/apiKey";
import { ANON_KEY_HASH } from "@/lib/quota";

export function useApiKey() {
  const key = useSyncExternalStore(apiKeyStore.subscribe, apiKeyStore.get);
  const mode = useSyncExternalStore(apiKeyStore.subscribe, apiKeyStore.mode);
  const [keyHash, setKeyHash] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!key) {
      setKeyHash(ANON_KEY_HASH);
      return;
    }
    setKeyHash(null);
    hashKey(key).then((h) => alive && setKeyHash(h));
    return () => {
      alive = false;
    };
  }, [key]);

  return { apiKey: key, mode, keyHash: keyHash ?? ANON_KEY_HASH, hashReady: keyHash !== null };
}
