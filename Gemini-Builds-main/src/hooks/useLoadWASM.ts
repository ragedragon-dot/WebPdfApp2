import { useState, useEffect } from 'react';

interface UseLoadWASMOptions {
  src: string;
  scriptId: string;
  checkReady: () => boolean;
}

export function useLoadWASM({ src, scriptId, checkReady }: UseLoadWASMOptions) {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let intervalId: any = null;
    let timeoutId: any = null;

    const checkReadyLoop = () => {
      if (checkReady()) {
        if (active) {
          setLoaded(true);
          setError(null);
        }
        if (intervalId) clearInterval(intervalId);
        if (timeoutId) clearTimeout(timeoutId);
        return true;
      }
      return false;
    };

    // 1. Check if already loaded/ready before doing anything
    if (checkReadyLoop()) {
      return;
    }

    // 2. See if script already exists in the DOM to avoid duplication
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = src;
      script.async = true;
      script.type = 'text/javascript';
      document.body.appendChild(script);
    }

    // Polling interval to check for global object existence/initialization
    // as WASM parsing can take time even after the browser's script onload triggers
    intervalId = setInterval(() => {
      checkReadyLoop();
    }, 150);

    const handleLoad = () => {
      checkReadyLoop();
    };

    const handleError = (e: any) => {
      console.error(`Dynamic WASM script loader error: ${scriptId}`, e);
      if (active) {
        setError(`The heavy processor script could not be downloaded from the CDN. Please check your network connection.`);
      }
      if (intervalId) clearInterval(intervalId);
    };

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    // Timeout limit (25 seconds) to prevent infinite freeze in poor networks
    timeoutId = setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
      if (!checkReady()) {
        if (active) {
          setError('The machine learning engine took too long to initialize. Please reload and try again.');
        }
      }
    }, 25000);

    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      if (script) {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      }
    };
  }, [src, scriptId, checkReady]);

  return { loaded, error };
}
