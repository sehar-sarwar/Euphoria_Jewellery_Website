const API_URL = 'api.php';
let products = [];
let cart = [];
let wishlist = [];
let currentUser = null;
let isLoginView = true;

window.addEventListener('DOMContentLoaded', () => {
    cart = loadState('euphoria_cart', []);
    wishlist = loadState('euphoria_wishlist', []);
    currentUser = loadState('euphoria_user', null);
    updateAuthUI();
    updateCartCount();

    if (document.getElementById('productsGrid')) {
        loadProducts();
    }

    if (document.getElementById('cartItemsContainer')) {
        renderCartPage();
        checkUserSession();
    }

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', event => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeModal('authModal');
            closeModal('detailsModal');
        }
    });
});

function loadState(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value === null ? fallback : value;
    } catch {
        return fallback;
    }
}

function saveState(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function updateAuthUI() {
    const authNavBtn = document.getElementById('authNavBtn');
    if (!authNavBtn) return;
    authNavBtn.innerText = currentUser ? `Sign Out (${currentUser.name})` : 'Login / Register';
}

function updateCartCount() {
    const cartCount = document.getElementById('cartCount');
    if (!cartCount) return;
    cartCount.innerText = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}?action=products`);
        const data = await response.json();
        products = (data.products || []).map(product => ({
            ...product,
            id: Number(product.id),
            price: Number(product.price),
            desc: product.description || product.desc || '',
        }));
        populateCategoryFilter();
        displayProducts(products);
    } catch (error) {
        const grid = document.getElementById('productsGrid');
        if (grid) {
            grid.innerHTML = '<p class="message">Unable to load products at this time. Please try again later.</p>';
        }
        console.error('Unable to load products', error);
    }
}

function populateCategoryFilter() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;
    const categories = ['all', ...new Set(products.map(item => item.category))];
    categoryFilter.innerHTML = categories.map(value => {
        const label = value === 'all' ? 'All Collections' : value;
        return `<option value="${value}">${label}</option>`;
    }).join('');
}

function displayProducts(items) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    if (!items.length) {
        grid.innerHTML = '<p class="message">No matching pieces found.</p>';
        return;
    }
    grid.innerHTML = items.map(product => {
        const inWishlist = wishlist.some(item => item.id === product.id);
        return `
            <article class="product-card">
                <img class="product-img" src="${product.img}" alt="${product.title}">
                <div class="product-info">
                    <span class="product-category">${product.category}</span>
                    <h3 class="product-title">${product.title}</h3>
                    <div class="product-price">$${product.price.toLocaleString()}</div>
                    <div class="btn-group">
                        <button class="action-btn view-btn" onclick="showProductDetails(${product.id})">View Info</button>
                        <button class="action-btn add-to-cart-btn" onclick="addToCart(${product.id})">+ Cart</button>
                        <button class="action-btn wishlist-btn" onclick="toggleWishlist(${product.id})">${inWishlist ? '❤️ In Wishlist' : '🤍 Add to Wishlist'}</button>
                    </div>
                </div>
            </article>`;
    }).join('');
}

function filterProducts() {
    const search = (document.getElementById('search')?.value || '').trim().toLowerCase();
    const category = document.getElementById('categoryFilter')?.value || 'all';
    const filtered = products.filter(product => {
        const titleMatch = product.title.toLowerCase().includes(search);
        const descriptionMatch = (product.desc || '').toLowerCase().includes(search);
        const matchesSearch = !search || titleMatch || descriptionMatch;
        const matchesCategory = category === 'all' || product.category === category;
        return matchesSearch && matchesCategory;
    });
    displayProducts(filtered);
}

function addToCart(id) {
    const item = products.find(product => product.id === id);
    if (!item) return;
    const existing = cart.find(entry => entry.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }
    saveState('euphoria_cart', cart);
    updateCartCount();
    showToast(`${item.title} added to cart!`, 'success');
}

function toggleWishlist(id) {
    const index = wishlist.findIndex(item => item.id === id);
    if (index !== -1) {
        wishlist.splice(index, 1);
        alert('Removed from wishlist.');
    } else {
        const item = products.find(product => product.id === id);
        if (!item) return;
        wishlist.push(item);
        alert('Added to wishlist.');
    }
    saveState('euphoria_wishlist', wishlist);
    filterProducts();
    renderCartPage();
}

function showProductDetails(id) {
    const product = products.find(item => item.id === id);
    if (!product) return;
    const detailsWrapper = document.getElementById('detailsWrapper');
    if (!detailsWrapper) return;
    detailsWrapper.innerHTML = `
        <span class="close-modal" onclick="closeModal('detailsModal')">&times;</span>
        <img class="desc-img" src="${product.img}" alt="${product.title}">
        <h2>${product.title}</h2>
        <div class="desc-meta"><span>${product.category}</span><span>$${product.price.toLocaleString()}</span></div>
        <p style="line-height:1.8; color:#555; margin-bottom:1.5rem;">${product.desc}</p>
        <button class="submit-btn" onclick="addToCart(${product.id}); closeModal('detailsModal');">Add to Cart</button>
    `;
    document.getElementById('detailsModal').style.display = 'flex';
}

function openAuthModal() {
    if (currentUser) {
        if (confirm('Do you want to sign out?')) {
            currentUser = null;
            saveState('euphoria_user', null);
            updateAuthUI();
            alert('Signed out successfully.');
        }
        return;
    }
    renderAuthForm();
    document.getElementById('authModal').style.display = 'flex';
}

function renderAuthForm() {
    const authWrapper = document.getElementById('authWrapper');
    if (!authWrapper) return;
    authWrapper.innerHTML = isLoginView ? `
        <h2>Login to Euphoria</h2>
        <form onsubmit="handleAuth(event)">
            <label>Email</label>
            <input type="email" id="authEmail" class="form-input" required>
            <label>Password</label>
            <input type="password" id="authPassword" class="form-input" required>
            <button class="submit-btn" type="submit">Sign In</button>
        </form>
        <div class="auth-toggle">New to Euphoria? <span onclick="toggleAuthView()">Register here</span></div>` : `
        <h2>Create your account</h2>
        <form onsubmit="handleAuth(event)">
            <label>Full Name</label>
            <input type="text" id="authName" class="form-input" required>
            <label>Email</label>
            <input type="email" id="authEmail" class="form-input" required>
            <label>Password</label>
            <input type="password" id="authPassword" class="form-input" required>
            <button class="submit-btn" type="submit">Create Account</button>
        </form>
        <div class="auth-toggle">Already registered? <span onclick="toggleAuthView()">Login instead</span></div>`;
}

function toggleAuthView() {
    isLoginView = !isLoginView;
    renderAuthForm();
}

function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail')?.value?.trim();
    if (!email) return;
    const name = isLoginView ? email.split('@')[0] : document.getElementById('authName')?.value?.trim();
    currentUser = { email, name: name || 'Member' };
    saveState('euphoria_user', currentUser);
    updateAuthUI();
    closeModal('authModal');
    alert(`Welcome back, ${currentUser.name}!`);
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('visible'), 20);
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
    }
}

function renderCartPage() {
    const cartContainer = document.getElementById('cartItemsContainer');
    const wishlistContainer = document.getElementById('wishlistContainer');
    const orderTotal = document.getElementById('orderTotal');
    if (!cartContainer || !wishlistContainer || !orderTotal) return;

    if (!cart.length) {
        cartContainer.innerHTML = '<p class="message">Your shopping cart is empty. Add a piece from the collection to begin.</p>';
    } else {
        cartContainer.innerHTML = cart.map((item, index) => `
            <div class="cart-item">
                <div class="item-details">
                    <img class="item-img" src="${item.img}" alt="${item.title}">
                    <div>
                        <div class="item-title">${item.title}</div>
                        <div class="item-price">$${item.price.toLocaleString()}</div>
                    </div>
                </div>
                <div class="quantity-controls">
                    <button onclick="changeQty(${index}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="changeQty(${index}, 1)">+</button>
                </div>
                <button class="remove-btn" onclick="removeItem(${index})">Remove</button>
            </div>`).join('');
    }

    if (!wishlist.length) {
        wishlistContainer.innerHTML = '<p class="message">No wishlist items yet. Save favourites to revisit them later.</p>';
    } else {
        wishlistContainer.innerHTML = wishlist.map((item, index) => `
            <div class="wish-item">
                <div class="item-details">
                    <img class="item-img" src="${item.img}" alt="${item.title}">
                    <div>
                        <div class="item-title">${item.title}</div>
                        <div class="item-price">$${item.price.toLocaleString()}</div>
                    </div>
                </div>
                <div>
                    <button class="move-btn" onclick="moveToCart(${index})">Move to Cart</button>
                    <button class="remove-btn" style="margin-left: 12px;" onclick="removeWishItem(${index})">&times;</button>
                </div>
            </div>`).join('');
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    orderTotal.innerText = `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function changeQty(index, amount) {
    if (!cart[index]) return;
    cart[index].quantity += amount;
    if (cart[index].quantity < 1) {
        cart.splice(index, 1);
    }
    saveState('euphoria_cart', cart);
    updateCartCount();
    renderCartPage();
}

function removeItem(index) {
    if (!cart[index]) return;
    cart.splice(index, 1);
    saveState('euphoria_cart', cart);
    updateCartCount();
    renderCartPage();
}

function removeWishItem(index) {
    if (!wishlist[index]) return;
    wishlist.splice(index, 1);
    saveState('euphoria_wishlist', wishlist);
    renderCartPage();
}

function moveToCart(index) {
    const item = wishlist[index];
    if (!item) return;
    const existing = cart.find(entry => entry.id === item.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }
    wishlist.splice(index, 1);
    saveState('euphoria_cart', cart);
    saveState('euphoria_wishlist', wishlist);
    updateCartCount();
    renderCartPage();
}

function checkUserSession() {
    if (!currentUser) return;
    const nameField = document.getElementById('name');
    const emailField = document.getElementById('email');
    if (nameField) nameField.value = currentUser.name || '';
    if (emailField) emailField.value = currentUser.email || '';
}

async function processOrder(event) {
    event.preventDefault();
    if (!cart.length) {
        showToast('Your cart is empty. Add items before checking out.', 'warning');
        return;
    }
    if (!currentUser) {
        showToast('Please log in before placing your order.', 'warning');
        openAuthModal();
        return;
    }

    const address = document.getElementById('address')?.value?.trim();
    const card = document.getElementById('card')?.value?.trim();
    if (!address || !card) {
        showToast('Complete shipping and payment details to place the order.', 'warning');
        return;
    }

    const orderPayload = {
        customer: {
            name: currentUser.name,
            email: currentUser.email
        },
        shipping: address,
        total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
        items: cart.map(item => ({ id: item.id, title: item.title, price: item.price, quantity: item.quantity }))
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'order', order: orderPayload })
        });
        const result = await response.json();

        if (result.status === 'success') {
            showToast(`Order confirmed! Reference #${result.order_id}.`, 'success');
            cart = [];
            saveState('euphoria_cart', cart);
            updateCartCount();
            renderCartPage();
            document.getElementById('checkoutForm')?.reset();
        } else {
            throw new Error(result.message || 'Checkout failed.');
        }
    } catch (error) {
        console.error(error);
        alert('Unable to complete your order. Please try again later.');
    }
}
