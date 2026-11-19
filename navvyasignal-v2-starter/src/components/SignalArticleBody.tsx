import type { ArticleBlock } from '@/lib/notion';

export default function SignalArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
 const groups: ArticleBlock[][] = [];
 for (const block of blocks) {
  const previous = groups[groups.length - 1];
  const listItem = block.kind === 'bulleted_list_item' || block.kind === 'numbered_list_item';
  if (listItem && previous?.[0].kind === block.kind) {
   previous.push(block);
  } else {
   groups.push([block]);
  }
 }
 return groups.map(([block, ...rest], index) => {
  switch (block.kind) {
   case 'heading_1':
   case 'heading_2':
    return <h2 key={index}>{block.text}</h2>;
   case 'heading_3':
    return <h3 key={index}>{block.text}</h3>;
   case 'quote':
    return <blockquote key={index}>{block.text}</blockquote>;
   case 'numbered_list_item':
   case 'bulleted_list_item': {
    const List = block.kind === 'numbered_list_item' ? 'ol' : 'ul';
    return <List key={index}>{[block, ...rest].map((item, i) => <li key={i}>{item.text}</li>)}</List>;
   }
   default:
    return <p key={index}>{block.text}</p>;
  }
 });
}
