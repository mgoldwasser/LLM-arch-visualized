/* DOM snapshotting — the primitive every universal invariant is built on.

   A snapshot is a plain array of strings, one per element in document order
   (root first, then root.querySelectorAll('*')). Each line records the tag,
   every attribute, and — for elements with no element children — the text.

   We record EVERY attribute rather than a fixed list, because the brief is to
   discover which attributes a figure animates rather than to assume. The
   "animated attribute set" is then derived by diffing snapshots taken at
   different progress values (see animatedKeys()).

   Two normalizations, both deliberate:

   • Absent `opacity` is recorded as `opacity=1`. SVG's default is 1, so a
     figure that ships an element with no opacity attribute and then sets
     opacity="1" at p=0 has not actually changed anything the reader can see,
     and endpoint-stability should not report it.
   • Attributes are sorted by name, so attribute insertion order — which is not
     observable to the reader — never counts as a difference.

   Nothing else is normalized. In particular the inline `style` attribute is
   compared verbatim, because several figures animate through
   `node.style.transform` / `node.style.opacity` rather than SVG attributes.  */

const FS = '\u001f';   // field separator: tag ¦ attrs ¦ text
const AS = '\u001e';   // attribute separator

export function nodeList(root) {
  return [root, ...root.querySelectorAll('*')];
}

const OPACITY_RE = /(^|;)\s*opacity\s*:/;

function line(node) {
  const parts = [];
  let sawOpacity = false;
  let styleVal = null;
  /* Cross-references are resolved once, after every chapter has mounted
     (numbering.js/resolveFigRefs), which rewrites "Fig. __" into "Fig. 9.5"
     long after a figure was built. That is a content operation, not an
     animation, and test/content.js checks it directly — so it must not read
     as a difference to the sweep invariants. */
  const isXref = node.classList && node.classList.contains('xref');
  for (const a of node.attributes) {
    if (isXref && (a.name === 'data-figref' || a.name === 'data-figprefix')) continue;
    if (a.name === 'opacity') sawOpacity = true;
    if (a.name === 'style') styleVal = a.value;
    parts.push(`${a.name}=${a.value}`);
  }
  if (!sawOpacity && !(styleVal && OPACITY_RE.test(styleVal))) parts.push('opacity=1');
  parts.sort();
  const text = isXref ? '<xref>' : (node.firstElementChild ? '' : node.textContent);
  return `${node.tagName}${FS}${parts.join(AS)}${FS}${text}`;
}

export function snapshot(root) {
  return nodeList(root).map(line);
}

/* Human-readable path to the nth node of a snapshot, for failure messages. */
export function pathAt(root, i) {
  const nodes = nodeList(root);
  const node = nodes[i];
  if (!node) return `node #${i} (missing — node count changed)`;
  const bits = [];
  for (let n = node; n; n = n.parentElement) {
    let s = n.tagName.toLowerCase();
    if (n.id) s += `#${n.id}`;
    else {
      const cls = n.getAttribute && n.getAttribute('class');
      if (cls) s += `.${cls.trim().split(/\s+/)[0]}`;
    }
    bits.unshift(s);
    if (n === root) break;
  }
  return `${bits.join(' > ')} (node #${i})`;
}

const fields = (l) => l.split(FS);

function kv(s) {
  const m = new Map();
  if (!s) return m;
  for (const pair of s.split(AS)) {
    const i = pair.indexOf('=');
    m.set(pair.slice(0, i), pair.slice(i + 1));
  }
  return m;
}

const show = (v) => (v === undefined ? '<absent>'
  : JSON.stringify(v.length > 90 ? v.slice(0, 90) + '…' : v));

/* First difference between two snapshots, or null. Returns a short, specific
   string — the point is that a failure names the element and the attribute,
   not just "snapshots differ". */
export function diff(a, b, root, labelA = 'A', labelB = 'B') {
  if (a.length !== b.length) {
    return `node count changed: ${a.length} (${labelA}) vs ${b.length} (${labelB})`
      + ' — the figure created or destroyed nodes instead of animating them';
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const fa = fields(a[i]);
    const fb = fields(b[i]);
    const mapA = kv(fa[1]);
    const mapB = kv(fb[1]);
    for (const k of new Set([...mapA.keys(), ...mapB.keys()])) {
      if (mapA.get(k) !== mapB.get(k)) {
        return `${pathAt(root, i)} @${k}: ${labelA}=${show(mapA.get(k))} ${labelB}=${show(mapB.get(k))}`;
      }
    }
    if (fa[2] !== fb[2]) {
      return `${pathAt(root, i)} text: ${labelA}=${show(fa[2])} ${labelB}=${show(fb[2])}`;
    }
    return `${pathAt(root, i)} differs`;
  }
  return null;
}

/* Which attributes actually move across a set of snapshots. Used to report
   what a figure animates, and to prove it animates at all — a scroll-driven
   figure whose DOM never changes is a bug of its own. */
export function animatedKeys(snaps) {
  const changed = new Set();
  const first = snaps[0];
  if (!first) return [];
  for (const s of snaps) {
    if (s.length !== first.length) { changed.add('<node count>'); continue; }
    for (let i = 0; i < s.length; i++) {
      if (s[i] === first[i]) continue;
      const fa = fields(first[i]);
      const fb = fields(s[i]);
      const a = kv(fa[1]);
      const b = kv(fb[1]);
      for (const k of new Set([...a.keys(), ...b.keys()])) {
        if (a.get(k) !== b.get(k)) changed.add(k);
      }
      if (fa[2] !== fb[2]) changed.add('#text');
    }
  }
  return [...changed].sort();
}

/* Serialize a whole subtree for cross-render comparison (determinism).
   outerHTML is not enough on its own: it does not include properties set
   imperatively, but every figure in this codebase animates via attributes and
   inline style, both of which outerHTML captures. */
export const serialize = (node) => snapshot(node).join('\n');

/* Cheap, stable digest so an external driver can compare two fresh page
   loads without shipping megabytes of HTML back over CDP. */
export function digest(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
