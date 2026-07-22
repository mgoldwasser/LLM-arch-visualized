/* Hyperscript helpers — build HTML and SVG nodes without a framework.
   el('div', {class:'x', onclick:fn, style:{color:'red'}}, child, 'text')
   svg('rect', {x:0, y:0, fill:'red'})                                     */

const SVG_NS = 'http://www.w3.org/2000/svg';

function assign(node, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') {
      Object.assign(node.style, v);
    } else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'dataset' && typeof v === 'object') {
      Object.assign(node.dataset, v);
    } else if (k === 'html') {
      node.innerHTML = v;
    } else {
      node.setAttribute(k === 'className' ? 'class' : k, v === true ? '' : v);
    }
  }
  return node;
}

function append(node, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function el(tag, attrs, ...children) {
  return append(assign(document.createElement(tag), attrs), children);
}

export function svg(tag, attrs, ...children) {
  return append(assign(document.createElementNS(SVG_NS, tag), attrs), children);
}

export function frag(...children) {
  return append(document.createDocumentFragment(), children);
}

/* Shorthand for an <svg> root with a viewBox. */
export function svgRoot(w, h, attrs, ...children) {
  return svg('svg', { viewBox: `0 0 ${w} ${h}`, ...attrs }, ...children);
}

/* Clear a node's children. */
export function empty(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}
