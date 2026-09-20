import { useCallback, useEffect, useState } from "react";
import { getInitialArchive, loadArchive } from "../data";

export type ArchiveStatus = "loading" | "ready" | "error";

/** Keep the curated preview usable while the complete archive loads. */
export function useArchive() {
  const [archive, setArchive] = useState(getInitialArchive);
  const [status, setStatus] = useState<ArchiveStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    loadArchive(undefined, controller.signal).then((full) => {
      if (!controller.signal.aborted) {
        setArchive(full);
        setStatus("ready");
      }
    }).catch(() => {
      if (!controller.signal.aborted) setStatus("error");
    });
    return () => controller.abort();
  }, [attempt]);

  return { archive, status, retry };
}
