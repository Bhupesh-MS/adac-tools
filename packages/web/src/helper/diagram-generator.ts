import { generateDiagramSvg } from '@mindfiredigital/adac-core';
// import { makeFetchIconResolver } from '@mindfiredigital/adac-core/icon-resolver-browser';
// const iconResolver = makeFetchIconResolver('/assets');
export async function generateDiagramBrowser(
  yaml: string,
  layout?: 'elk' | 'custom'
) {
  return generateDiagramSvg(yaml, layout, false, undefined, 'monthly', false);
}
