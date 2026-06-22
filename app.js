'use strict';

/* ── CONFIG ──────────────────────────────────── */
const API_BASE = 'api.php';

/* ── PLACEHOLDER IMAGE ───────────────────────── */
const PLACEHOLDER_IMG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Crect width='600' height='600' fill='%23f0ebe3'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Georgia%2Cserif' font-size='18' fill='%23b09060'%3ENo Image%3C%2Ftext%3E%3C%2Fsvg%3E`;

function productImg(p) {
  return (p.image_url && p.image_url.trim()) ? p.image_url : PLACEHOLDER_IMG;
}

/* ── RUNTIME PRODUCT STORE ───────────────────── */
// Populated on DOMContentLoaded by loadProducts().
// Nothing here is hardcoded — all data including images comes from the DB.
let PRODUCTS = [];

/* ── PERSISTENCE ─────────────────────────────── */
function safeParseJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
const saveCart = () => localStorage.setItem('euphoria_cart', JSON.stringify(cart));
const saveWish = () => localStorage.setItem('euphoria_wish', JSON.stringify(wishlist));
const saveUser = () => localStorage.setItem('euphoria_user', JSON.stringify(user));

function sanitiseCart(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  for (const item of raw) {
    const id = parseInt(item.id, 10);
    if (!id || id < 1) continue;
    const qty = parseInt(item.qty, 10);
    result.push({
      id       : id,
      title    : String(item.title    || ''),
      price    : Number(item.price)   || 0,
      image_url: String(item.image_url || ''),
      category : String(item.category || ''),
      qty      : (qty > 0) ? qty : 1,
    });
  }
  return result;
}

function sanitiseWishlist(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  const seen   = new Set();
  for (const item of raw) {
    const id = parseInt(item.id, 10);
    if (!id || id < 1 || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id       : id,
      title    : String(item.title    || ''),
      price    : Number(item.price)   || 0,
      image_url: String(item.image_url || ''),
      category : String(item.category || ''),
    });
  }
  return result;
}

/* ── STATE ───────────────────────────────────── */
let cart     = sanitiseCart(safeParseJSON('euphoria_cart'));
let wishlist = sanitiseWishlist(safeParseJSON('euphoria_wish'));
let user     = safeParseJSON('euphoria_user') || null;

saveCart();
saveWish();

let activeCategory   = 'All';
let filteredProducts = [];

/* ── UTILS ───────────────────────────────────── */
function fmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function genStars(r) {
  let s = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(r)) s += '★';
    else if (i === Math.ceil(r) && r % 1 >= .5) s += '✦';
    else s += '☆';
  }
  return s;
}

