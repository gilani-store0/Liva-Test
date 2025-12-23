// Global Variables
let products = [];
let cart = [];
let currentUser = null;
let filteredProducts = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadCart();
    setupEventListeners();
    checkAuthStatus();
});

// Load Products from Firestore
async function loadProducts() {
    try {
        const snapshot = await db.collection('products').where('isActive', '==', true).get();
        products = [];
        snapshot.forEach(doc => {
            products.push({
                id: doc.id,
                ...doc.data()
            });
        });
        filteredProducts = [...products];
        displayProducts(filteredProducts);
        populateFilters();
    } catch (error) {
        console.error('Error loading products:', error);
        showNotification('خطأ في تحميل المنتجات', 'error');
    }
}

// Display Products
function displayProducts(productsToDisplay) {
    const grid = document.getElementById('productsGrid');
    
    if (productsToDisplay.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>لم يتم العثور على منتجات</p></div>';
        return;
    }

    grid.innerHTML = productsToDisplay.map(product => `
        <div class="product-card">
            <img src="${product.image || 'https://via.placeholder.com/250x250'}" alt="${product.nameAr}" class="product-image">
            <div class="product-info">
                <h3 class="product-name">${product.nameAr}</h3>
                <div class="product-price">
                    <span class="price">${product.price} ريال</span>
                    ${product.originalPrice ? `<span class="original-price">${product.originalPrice} ريال</span>` : ''}
                    ${product.discount ? `<span class="discount-badge">-${product.discount}%</span>` : ''}
                </div>
                <div class="product-rating">
                    <span class="stars">${getStarsHTML(product.rating || 0)}</span>
                    <span class="rating-count">(${product.reviewCount || 0})</span>
                </div>
                <div class="product-actions">
                    <button class="product-actions button btn-add-cart" onclick="addToCart('${product.id}')">
                        <i class="fas fa-shopping-cart"></i> أضيفي
                    </button>
                    <button class="product-actions button btn-view-details" onclick="viewProductDetails('${product.id}')">
                        <i class="fas fa-eye"></i> التفاصيل
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Get Stars HTML
function getStarsHTML(rating) {
    let stars = '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    for (let i = fullStars + (hasHalfStar ? 1 : 0); i < 5; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    return stars;
}

// Populate Filters
function populateFilters() {
    const categoryFilter = document.getElementById('categoryFilter');
    const categories = [...new Set(products.map(p => p.category))].filter(Boolean);

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

// Setup Event Listeners
function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', filterProducts);
    document.getElementById('categoryFilter').addEventListener('change', filterProducts);
    document.getElementById('priceFilter').addEventListener('change', filterProducts);
    document.getElementById('cartBtn').addEventListener('click', openCart);
    document.getElementById('adminBtn').addEventListener('click', openAdmin);
    document.getElementById('checkoutForm').addEventListener('submit', handleCheckout);
}

// Filter Products
function filterProducts() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const priceRange = document.getElementById('priceFilter').value;

    filteredProducts = products.filter(product => {
        const matchesSearch = product.nameAr.toLowerCase().includes(search) || 
                             product.description?.toLowerCase().includes(search);
        const matchesCategory = !category || product.category === category;
        const matchesPrice = !priceRange || checkPriceRange(product.price, priceRange);

        return matchesSearch && matchesCategory && matchesPrice;
    });

    displayProducts(filteredProducts);
}

// Check Price Range
function checkPriceRange(price, range) {
    const numPrice = parseFloat(price);
    const [min, max] = range.split('-');

    if (max) {
        return numPrice >= parseInt(min) && numPrice <= parseInt(max);
    } else {
        return numPrice >= parseInt(min);
    }
}

// Add to Cart
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: productId,
            nameAr: product.nameAr,
            price: parseFloat(product.price),
            image: product.image,
            quantity: 1
        });
    }

    saveCart();
    updateCartCount();
    showNotification('تم إضافة المنتج إلى السلة', 'success');
}

// View Product Details
function viewProductDetails(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('productModal');
    const detailContent = document.getElementById('productDetail');

    detailContent.innerHTML = `
        <div class="product-detail">
            <img src="${product.image || 'https://via.placeholder.com/400x400'}" alt="${product.nameAr}" class="product-detail-image">
            <div class="product-detail-info">
                <h2>${product.nameAr}</h2>
                <div class="product-detail-price">${product.price} ريال</div>
                <div class="product-rating">
                    <span class="stars">${getStarsHTML(product.rating || 0)}</span>
                    <span class="rating-count">(${product.reviewCount || 0})</span>
                </div>
                <p class="product-detail-description">${product.description || 'لا توجد وصف متاح'}</p>
                
                ${product.colors ? `
                    <div class="product-options">
                        <div class="option-group">
                            <label>الألوان المتاحة:</label>
                            <select id="colorSelect">
                                ${product.colors.map(color => `<option value="${color}">${color}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                ` : ''}

                ${product.sizes ? `
                    <div class="product-options">
                        <div class="option-group">
                            <label>الأحجام المتاحة:</label>
                            <select id="sizeSelect">
                                ${product.sizes.map(size => `<option value="${size}">${size}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                ` : ''}

                <div class="quantity-selector">
                    <label>الكمية:</label>
                    <div class="quantity-input">
                        <button type="button" onclick="decreaseQuantity()">-</button>
                        <input type="number" id="quantityInput" value="1" min="1" max="${product.stock || 100}">
                        <button type="button" onclick="increaseQuantity()">+</button>
                    </div>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-primary" onclick="addToCartFromDetail('${productId}')">
                        <i class="fas fa-shopping-cart"></i> أضيفي إلى السلة
                    </button>
                    <button class="btn btn-secondary" onclick="closeProductModal()">إغلاق</button>
                </div>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

// Add to Cart from Detail
function addToCartFromDetail(productId) {
    const quantity = parseInt(document.getElementById('quantityInput').value) || 1;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id: productId,
            nameAr: product.nameAr,
            price: parseFloat(product.price),
            image: product.image,
            quantity: quantity
        });
    }

    saveCart();
    updateCartCount();
    closeProductModal();
    showNotification('تم إضافة المنتج إلى السلة', 'success');
}

// Quantity Controls
function increaseQuantity() {
    const input = document.getElementById('quantityInput');
    input.value = parseInt(input.value) + 1;
}

function decreaseQuantity() {
    const input = document.getElementById('quantityInput');
    if (parseInt(input.value) > 1) {
        input.value = parseInt(input.value) - 1;
    }
}

// Cart Functions
function openCart() {
    const modal = document.getElementById('cartModal');
    displayCartItems();
    modal.classList.add('active');
}

function closeCart() {
    document.getElementById('cartModal').classList.remove('active');
}

function displayCartItems() {
    const cartItemsContainer = document.getElementById('cartItems');

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-cart"></i><p>السلة فارغة</p></div>';
        document.querySelector('.cart-summary').style.display = 'none';
        return;
    }

    document.querySelector('.cart-summary').style.display = 'block';

    cartItemsContainer.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <img src="${item.image || 'https://via.placeholder.com/100x100'}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 5px;">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.nameAr}</div>
                <div class="cart-item-price">${item.price} ريال</div>
            </div>
            <div class="cart-item-quantity">
                <button class="quantity-btn" onclick="updateCartQuantity(${index}, -1)">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" onclick="updateCartQuantity(${index}, 1)">+</button>
            </div>
            <div>${(item.price * item.quantity).toFixed(2)} ريال</div>
            <button class="remove-btn" onclick="removeFromCart(${index})">حذف</button>
        </div>
    `).join('');

    updateCartTotal();
}

function updateCartQuantity(index, change) {
    cart[index].quantity += change;
    if (cart[index].quantity <= 0) {
        removeFromCart(index);
    } else {
        saveCart();
        displayCartItems();
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartCount();
    displayCartItems();
}

function updateCartTotal() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('cartTotal').textContent = total.toFixed(2) + ' ريال';
    document.getElementById('checkoutTotal').textContent = total.toFixed(2) + ' ريال';
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = count;
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function loadCart() {
    const saved = localStorage.getItem('cart');
    if (saved) {
        cart = JSON.parse(saved);
        updateCartCount();
    }
}

// Checkout
function proceedToCheckout() {
    if (cart.length === 0) {
        showNotification('السلة فارغة', 'error');
        return;
    }
    closeCart();
    document.getElementById('checkoutModal').classList.add('active');
}

function closeCheckout() {
    document.getElementById('checkoutModal').classList.remove('active');
}

async function handleCheckout(e) {
    e.preventDefault();

    const name = document.getElementById('customerName').value;
    const phone = document.getElementById('customerPhone').value;
    const email = document.getElementById('customerEmail').value;
    const address = document.getElementById('customerAddress').value;
    const notes = document.getElementById('customerNotes').value;

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Create order message for WhatsApp
    let orderMessage = `*طلب جديد من Doxi*\n\n`;
    orderMessage += `*البيانات الشخصية:*\n`;
    orderMessage += `الاسم: ${name}\n`;
    orderMessage += `الهاتف: ${phone}\n`;
    orderMessage += `البريد: ${email}\n`;
    orderMessage += `العنوان: ${address}\n\n`;

    orderMessage += `*المنتجات:*\n`;
    cart.forEach(item => {
        orderMessage += `${item.nameAr} x${item.quantity} = ${(item.price * item.quantity).toFixed(2)} ريال\n`;
    });

    orderMessage += `\n*المجموع: ${total.toFixed(2)} ريال*\n`;
    if (notes) {
        orderMessage += `\nملاحظات: ${notes}`;
    }

    // Save order to Firestore
    try {
        await db.collection('orders').add({
            customerName: name,
            customerPhone: phone,
            customerEmail: email,
            customerAddress: address,
            customerNotes: notes,
            items: cart,
            total: total,
            status: 'pending',
            createdAt: new Date(),
            whatsappSent: false
        });

        // Send to WhatsApp
        const whatsappPhone = '249933002015'; // استبدل برقم واتساب بزنس
        const whatsappURL = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(orderMessage)}`;
        window.open(whatsappURL, '_blank');

        // Clear cart
        cart = [];
        saveCart();
        updateCartCount();
        closeCheckout();

        showNotification('تم إرسال الطلب بنجاح! سيتم التواصل معك قريباً', 'success');
        document.getElementById('checkoutForm').reset();
    } catch (error) {
        console.error('Error saving order:', error);
        showNotification('خطأ في حفظ الطلب', 'error');
    }
}

