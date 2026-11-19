import type { ArticleBlock } from './notion';

export function cleanArticleBlocks(blocks: ArticleBlock[]): ArticleBlock[] {
 return blocks.flatMap(block => {
  const text = block.text
   .replace(/(?:^|\s+)Read the (?:full|complete) (?:analysis|signal) at (?:https?:\/\/)?navvyasignal\.com\/?\.?\s*$/i, '')
   .trim();
  if (!text || /^NavvyaSignal Editorial\.?$/i.test(text)) return [];
  return [{ kind: block.kind, text }];
 }).filter((block, index, cleaned) =>
  index === 0 || block.kind !== cleaned[index - 1].kind || block.text !== cleaned[index - 1].text);
}

export function articleBody(brief: string, full: ArticleBlock[]) {
 const longRead = cleanArticleBlocks(full);
 if (longRead.some(block => block.kind === 'paragraph' || block.kind === 'quote' || block.kind === 'callout')) {
  return { label: 'Long read', blocks: longRead };
 }
 return {
  label: 'Signal brief',
  blocks: cleanArticleBlocks(brief.replace(/\\n/g, '\n').split(/<br\s*\/?\s*>|\n\s*\n/gi)
   .map(text => ({ kind: 'paragraph', text }))),
 };
}
