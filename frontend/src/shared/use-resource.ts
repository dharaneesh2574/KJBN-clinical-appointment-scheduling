import { useEffect, useState } from "react";

type Result<T> =
  | { readonly key: string; readonly data: T }
  | { readonly key: string; readonly error: Error };
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  key: string,
) {
  const [result, setResult] = useState<Result<T> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error:
              error instanceof Error
                ? error
                : new Error("The request failed. Please try again."),
          });
      });
    return () => controller.abort();
  }, [load, key]);
  if (result?.key !== key)
    return { loading: true, data: undefined, error: undefined };
  return "data" in result
    ? { loading: false, data: result.data, error: undefined }
    : { loading: false, data: undefined, error: result.error };
}