// Admin Panel
function openAdmin() {
    auth.onAuthStateChanged(user => {
        if (user) {
            loadAdminPanel();
            document.getElementById('adminModal').classList.add('active');
        } else {
            showLoginForm();
        }
    });
}

function closeAdmin() {
    document.getElementById('adminModal').classList.remove('active');
}

function showLoginForm() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <div style="max-width: 400px; margin: 0 auto;">
            <h3 style="text-align: center; margin-bottom: 2rem;">تسجيل الدخول</h3>
            <form id="loginForm" style="display: flex; flex-direction: column; gap: 1rem;">
                <div class="form-group">
                    <label>البريد الإلكتروني:</label>
                    <input type="email" id="loginEmail" required>
                </div>
                <div class="form-group">
                    <label>كلمة المرور:</label>
                    <input type="password" id="loginPassword" required>
                </div>
                <button type="submit" class="btn btn-primary">دخول</button>
            </form>
        </div>
    `;

    document.getElementById('adminModal').classList.add('active');

    document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        loadAdminPanel();
    } catch (error) {
        showNotification('خطأ في تسجيل الدخول: ' + error.message, 'error');
    }
}

async function loadAdminPanel() {
    const adminContent = document.getElementById('adminContent');
    // Check if user is logged in (already done in openAdmin, but good for safety)
    if (!auth.currentUser) {
        showLoginForm();
        return;
    }

    adminContent.innerHTML = `
        <div class="admin-tabs">
            <button class="admin-tab active" onclick="switchAdminTab('products')">المنتجات</button>
            <button class="admin-tab" onclick="switchAdminTab('orders')">الطلبات</button>
            <button class="admin-tab" onclick="switchAdminTab('logout')">تسجيل خروج</button>
        </div>

        <div id="productsTab" class="admin-tab-content active">
            <h3>إدارة المنتجات</h3>
            <div id="productsList"></div>
        </div>

        <div id="ordersTab" class="admin-tab-content">
            <h3>الطلبات</h3>
            <div id="ordersList"></div>
        </div>
    `;

    loadAdminProducts();
    loadAdminOrders();
}

async function loadAdminProducts() {
    try {
        const snapshot = await db.collection('products').get();
        const productsList = document.getElementById('productsList');

        let html = '<table class="products-table"><thead><tr><th>المنتج</th><th>السعر</th><th>المخزون</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>';

        snapshot.forEach(doc => {
            const product = doc.data();
            html += `
                <tr>
                    <td>${product.nameAr}</td>
                    <td>${product.price}</td>
                    <td><input type="number" value="${product.stock || 0}" onchange="updateProductStock('${doc.id}', this.value)"></td>
                    <td>
                        <select onchange="updateProductStatus('${doc.id}', this.value)">
                            <option value="true" ${product.isActive ? 'selected' : ''}>مفعل</option>
                            <option value="false" ${!product.isActive ? 'selected' : ''}>معطل</option>
                        </select>
                    </td>
                    <td>
                        <button class="edit-btn" onclick="editProduct('${doc.id}')">تعديل</button>
                        <button class="delete-btn" onclick="deleteProduct('${doc.id}')">حذف</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        productsList.innerHTML = html;
    } catch (error) {
        console.error('Error loading admin products:', error);
    }
}

