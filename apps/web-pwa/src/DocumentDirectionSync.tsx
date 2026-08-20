import { useEffect } from 'react';
import { syncDocumentDirection } from './lib/textDirection';

export function DocumentDirectionSync() {
  useEffect(() => {
    const root = document.documentElement;
    syncDocumentDirection(root);

    const observer = new MutationObserver(() => syncDocumentDirection(root));
    observer.observe(root, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  }, []);

  return null;
}
