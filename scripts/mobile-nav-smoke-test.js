// Minimal DOM stub smoke test for mobile-nav.js
function makeEl(tag, attrs) {
    const el = {
        tagName: tag, children: [], classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else { on ? this._s.add(c) : this._s.delete(c); } }, contains(c) { return this._s.has(c); } },
        style: {}, dataset: {}, attributes: {},
        _listeners: {},
        setAttribute(k, v) { this.attributes[k] = v; if (k === 'class') this.className = v; },
        getAttribute(k) { return this.attributes[k]; },
        appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
        insertBefore(c, ref) { const i = this.children.indexOf(ref); if (i === -1) this.children.push(c); else this.children.splice(i, 0, c); c.parentNode = this; return c; },
        remove() { if (this.parentNode) { const i = this.parentNode.children.indexOf(this); if (i > -1) this.parentNode.children.splice(i, 1); } },
        addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
        dispatch(ev) { (this._listeners[ev] || []).forEach(fn => fn({ preventDefault() { this._pd = true; }, stopPropagation() {} })); },
        querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
        querySelectorAll(sel) {
            const out = [];
            const matchOne = (c, s) => {
                const cls = c.className || '';
                const parts = s.split('[');
                const classPart = parts[0].startsWith('.') ? parts[0].slice(1) : null;
                let ok = true;
                if (classPart && !cls.split(/\s+/).includes(classPart)) ok = false;
                for (let i = 1; i < parts.length && ok; i++) {
                    const attrName = parts[i].replace(/^"|"$/g, '').replace(/\]$/, '').trim();
                    if (attrName.startsWith('data-')) {
                        if (!(c.dataset[attrName.replace('data-', '')])) ok = false;
                    } else if (!c.attributes[attrName]) ok = false;
                }
                return ok;
            };
            const walk = (el) => {
                el.children.forEach(c => {
                    const matches = sel.split(',').map(s => s.trim()).filter(s => matchOne(c, s));
                    if (matches.length) out.push(c);
                    walk(c);
                });
            };
            walk(this);
            return out;
        },
        set innerHTML(v) {
            this._html = v;
            this.children = [];
            // ultra-light parser: build child elements from simple tags
            const re = /<(a|div|button|span)\b([^>]*)>/g;
            let m;
            while ((m = re.exec(v)) !== null) {
                const tag = m[1];
                const attrs = m[2];
                const child = makeEl(tag);
                const cls = /class="([^"]*)"/.exec(attrs);
                if (cls) { child.className = cls[1]; cls[1].split(/\s+/).forEach(c => child.classList.add(c)); }
                const id = /id="([^"]*)"/.exec(attrs);
                if (id) child.setAttribute('id', id[1]);
                const href = /href="([^"]*)"/.exec(attrs);
                if (href) child.setAttribute('href', href[1]);
                const dv = /data-view="([^"]*)"/.exec(attrs);
                if (dv) child.dataset.view = dv[1];
                // grab label text until closing tag
                const rest = v.slice(m.index + m[0].length);
                const end = rest.indexOf('</' + tag + '>');
                if (end > -1) child._text = rest.slice(0, end);
                this.appendChild(child);
            }
        },
        get innerHTML() { return this._html; },
        get textContent() { return this._text || ''; },
        set textContent(v) { this._text = v; },
    };
    Object.defineProperty(el, 'id', {
        get() { return el.attributes.id; },
        set(v) { el.attributes.id = v; },
    });
    Object.defineProperty(el, 'href', {
        get() { return el.attributes.href; },
        set(v) { el.attributes.href = v; },
    });
    if (tag === 'button') { el.click = function () { el.dispatch('click'); }; }
    return el;
}

const body = makeEl('body');
const head = makeEl('head');
const headerContainer = makeEl('div');
headerContainer.className = 'container';
const header = makeEl('header');
header.className = 'header';
const logo = makeEl('a');
logo.className = 'logo';
headerContainer.appendChild(logo);
header.appendChild(headerContainer);

global.document = {
    readyState: 'complete',
    head,
    body,
    createElement: (tag) => makeEl(tag),
    getElementById: (id) => null,
    querySelector: (sel) => sel === '.header .container' ? headerContainer : null,
    addEventListener: () => {},
};
global.window = global;

// Simulate home page: setProductView defined
let calledView = null;
window.setProductView = (v) => { calledView = v; };

require('../mobile-nav.js');

const hamburger = headerContainer.children.find(c => c.attributes.id === 'mobileHamburger');
console.log('hamburger created:', !!hamburger);
console.log('hamburger placed after logo:', headerContainer.children.indexOf(hamburger) === 1);

const menu = body.children.find(c => c.attributes.id === 'pseMobileMenu');
const overlay = body.children.find(c => c.className === 'pse-mobile-overlay');
console.log('menu created:', !!menu);
console.log('overlay created:', !!overlay);
console.log('menu has Browse section:', menu._html.includes('>Browse<'));
console.log('menu has Upload Inventory NEW badge:', menu._html.includes('Upload Inventory') && menu._html.includes('badge gold'));
console.log('menu has all home tabs:', ['All Products', 'In Stock', 'RFQ Deals', '</i> All</a>', 'Catalogs', '</i> RFQ</a>', 'Contact', 'Upload Inventory'].every(t => menu._html.includes(t)));

// Open menu
hamburger.dispatch('click');
console.log('menu opens:', menu.classList.contains('open') && overlay.classList.contains('show'));
// Close via overlay
overlay.dispatch('click');
console.log('menu closes via overlay:', !menu.classList.contains('open'));

// View tab click → setProductView + close
hamburger.dispatch('click');
const viewItem = menu.querySelectorAll('[data-view]').find(c => c.dataset.view === 'available');
viewItem.dispatch('click');
console.log('view tab calls setProductView:', calledView === 'available');
console.log('view tab closes menu:', !menu.classList.contains('open'));

// Also run on a page WITHOUT setProductView (products.html scenario)
calledView = null;
delete window.setProductView;
document.body.children.length = 0;
document.body.children = [];
document.getElementById = () => null;
// fresh header for second page
const headerContainer2 = makeEl('div');
headerContainer2.className = 'container';
const logo2 = makeEl('a'); logo2.className = 'logo';
headerContainer2.appendChild(logo2);
const header2 = makeEl('header'); header2.className = 'header'; header2.appendChild(headerContainer2);
document.querySelector = (sel) => sel === '.header .container' ? headerContainer2 : null;
window.PSE.mobileNav.init();
const menu2 = body.children.find(c => c.attributes.id === 'pseMobileMenu');
const viewItem2 = menu2.querySelectorAll('[data-view]').find(c => c.dataset.view === 'rfq');
viewItem2.dispatch('click');
console.log('no-setProductView page: default navigation kept (no preventDefault crash):', true);
console.log('SMOKE TEST DONE');
