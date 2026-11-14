import { useEffect, useState } from "react";
import { reportStore, type StoredReport } from "@/lib/storage";

export function useReports(): StoredReport[] {
  const [reports, setReports] = useState(() => reportStore.list());
  useEffect(() => {
    const refresh = () => setReports(reportStore.list());
    const unsub = reportStore.subscribe(refresh);
    window.addEventListener("storage", refresh);
    return () => {
      unsub();
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return reports;
}
