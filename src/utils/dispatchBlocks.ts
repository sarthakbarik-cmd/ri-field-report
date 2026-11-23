import { marked } from 'marked';

export type LetterBlock =
  | { kind: 'heading' | 'paragraph' | 'field'; text: string; }
  | { kind: 'list'; items: string[]; ordered: boolean; }
  | { kind: 'table'; headings: string[]; rows: string[][]; witness: boolean; land: boolean; };

const blank = /^(?:\\?_){3,}$/u;
const witnessLabel = /(?:ସାକ୍ଷୀ|ସ୍ୱାକ୍ଷର|ଟିପଚିହ୍ନ|witness|signature|thumbprint)/iu;
const witnessHeading = /(?:କ୍ଷେତ୍ର ଯାଞ୍ଚ.*ସାକ୍ଷୀ|field verification.*witness)/iu;
const opinionHeading = /(?:^|\s)(?:ମତାମତ|opinion|remarks)(?:$|\s)/iu;

export function dispatchBlocks(body: string): LetterBlock[] {
  const blocks: LetterBlock[] = [];
  for (const token of marked.lexer(body.replace(/\\_/gu, '_'), { gfm: true })) {
    switch (token.type) {
      case 'space':
      case 'hr':
        break;
      case 'heading':
        blocks.push({ kind: 'heading', text: token.text });
        break;
      case 'list':
        blocks.push({ kind: 'list', items: token.items.map(item => item.text), ordered: token.ordered });
        break;
      case 'table': {
        const headings: string[] = token.header.map(cell => cell.text);
        const rows: string[][] = token.rows.map(row => row.map(cell => blank.test(cell.text.trim()) ? '' : cell.text));
        const land = headings.length === 3 && /^(?:ସାବିକ|sabik)$/iu.test(headings[1]) && /^(?:ହାଲ|hal)$/iu.test(headings[2]) &&
          rows.length === 4 && rows.every((row, index) => [/ଖାତା|khata/iu, /ପ୍ଲଟ|plot/iu, /ପରିମାଣ|ରକବା|area/iu, /କିସମ|kisam/iu][index].test(row[0]));
        blocks.push({ kind: 'table', headings, rows, witness: headings.some(label => witnessLabel.test(label)), land });
        break;
      }
      default:
        for (const line of token.raw.trim().split(/\n(?=[^\n]*[:：]\s*_{3,}\s*$)/mu)) {
          const value = line.trim();
          const field = value.match(/^([^\n]+?[:：])\s*_{3,}$/u);
          const boldHeading = value.match(/^\*\*([^\n*]+)\*\*$/u);
          if (field) blocks.push({ kind: 'field', text: field[1] });
          else if (boldHeading) blocks.push({ kind: 'heading', text: boldHeading[1] });
          else if (value) blocks.push({ kind: 'paragraph', text: value });
        }
    }
  }
  const opinion = blocks.findIndex(block => block.kind === 'heading' && opinionHeading.test(block.text));
  const witness = blocks.findIndex(block => block.kind === 'heading' && witnessHeading.test(block.text));
  if (opinion >= 0 && witness > opinion) {
    // Paste often puts the witness sheet after the opinion. Keep it in the same letter.
    blocks.push(...blocks.splice(opinion, witness - opinion));
  }
  return blocks;
}

export function dispatchTable(block: Extract<LetterBlock, { kind: 'table' }>) {
  if (!block.land) return { headings: block.headings, rows: block.rows };
  const captions = block.rows.map(row => row[0]);
  return {
    groups: block.headings.slice(1),
    headings: [...captions, ...captions],
    rows: [[...block.rows.map(row => row[1]), ...block.rows.map(row => row[2])]],
  };
}
