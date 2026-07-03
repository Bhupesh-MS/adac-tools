export function makeFetchIconResolver(baseUrl = '/assets') {
  const cache = new Map<string, string>();
  return async function (relativePath: string): Promise<string | null> {
    if (cache.has(relativePath)) return cache.get(relativePath)!;
    const resp = await fetch(`${baseUrl}/${relativePath}`);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        cache.set(relativePath, reader.result as string);
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  };
}