/* ── TOAST ───────────────────────────────────── */
function showToast(msg, type = 'success', icon = '✦') {
  const tc = document.getElementById('toastContainer');
  if (!tc) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  tc.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

/* ── CART COUNT ──────────────────────────────── */
function updateCartCount() {
  const n = cart.reduce((s, i) => s + (parseInt(i.qty, 10) || 0), 0);
  document.querySelectorAll('#cartCount').forEach(el => el.textContent = n);
}

/* ── USER LABEL ──────────────────────────────── */
function updateUserLabel() {
  document.querySelectorAll('#userLabel').forEach(el => {
    el.textContent = user ? user.name.split(' ')[0] : 'Login';
  });
}

/* =============================================
   LOAD PRODUCTS FROM DATABASE
   =============================================
   Single source of truth: api.php?action=products
   Fetches all active products including image_url.
   To add/edit/remove a product or change its image,
   update the `products` table — no JS change needed.
   ============================================= */
async function loadProducts() {
  const grid = document.getElementById('productsGrid');

  // Skeleton loader while fetching
  if (grid) {
    grid.innerHTML = Array(6).fill(`
      <article class="product-card" style="pointer-events:none">
        <div class="product-img-wrap" style="background:#f0ebe3;height:280px;border-radius:8px;animation:pulse 1.4s ease-in-out infinite"></div>
        <div class="product-info" style="padding:1rem 0">
          <div style="height:12px;background:#e8e0d5;border-radius:4px;width:40%;margin-bottom:.6rem;animation:pulse 1.4s ease-in-out infinite"></div>
          <div style="height:16px;background:#e8e0d5;border-radius:4px;width:80%;margin-bottom:.6rem;animation:pulse 1.4s ease-in-out infinite"></div>
          <div style="height:12px;background:#e8e0d5;border-radius:4px;width:55%;animation:pulse 1.4s ease-in-out infinite"></div>
        </div>
      </article>`).join('');
  }

  try {
    const res  = await fetch(`${API_BASE}?action=products`);
    const data = await res.json();

    if (!data.success || !Array.isArray(data.products) || !data.products.length) {
      if (grid) grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:4rem 2rem">
          <div class="empty-icon">💎</div>
          <p>No products found. Please add products to the database.</p>
        </div>`;
      return;
    }

    // Populate runtime store from DB rows
    PRODUCTS = data.products.map(p => ({
      id      : parseInt(p.id, 10),
      title   : String(p.title       || ''),
      category: String(p.category    || ''),
      price   : Number(p.price)      || 0,
      desc    : String(p.description || ''),
      image_url: String(p.image_url  || ''),
      badge   : p.badge              || null,
      rating  : Number(p.rating)     || 0,
      reviews : parseInt(p.review_count, 10) || 0,
    }));

    // Refresh stored cart/wishlist with latest DB prices & images
    for (const item of cart) {
      const p = PRODUCTS.find(p => p.id === item.id);
      if (p) { item.image_url = p.image_url; item.title = p.title; item.price = p.price; }
    }
    for (const item of wishlist) {
      const p = PRODUCTS.find(p => p.id === item.id);
      if (p) { item.image_url = p.image_url; item.title = p.title; item.price = p.price; }
    }
    saveCart();
    saveWish();

    // Build category pills dynamically from what's actually in the DB
    buildCategoryPills();

    filteredProducts = [...PRODUCTS];
    filterProducts();

  } catch (err) {
    console.error('Failed to load products:', err);
    if (grid) grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding:4rem 2rem">
        <div class="empty-icon">⚠️</div>
        <p>Could not connect to the server. Please try again later.</p>
      </div>`;
  }
}

/* ── BUILD CATEGORY PILLS FROM DB DATA ───────── */
function buildCategoryPills() {
  const container = document.getElementById('categoryPills');
  if (!container) return;

  const categories = ['All', ...new Set(PRODUCTS.map(p => p.category).filter(Boolean))];

  container.innerHTML = categories.map(cat => `
    <button class="cat-pill${cat === activeCategory ? ' active' : ''}"
      onclick="setCategoryFilter('${escHtml(cat)}')">
      ${cat === 'All' ? 'All Pieces' : escHtml(cat)}
    </button>`).join('');
}

/* =============================================
   PRODUCTS (index page)
   ============================================= */
function filterProducts() {
  const query = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const sort  = document.getElementById('sortSelect')?.value || 'default';

  filteredProducts = PRODUCTS.filter(p => {
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    const matchQ   = !query || p.title.toLowerCase().includes(query) || p.category.toLowerCase().includes(query);
    return matchCat && matchQ;
  });

  if (sort === 'price-asc')  filteredProducts.sort((a,b) => a.price - b.price);
  if (sort === 'price-desc') filteredProducts.sort((a,b) => b.price - a.price);
  if (sort === 'name-asc')   filteredProducts.sort((a,b) => a.title.localeCompare(b.title));

  renderProducts();
}

function setCategoryFilter(cat) {
  activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(pill => {
    const label = pill.textContent.trim().replace('All Pieces', 'All');
    pill.classList.toggle('active', label === cat || (cat === 'All' && pill.textContent.trim() === 'All Pieces'));
  });
  filterProducts();
}

function renderProducts() {
  const grid  = document.getElementById('productsGrid');
  const count = document.getElementById('productCount');
  if (!grid) return;

  if (count) count.textContent = `${filteredProducts.length} piece${filteredProducts.length !== 1 ? 's' : ''}`;

  if (!filteredProducts.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:4rem 2rem">
      <div class="empty-icon">🔍</div>
      <p>No pieces match. Try a different filter.</p></div>`;
    return;
  }

  grid.innerHTML = filteredProducts.map(p => {
    const wished = wishlist.some(w => w.id === p.id);
    const img    = productImg(p);
    return `
    <article class="product-card" data-id="${p.id}">
      <div class="product-img-wrap">
        <img class="product-img" src="${escHtml(img)}" alt="${escHtml(p.title)}" loading="lazy">
        <div class="product-overlay">
          <button class="overlay-btn" onclick="openDetail(${p.id})">Quick View</button>
          <button class="overlay-btn" onclick="addToCart(${p.id})">Add to Cart</button>
        </div>
        ${p.badge ? `<span class="badge-tag">${escHtml(p.badge)}</span>` : ''}
      </div>
      <div class="product-info">
        <span class="product-category">${escHtml(p.category)}</span>
        <h3 class="product-title">${escHtml(p.title)}</h3>
        <div class="product-rating">
          <span class="stars">${genStars(p.rating)}</span>
          <span>${p.rating} (${p.reviews})</span>
        </div>
        <span class="product-price">${fmt(p.price)}</span>
      </div>
      <div class="card-actions">
        <button class="add-cart-btn" onclick="addToCart(${p.id})">Add to Cart</button>
        <button class="wish-btn${wished ? ' wished' : ''}" onclick="toggleWishlist(${p.id})"
          title="${wished ? 'Remove from wishlist' : 'Save to wishlist'}">${wished ? '❤️' : '♡'}</button>
      </div>
    </article>`;
  }).join('');
}

/* =============================================
   CART OPERATIONS
   ============================================= */
function addToCart(id, qty = 1) {
  const pid = parseInt(id, 10);
  const p   = PRODUCTS.find(p => p.id === pid);
  if (!p) return;
  const addQty   = Math.max(1, parseInt(qty, 10) || 1);
  const existing = cart.find(c => c.id === pid);
  if (existing) {
    existing.qty = Math.max(1, (parseInt(existing.qty, 10) || 0) + addQty);
  } else {
    cart.push({
      id       : p.id,
      title    : p.title,
      price    : p.price,
      image_url: p.image_url || '',
      category : p.category,
      qty      : addQty,
    });
  }
  saveCart();
  updateCartCount();
  showToast(`${p.title} added to cart`, 'success', '🛒');
  if (document.getElementById('cartItemsContainer')) {
    renderCart();
    updateSummary();
  }
}

function removeFromCart(id) {
  const pid = parseInt(id, 10);
  cart = cart.filter(c => c.id !== pid);
  saveCart();
  updateCartCount();
  renderCart();
  updateSummary();
}

function updateQty(id, delta) {
  const pid  = parseInt(id, 10);
  const item = cart.find(c => c.id === pid);
  if (!item) return;
  item.qty = Math.max(1, (parseInt(item.qty, 10) || 1) + parseInt(delta, 10));
  saveCart();
  renderCart();
  updateSummary();
}

/* =============================================
   WISHLIST OPERATIONS
   ============================================= */
function toggleWishlist(id) {
  const pid = parseInt(id, 10);
  const p   = PRODUCTS.find(p => p.id === pid);
  if (!p) return;
  const idx = wishlist.findIndex(w => w.id === pid);
  if (idx >= 0) {
    wishlist.splice(idx, 1);
    showToast(`${p.title} removed from wishlist`, 'info', '💔');
  } else {
    wishlist.push({ id:p.id, title:p.title, price:p.price, image_url:p.image_url||'', category:p.category });
    showToast(`${p.title} saved to wishlist`, 'success', '❤️');
  }
  saveWish();

  const btn = document.querySelector(`.product-card[data-id="${id}"] .wish-btn`);
  if (btn) {
    const wished = wishlist.some(w => w.id === id);
    btn.className = `wish-btn${wished ? ' wished' : ''}`;
    btn.textContent = wished ? '❤️' : '♡';
    btn.title = wished ? 'Remove from wishlist' : 'Save to wishlist';
  }

  if (document.getElementById('wishlistContainer')) renderWishlist();
}

function moveToCart(id) {
  const pid  = parseInt(id, 10);
  const item = wishlist.find(w => w.id === pid);
  if (!item) return;
  addToCart(pid);
  wishlist = wishlist.filter(w => w.id !== pid);
  saveWish();
  renderWishlist();
}

function removeFromWishlist(id) {
  const pid = parseInt(id, 10);
  wishlist  = wishlist.filter(w => w.id !== pid);
  saveWish();
  renderWishlist();
}

/* =============================================
   RENDER: CART (cart page)
   ============================================= */
function renderCart() {
  const container  = document.getElementById('cartItemsContainer');
  const subtotalEl = document.getElementById('cartSubtotal');
  const subValEl   = document.getElementById('cartSubtotalVal');
  const badgeEl    = document.getElementById('cartBadgeLabel');
  if (!container) return;

  const totalQty = cart.reduce((s,i) => s + (parseInt(i.qty,10)||0), 0);
  if (badgeEl) badgeEl.textContent = `${totalQty} item${totalQty !== 1 ? 's' : ''}`;

  if (!cart.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛒</div>
        <p>Your cart is empty.</p>
        <a href="index.html" class="btn btn-gold">Browse Collection</a>
      </div>`;
    if (subtotalEl) subtotalEl.style.display = 'none';
    return;
  }

  const subtotal = cart.reduce((s,i) => s + (Number(i.price)||0) * (parseInt(i.qty,10)||0), 0);
  container.innerHTML = cart.map(item => {
    const img = (item.image_url && item.image_url.trim()) ? item.image_url : PLACEHOLDER_IMG;
    return `
    <div class="cart-item">
      <img class="cart-item-img" src="${escHtml(img)}" alt="${escHtml(item.title)}">
      <div class="cart-item-body">
        <div class="cart-item-cat">${escHtml(item.category)}</div>
        <div class="cart-item-title">${escHtml(item.title)}</div>
        <div class="cart-item-price">${fmt(item.price)} each</div>
        <div class="qty-controls">
          <button class="qty-btn" onclick="updateQty(${item.id},-1)" aria-label="Decrease">−</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty(${item.id},1)" aria-label="Increase">+</button>
        </div>
      </div>
      <div class="cart-item-actions">
        <span class="item-total">${fmt(item.price * item.qty)}</span>
        <button class="remove-btn" onclick="removeFromCart(${item.id})">✕ Remove</button>
      </div>
    </div>`;
  }).join('');

  if (subtotalEl) { subtotalEl.style.display = 'flex'; }
  if (subValEl)   { subValEl.textContent = fmt(subtotal); }
}

/* =============================================
   RENDER: WISHLIST (cart page)
   ============================================= */
function renderWishlist() {
  const container = document.getElementById('wishlistContainer');
  const badgeEl   = document.getElementById('wishBadgeLabel');
  if (!container) return;

  if (badgeEl) badgeEl.textContent = `${wishlist.length} saved`;

  if (!wishlist.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❤️</div>
        <p>Nothing saved yet. Heart a piece to add it here.</p>
        <a href="index.html" class="btn btn-outline-dark">Explore Pieces</a>
      </div>`;
    return;
  }

  container.innerHTML = wishlist.map(item => {
    const img = (item.image_url && item.image_url.trim()) ? item.image_url : PLACEHOLDER_IMG;
    return `
    <div class="wish-item">
      <img class="wish-item-img" src="${escHtml(img)}" alt="${escHtml(item.title)}">
      <div>
        <div class="wish-item-cat">${escHtml(item.category)}</div>
        <div class="wish-item-title">${escHtml(item.title)}</div>
        <div class="wish-item-price">${fmt(item.price)}</div>
      </div>
      <div class="wish-actions">
        <button class="move-to-cart-btn" onclick="moveToCart(${item.id})">Add to Cart</button>
        <button class="remove-wish-btn" onclick="removeFromWishlist(${item.id})">✕ Remove</button>
      </div>
    </div>`;
  }).join('');
}

/* =============================================
   ORDER SUMMARY (cart page)
   ============================================= */
function updateSummary() {
  const subtotal = cart.reduce((s,i) => s + (Number(i.price)||0) * (parseInt(i.qty,10)||0), 0);
  const shipping = subtotal > 0 && subtotal < 150 ? 12.99 : 0;
  const total    = subtotal + shipping;

  const linesEl = document.getElementById('summaryLines');
  if (linesEl) {
    if (!cart.length) {
      linesEl.innerHTML = '<p style="color:var(--muted);font-size:.85rem;padding:.5rem 0">No items yet</p>';
    } else {
      linesEl.innerHTML = cart.slice(0, 4).map(i => `
        <div class="summary-line">
          <span style="max-width:65%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(i.title)} ×${i.qty}</span>
          <span>${fmt((Number(i.price)||0)*(parseInt(i.qty,10)||0))}</span>
        </div>`).join('') +
        (cart.length > 4 ? `<div class="summary-line"><span style="color:var(--muted)">+ ${cart.length - 4} more items</span></div>` : '');
    }
  }

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sumSubtotal', fmt(subtotal));
  set('sumShipping', shipping === 0 ? (subtotal > 0 ? 'Free ✓' : '—') : fmt(shipping));
  set('sumTotal',    fmt(total));
}

/* =============================================
   CHECKOUT (cart page)
   ============================================= */
async function processOrder(e) {
  e.preventDefault();
  if (!cart.length) { showToast('Your cart is empty!', 'error', '⚠️'); return; }

  const btn     = document.getElementById('checkoutBtn');
  const btnText = document.getElementById('checkoutBtnText');

  const name    = document.getElementById('chkName')?.value.trim();
  const email   = document.getElementById('chkEmail')?.value.trim();
  const address = document.getElementById('chkAddress')?.value.trim();
  const card    = document.getElementById('chkCard')?.value.trim();
  const expiry  = document.getElementById('chkExpiry')?.value.trim();
  const cvv     = document.getElementById('chkCvv')?.value.trim();

  if (!name || !email || !address || !card || !expiry || !cvv) {
    showToast('Please fill in all fields.', 'error', '⚠️'); return;
  }
  if (card.replace(/\D/g,'').length < 12) {
    showToast('Please enter a valid card number.', 'error', '⚠️'); return;
  }

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Processing…';

  const subtotal = cart.reduce((s,i) => s + (Number(i.price)||0) * (parseInt(i.qty,10)||0), 0);
  const shipping = subtotal < 150 ? 12.99 : 0;
  const total    = subtotal + shipping;

  try {
    const r = await fetch(API_BASE, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'order', name, email, address, card, total, items:cart }),
    });
    const d = await r.json();
    if (!d.success) {
      showToast(d.message || 'Order failed. Try again.', 'error', '⚠️');
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'Place Secure Order';
      return;
    }
  } catch {
    showToast('Server error. Please try again.', 'error', '⚠️');
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Place Secure Order';
    return;
  }

  const orderNum = Math.random().toString(36).substring(2,10).toUpperCase();
  const msgEl = document.getElementById('successMsg');
  if (msgEl) {
    msgEl.innerHTML = `Thank you, <strong>${escHtml(name)}</strong>! Your order <strong>#${orderNum}</strong> has been placed.<br>
    A confirmation will be sent to <strong>${escHtml(email)}</strong>.<br>
    <span style="color:var(--gold-dark);font-weight:600">Total: ${fmt(total)}</span>`;
  }

  cart = [];
  saveCart();
  updateCartCount();
  renderCart();
  renderWishlist();
  updateSummary();
  openModal('successModal');

  if (btn) btn.disabled = false;
  if (btnText) btnText.textContent = 'Place Secure Order';
  e.target.reset();
}

/* =============================================
   PRODUCT DETAIL MODAL (index page)
   ============================================= */
function openDetail(id) {
  const p = PRODUCTS.find(p => p.id === id);
  if (!p) return;
  const wrapper = document.getElementById('detailWrapper');
  if (!wrapper) return;

  const wished = wishlist.some(w => w.id === p.id);
  const img    = productImg(p);
  wrapper.innerHTML = `
    <button class="detail-close-btn" onclick="closeModal('detailModal')" aria-label="Close">✕</button>
    <div class="detail-grid">
      <img class="detail-img" src="${escHtml(img)}" alt="${escHtml(p.title)}">
      <div class="detail-content">
        <span class="detail-category eyebrow">${escHtml(p.category)}</span>
        <h2 class="detail-title">${escHtml(p.title)}</h2>
        <div class="detail-rating">
          <span class="stars">${genStars(p.rating)}</span>
          <span>${p.rating} · ${p.reviews} reviews</span>
        </div>
        <div class="detail-price">${fmt(p.price)}</div>
        <p class="detail-desc">${escHtml(p.desc)}</p>
        <div class="detail-actions">
          <button class="add-cart-btn" style="padding:1rem;font-size:.9rem"
            onclick="addToCart(${p.id});closeModal('detailModal')">Add to Cart</button>
          <button class="btn-outline-dark" style="width:100%"
            onclick="toggleWishlist(${p.id});closeModal('detailModal')">
            ${wished ? '❤️ Remove from Wishlist' : '♡ Save to Wishlist'}
          </button>
        </div>
      </div>
    </div>`;
  openModal('detailModal');
}

/* =============================================
   MODALS
   ============================================= */
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('open')));
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('open');
  setTimeout(() => { m.style.display = 'none'; }, 220);
  document.body.style.overflow = '';
}

function handleOverlayClick(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

/* =============================================
   SEARCH (index page)
   ============================================= */
function toggleSearch() {
  const wrap  = document.getElementById('searchBarWrap');
  const input = document.getElementById('searchInput');
  if (!wrap) return;
  const isOpen = wrap.classList.toggle('open');
  if (isOpen && input) { setTimeout(() => input.focus(), 220); }
  else if (input) { input.value = ''; filterProducts(); }
}

/* =============================================
   MOBILE NAV
   ============================================= */
function toggleMobileNav() {
  const nav = document.getElementById('mainNav');
  const btn = document.getElementById('hamburger');
  if (!nav) return;
  nav.classList.toggle('mobile-open');
  btn?.classList.toggle('open');
  document.body.style.overflow = nav.classList.contains('mobile-open') ? 'hidden' : '';
}

/* =============================================
   HEADER SCROLL EFFECT
   ============================================= */
function initHeaderScroll() {
  const header = document.getElementById('mainHeader');
  if (!header) return;
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 55);
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();
}

/* =============================================
   CARD FORMAT HELPERS
   ============================================= */
function formatCard(input) {
  const digits = input.value.replace(/\D/g,'').substring(0,16);
  input.value  = digits.replace(/(.{4})/g,'$1-').replace(/-$/,'');
}

function formatExpiry(input) {
  let v = input.value.replace(/\D/g,'').substring(0,4);
  if (v.length >= 3) v = v.substring(0,2) + '/' + v.substring(2);
  input.value = v;
}

/* =============================================
   SECURITY UTIL
   ============================================= */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/* =============================================
   AUTH
   ============================================= */
function openAuthModal() {
  const wrap = document.getElementById('authWrapper');
  if (!wrap) return;
  if (user) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:.5rem 0">
        <div style="font-size:3rem;margin-bottom:1rem">👤</div>
        <h2 class="auth-modal-title">Hello, ${escHtml(user.name)}!</h2>
        <p class="auth-modal-sub">Signed in as <strong>${escHtml(user.email)}</strong></p>
        <button class="auth-submit-btn" onclick="logout()" style="margin-top:1.2rem">Sign Out</button>
      </div>`;
  } else {
    renderLoginForm();
  }
  openModal('authModal');
}

function renderLoginForm() {
  const wrap = document.getElementById('authWrapper');
  if (!wrap) return;
  wrap.innerHTML = `
    <h2 class="auth-modal-title">Welcome back</h2>
    <p class="auth-modal-sub">Sign in to your Euphoria account</p>
    <form class="auth-form" onsubmit="submitLogin(event)">
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="loginEmail" placeholder="jane@example.com" required autocomplete="email">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="loginPass" placeholder="••••••••" required autocomplete="current-password">
      </div>
      <p style="font-size:.78rem;color:var(--muted);margin:.2rem 0 .6rem">
        Demo: <strong>demo@euphoria.shop</strong> / <strong>password123</strong>
      </p>
      <div id="authError" class="auth-error"></div>
      <button type="submit" class="auth-submit-btn">Sign In</button>
    </form>
    <div class="auth-toggle">
      No account? <span class="auth-toggle-link" onclick="renderRegisterForm()">Create one →</span>
    </div>`;
}

function renderRegisterForm() {
  const wrap = document.getElementById('authWrapper');
  if (!wrap) return;
  wrap.innerHTML = `
    <h2 class="auth-modal-title">Join Euphoria</h2>
    <p class="auth-modal-sub">Create your free account</p>
    <form class="auth-form" onsubmit="submitRegister(event)">
      <div class="form-group">
        <label>Full Name</label>
        <input type="text" id="regName" placeholder="Jane Doe" required autocomplete="name">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="regEmail" placeholder="jane@example.com" required autocomplete="email">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="regPass" placeholder="At least 6 characters" minlength="6" required autocomplete="new-password">
      </div>
      <div id="authError" class="auth-error"></div>
      <button type="submit" class="auth-submit-btn">Create Account</button>
    </form>
    <div class="auth-toggle">
      Already have an account? <span class="auth-toggle-link" onclick="renderLoginForm()">Sign in →</span>
    </div>`;
}

async function submitLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass  = document.getElementById('loginPass').value;
  const errEl = document.getElementById('authError');
  errEl.textContent = '';

  try {
    const r = await fetch(API_BASE, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'login', email, password:pass }) });
    const d = await r.json();
    if (!d.success) { errEl.textContent = d.message; return; }
    user = d.user;
  } catch { errEl.textContent = 'Server error. Try again.'; return; }

  saveUser();
  updateUserLabel();
  closeModal('authModal');
  showToast(`Welcome back, ${user.name}!`, 'success', '✦');
}