async function loadAdminOrders() {
    try {
        const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
        const ordersList = document.getElementById('ordersList');

        let html = '<table class="products-table"><thead><tr><th>الاسم</th><th>الهاتف</th><th>المجموع</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>';

        snapshot.forEach(doc => {
            const order = doc.data();
            const date = order.createdAt?.toDate?.()?.toLocaleDateString('ar-SA') || 'N/A';
            html += `
                <tr>
                    <td>${order.customerName}</td>
                    <td>${order.customerPhone}</td>
                    <td>${order.total} ريال</td>
                    <td>${order.status}</td>
                    <td>${date}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        ordersList.innerHTML = html;
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function switchAdminTab(tab) {
    if (tab === 'logout') {
        auth.signOut();
        closeAdmin();
        showNotification('تم تسجيل الخروج', 'success');
        return;
    }

    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');
}

async function updateProductStock(productId, newStock) {
    try {
        await db.collection('products').doc(productId).update({
            stock: parseInt(newStock)
        });
        showNotification('تم تحديث المخزون', 'success');
    } catch (error) {
        showNotification('خطأ في تحديث المخزون', 'error');
    }
}

async function updateProductStatus(productId, status) {
    try {
        await db.collection('products').doc(productId).update({
            isActive: status === 'true'
        });
        showNotification('تم تحديث الحالة', 'success');
    } catch (error) {
        showNotification('خطأ في تحديث الحالة', 'error');
    }
}

async function deleteProduct(productId) {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
        try {
            await db.collection('products').doc(productId).delete();
            showNotification('تم حذف المنتج', 'success');
            loadAdminProducts();
        } catch (error) {
            showNotification('خطأ في حذف المنتج', 'error');
        }
    }
}

function editProduct(productId) {
    showNotification('ميزة التعديل قريباً', 'info');
}

// Auth Status
function checkAuthStatus() {
    auth.onAuthStateChanged(user => {
        currentUser = user;
    });
}

// Utilities
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 5px;
        z-index: 10000;
        animation: slideUp 0.3s;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function scrollToProducts() {
    document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}
