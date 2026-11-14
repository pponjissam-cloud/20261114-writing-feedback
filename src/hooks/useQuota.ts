import { useCallback, useEffect, useState } from "react";
import { quota, type ModelQuotaStatus } from "@/lib/quota";

/** 모델별 남은 횟수와 최소 간격 카운트다운 (1초마다 갱신, 다른 탭 사용량도 반영) */
export function useQuota(keyHash: string) {
  const read = useCallback(() => quota.allStatuses(keyHash), [keyHash]);
  const [statuses, setStatuses] = useState<ModelQuotaStatus[]>(read);

  useEffect(() => {
    const refresh = () => setStatuses(read());
    refresh();
    const unsub = quota.subscribe(refresh);
    const timer = setInterval(refresh, 1000);
    window.addEventListener("storage", refresh);
    return () => {
      unsub();
      clearInterval(timer);
      window.removeEventListener("storage", refresh);
    };
  }, [read]);

  return statuses;
}