async function submitRegister(e) {
  e.preventDefault();
  const name  = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const pass  = document.getElementById('regPass').value;
  const errEl = document.getElementById('authError');
  errEl.textContent = '';

  try {
    const r = await fetch(API_BASE, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'register', name, email, password:pass }) });
    const d = await r.json();
    if (!d.success) { errEl.textContent = d.message; return; }
    user = d.user;
  } catch { errEl.textContent = 'Server error. Try again.'; return; }

  saveUser();
  updateUserLabel();
  closeModal('authModal');
  showToast(`Welcome to Euphoria, ${name}!`, 'success', '✦');
}

function logout() {
  user = null;
  localStorage.removeItem('euphoria_user');
  updateUserLabel();
  closeModal('authModal');
  showToast('Signed out successfully.', 'info', '👋');
}

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', async () => {
  updateCartCount();
  updateUserLabel();
  initHeaderScroll();

  const isCartPage = !!document.getElementById('cartItemsContainer');

  if (isCartPage) {
    // Cart page renders directly from localStorage — no DB call needed
    renderCart();
    renderWishlist();
    updateSummary();
  } else {
    // Index page: fetch ALL product data (incl. images) from DB, then render
    await loadProducts();
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    ['authModal','detailModal','successModal'].forEach(closeModal);
    const nav = document.getElementById('mainNav');
    if (nav?.classList.contains('mobile-open')) toggleMobileNav();
  });
});