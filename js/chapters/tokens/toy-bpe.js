/* A miniature byte-pair vocabulary, shared by the representation-ladder scene
   and the spelling widget.

   A production tokenizer holds ~160k merges learned from a corpus. This holds
   a few dozen frequent English pieces, applied by exactly the rule a real one
   uses at inference: scan left to right, take the longest vocabulary entry
   that matches here, and fall back to a single symbol when nothing does.
   It is a miniature, and every figure that uses it says so — but it means no
   token count anywhere in this chapter is transcribed. They are all measured. */

import { rng } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

/* The sentence the ladder climbs. Its first character is “t” on purpose:
   byte 116 is the beat the bytes rung is built around. */
export const SENTENCE = 'tokens are not letters — they are spans';

/* Frequent whole words and word-starts. A real merge list contains these
   because the corpus contains them often, not because anyone chose them. */
const WORDS = [
  'a', 'I', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is',
  'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'we',
  'all', 'and', 'are', 'but', 'can', 'for', 'has', 'how', 'its', 'may', 'not',
  'one', 'out', 'see', 'the', 'two', 'was', 'who', 'you',
  'been', 'each', 'from', 'have', 'into', 'many', 'more', 'read', 'same',
  'that', 'them', 'then', 'they', 'this', 'were', 'what', 'when', 'with',
  'byte', 'bytes', 'bit', 'bits', 'count', 'char', 'model', 'print', 'span',
  'spans', 'spell', 'text', 'third', 'token', 'tokens', 'word', 'words',
  'letter', 'letters', 'number', 'numbers', 'three', 'every', 'character',
  // pieces that make the classic examples segment the way real tokenizers do
  'str', 'aw', 'berry', 'asp', 'un', 'believ', 'ability', 'cherry', 'blue',
];

/* Frequent continuations — the endings a merge list accumulates early. */
const SUFFIX = [
  'ing', 'ion', 'tion', 'ity', 'able', 'ment', 'ness', 'ous', 'ful', 'ers',
  'ed', 'er', 'es', 'ly', 'al', 'ic', 'en', 're', 'le', 'st', 'th', 'ch',
  'sh', 'ss', 'pp', 'll', 'tt', 'ee', 'oo', 's', 'y',
];

const PUNCT = ['.', ',', '!', '?', ';', ':', '—', '–', '-', '’', "'", '"', '(', ')'];

/* One flat vocabulary, longest entries first, so the first match found is the
   longest match. Word pieces also get a leading-space form: GPT-style
   tokenizers attach the space to the word that follows it. */
export const VOCAB = [...new Set([
  ...WORDS, ...WORDS.map((w) => ' ' + w),
  ...SUFFIX,
  ...PUNCT, ...PUNCT.map((p) => ' ' + p),
  ' ',
])].sort((a, b) => b.length - a.length);

/* Greedy longest-match segmentation. Returns the pieces, in order; their
   concatenation is exactly the input, so a caller can align them against the
   characters they swallowed. */
export function toyTokenize(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const hit = VOCAB.find((v) => text.startsWith(v, i));
    const piece = hit || String.fromCodePoint(text.codePointAt(i));
    out.push(piece);
    i += piece.length;
  }
  return out;
}

/* An illustrative vocabulary index for a piece: deterministic, seeded, and
   arbitrary — which is the honest depiction. A real ID is the position the
   merge happened to land in, and carries no meaning either. */
export function tokenId(piece) {
  let h = 2166136261;
  for (let i = 0; i < piece.length; i++) h = Math.imul(h ^ piece.charCodeAt(i), 16777619) >>> 0;
  return Math.floor(rng(h)() * K3.vocab);
}

/* UTF-8 bytes of a string, as a plain array. */
const encoder = new TextEncoder();
export const utf8 = (text) => Array.from(encoder.encode(text));
