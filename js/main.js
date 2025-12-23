import { db, auth } from './firebase-config.js';
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
    
    // تصدير الدوال للنافذة العالمية لتعمل مع onclick في HTML
    window.scrollToProducts = scrollToProducts;
    window.closeCart = closeCart;
    window.applyCoupon = applyCoupon;
    window.proceedToCheckout = proceedToCheckout;
    window.closeSearchModal = closeSearchModal;
    window.closeAdminModal = closeAdminModal;
    window.closeCheckout = closeCheckout;
    window.closeProductModal = closeProductModal;
    window.addToCart = addToCart;
    window.viewProductDetails = viewProductDetails;
    window.addToCartFromDetail = addToCartFromDetail;
    window.increaseQuantity = increaseQuantity;
    window.decreaseQuantity = decreaseQuantity;
    window.updateCartQuantity = updateCartQuantity;
    window.removeFromCart = removeFromCart;
    window.switchAdminTab = switchAdminTab;
    window.showProductForm = showProductForm;
    window.showCouponForm = showCouponForm;
    window.loadAdminPanel = loadAdminPanel;
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
function displayProducts(productsToDisplay, targetGridId = 'productsGrid') {
    const grid = document.getElementById(targetGridId);
    
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
                    <button class="product-actions button btn-add-cart" ${product.variants && product.variants.length > 0 ? 'disabled' : ''} onclick="addToCart('${product.id}')">
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
    const categoryFilterModal = document.getElementById('categoryFilterModal');
    const categories = [...new Set(products.map(p => p.category))].filter(Boolean);

    // Clear existing options
    categoryFilterModal.innerHTML = '<option value="">جميع التصنيفات</option>';

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilterModal.appendChild(option);
    });
}

// Setup Event Listeners
function setupEventListeners() {
    document.getElementById('cartBtn').addEventListener('click', openCart);
    document.getElementById('adminBtn').addEventListener('click', openAdmin);
    document.getElementById('checkoutForm').addEventListener('submit', handleCheckout);
    document.getElementById('searchBtn').addEventListener('click', openSearchModal);

    // Search Modal Listeners
    document.getElementById('searchInputModal').addEventListener('input', filterProducts);
    document.getElementById('categoryFilterModal').addEventListener('change', filterProducts);
    document.getElementById('priceFilterModal').addEventListener('change', filterProducts);
}

// Filter Products
function filterProducts() {
    const search = document.getElementById('searchInputModal').value.toLowerCase();
    const category = document.getElementById('categoryFilterModal').value;
    const priceRange = document.getElementById('priceFilterModal').value;

    filteredProducts = products.filter(product => {
        const matchesSearch = product.nameAr.toLowerCase().includes(search) || 
                             product.description?.toLowerCase().includes(search);
        const matchesCategory = !category || product.category === category;
        const matchesPrice = !priceRange || checkPriceRange(product.price, priceRange);

        return matchesSearch && matchesCategory && matchesPrice;
    });

    // عرض النتائج في نافذة البحث المنبثقة
    displayProducts(filteredProducts, 'searchResultsGrid');
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

    // إذا كان المنتج يحتوي على خيارات، يجب على المستخدم اختيار الخيار أولاً عبر صفحة التفاصيل
    if (product.variants && product.variants.length > 0) {
        showNotification('يرجى اختيار الخيار المطلوب من صفحة التفاصيل', 'info');
        viewProductDetails(productId);
        return;
    }

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: productId,
            nameAr: product.nameAr,
            price: parseFloat(product.price),
            image: product.image,
            quantity: 1,
            variant: null // لا يوجد خيار محدد
        });
    }

    saveCart();
    updateCartCount();
    showNotification('تم إضافة المنتج إلى السلة', 'success');
}

// View Product Details
function viewProductDetails(productId) {
    // ... (الكود الأصلي)
    // ...
    // Add event listener for variant change to update max quantity
    if (product.variants && product.variants.length > 0) {
        setTimeout(() => {
            document.getElementById('variantSelect').addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const maxStock = parseInt(selectedOption.getAttribute('data-stock'));
                const quantityInput = document.getElementById('quantityInput');
                quantityInput.max = maxStock;
                if (parseInt(quantityInput.value) > maxStock) {
                    quantityInput.value = maxStock;
                }
            });
        }, 100); // تأخير بسيط لضمان تحميل DOM
    }
}
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
                
	                ${product.variants && product.variants.length > 0 ? `
	                    <div class="product-options">
	                        <div class="option-group">
	                            <label>الخيار:</label>
	                            <select id="variantSelect">
	                                ${product.variants.map(variant => `<option value="${variant.name}" data-stock="${variant.stock}">${variant.name} (المخزون: ${variant.stock})</option>`).join('')}
	                            </select>
	                        </div>
	                    </div>
	                ` : ''}

	                <div class="quantity-selector">
	                    <label>الكمية:</label>
	                    <div class="quantity-input">
	                        <button type="button" onclick="decreaseQuantity()">-</button>
	                        <input type="number" id="quantityInput" value="1" min="1" max="${product.variants && product.variants.length > 0 ? product.variants[0].stock : product.stock || 100}">
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
    const variantSelect = document.getElementById('variantSelect');
    let selectedVariant = null;
    const quantity = parseInt(document.getElementById('quantityInput').value) || 1;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (product.variants && product.variants.length > 0) {
        if (!variantSelect || !variantSelect.value) {
            showNotification('يرجى اختيار خيار المنتج أولاً', 'error');
            return;
        }
        selectedVariant = variantSelect.value;
    } else {
        selectedVariant = null;
    }

    // البحث عن عنصر موجود بنفس الـ ID ونفس الخيار
    const existingItem = cart.find(item => item.id === productId && item.variant === selectedVariant);

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id: productId,
            nameAr: product.nameAr,
            price: parseFloat(product.price),
            image: product.image,
            quantity: quantity,
            variant: selectedVariant
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
	            <div class="cart-item-name">${item.nameAr} ${item.variant ? `(${item.variant})` : ''}</div>
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

async function updateCartTotal() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let total = subtotal;
    let discount = 0;
    const couponCode = localStorage.getItem('couponCode');
    const discountRow = document.querySelector('.discount-row');

    if (couponCode) {
        const coupon = await getCouponDetails(couponCode);
        if (coupon) {
            discount = calculateDiscount(subtotal, coupon);
            total = subtotal - discount;
            discountRow.style.display = 'flex';
            document.getElementById('couponCodeInput').value = couponCode;
            document.getElementById('couponMessage').textContent = `تم تطبيق الكوبون بنجاح! خصم ${discount.toFixed(2)} ريال.`;
            document.getElementById('couponMessage').style.color = 'var(--color-green)';
        } else {
            // الكوبون غير صالح أو منتهي الصلاحية
            localStorage.removeItem('couponCode');
            discountRow.style.display = 'none';
            document.getElementById('couponCodeInput').value = '';
            document.getElementById('couponMessage').textContent = 'كوبون الخصم غير صالح أو منتهي الصلاحية.';
            document.getElementById('couponMessage').style.color = 'var(--color-red)';
        }
    } else {
        discountRow.style.display = 'none';
        document.getElementById('couponCodeInput').value = '';
        document.getElementById('couponMessage').textContent = '';
    }

    if (document.getElementById('checkoutSubtotal')) document.getElementById('checkoutSubtotal').textContent = subtotal.toFixed(2) + ' ريال';
    if (document.getElementById('checkoutDiscount')) document.getElementById('checkoutDiscount').textContent = discount.toFixed(2) + ' ريال';
    if (document.getElementById('checkoutTotal')) document.getElementById('checkoutTotal').textContent = total.toFixed(2) + ' ريال';
    if (document.getElementById('finalCheckoutTotal')) document.getElementById('finalCheckoutTotal').textContent = total.toFixed(2) + ' ريال';
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

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let total = subtotal;
    let discount = 0;
    const couponCode = localStorage.getItem('couponCode');

    // إعادة حساب الخصم والتوتال
    if (couponCode) {
        const coupon = await getCouponDetails(couponCode);
        if (coupon) {
            discount = calculateDiscount(subtotal, coupon);
            total = subtotal - discount;
        }
    }

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

    if (couponCode) {
        orderMessage += `\n*كوبون الخصم:* ${couponCode}`;
        orderMessage += `\n*قيمة الخصم:* ${discount.toFixed(2)} ريال`;
    }
    orderMessage += `\n*المجموع الكلي:* ${total.toFixed(2)} ريال\n`;
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
            subtotal: subtotal,
            discount: discount,
            couponCode: couponCode,
            total: total,
            status: 'pending',
            createdAt: new Date(),
            whatsappSent: false
        });

        // Send to WhatsApp
        const whatsappPhone = '249933002015'; // رقم واتساب بزنس الجديد
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

async function isAdmin(user) {
    if (!user) return false;
    try {
        // التحقق من وجود UID المستخدم في مجموعة 'admins'
        const adminDoc = await db.collection('admins').doc(user.uid).get();
        return adminDoc.exists;
    } catch (error) {
        console.error("Error checking admin role:", error);
        return false;
    }
}

function openAdmin() {
    const adminModal = document.getElementById('adminModal');
    adminModal.classList.add('active');
    auth.onAuthStateChanged(async user => {
        if (user) {
            if (await isAdmin(user)) {
                loadAdminPanel();
            } else {
                showNotification('ليس لديك صلاحيات المسؤول', 'error');
                auth.signOut(); // تسجيل خروج المستخدم غير المسؤول
                adminModal.classList.remove('active'); // إغلاق النافذة إذا لم يكن مسؤولاً
            }
        } else {
            showLoginForm();
        }
    });
}
// تم نقل دالة openAdmin وتعديلها في الأعلى

function closeAdminModal() {
    const adminModal = document.getElementById('adminModal');
    if (adminModal) adminModal.classList.remove('active');
    // إعادة تحميل المنتجات عند إغلاق لوحة التحكم
    loadProducts();
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
        await auth.signInWithEmailAndPassword(email, password);
        loadAdminPanel();
    } catch (error) {
        showNotification('خطأ في تسجيل الدخول: ' + error.message, 'error');
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

    const activeBtn = document.querySelector(`.admin-tab[onclick*="${tab}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    const tabContent = document.getElementById(tab + 'Tab');
    if (tabContent) tabContent.classList.add('active');
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





// Auth Status

// ⚠️ ملاحظة للمستخدم: يجب إنشاء مجموعة 'admins' في Firestore وإضافة مستند
// بمعرف UID للمستخدم المسؤول (Admin) الذي سيتم إنشاؤه في Firebase Authentication.
// مثال: db.collection('admins').doc('UID_OF_ADMIN_USER').set({ role: 'admin' });
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

// --- Product Management Functions (CRUD) ---

function showProductForm(productId = null) {
    const adminContent = document.getElementById('adminContent');
    const product = productId ? products.find(p => p.id === productId) : {};
    const isEdit = !!productId;

    adminContent.innerHTML = `
        <div class="admin-header">
            <h3>${isEdit ? 'تعديل المنتج: ' + product.nameAr : 'إضافة منتج جديد'}</h3>
            <button class="btn btn-secondary" onclick="loadAdminPanel()">العودة لإدارة المنتجات</button>
        </div>
        <form id="productForm" class="product-form" onsubmit="handleProductFormSubmit(event)">
            <input type="hidden" id="productId" value="${productId || ''}">
            
            <div class="form-group">
                <label for="nameAr">اسم المنتج (بالعربية)</label>
                <input type="text" id="nameAr" value="${product.nameAr || ''}" required>
            </div>
            
            <div class="form-group">
                <label for="category">التصنيف</label>
                <input type="text" id="category" value="${product.category || ''}" required>
            </div>

            <div class="form-group">
                <label for="price">السعر (ريال)</label>
                <input type="number" id="price" value="${product.price || ''}" step="0.01" required>
            </div>

            <div class="form-group">
                <label for="originalPrice">السعر الأصلي (اختياري)</label>
                <input type="number" id="originalPrice" value="${product.originalPrice || ''}" step="0.01">
            </div>

            <div class="form-group">
                <label for="stock">المخزون</label>
                <input type="number" id="stock" value="${product.stock || 0}" required>
            </div>

            <div class="form-group full-width">
                <label>خيارات المنتج (Variants)</label>
                <div id="variantsContainer">
                    <!-- Variants will be loaded here -->
                </div>
                <button type="button" class="btn btn-secondary" onclick="addVariantField()">+ إضافة خيار</button>
            </div>

            <div class="form-group">
                <label for="isActive">الحالة</label>
                <select id="isActive" required>
                    <option value="true" ${product.isActive !== false ? 'selected' : ''}>مفعل</option>
                    <option value="false" ${product.isActive === false ? 'selected' : ''}>معطل</option>
                </select>
            </div>

            <div class="form-group full-width">
                <label for="image">رابط الصورة (URL)</label>
                <input type="text" id="image" value="${product.image || ''}" required>
            </div>

            <div class="form-group full-width">
                <label for="description">الوصف</label>
                <textarea id="description" required>${product.description || ''}</textarea>
            </div>

            <button type="submit" class="btn btn-primary">${isEdit ? 'حفظ التعديلات' : 'إضافة المنتج'}</button>
        </form>
    `;

    // document.getElementById('productForm').addEventListener('submit', handleProductFormSubmit); // تم نقل الاستماع إلى onsubmit في HTML

    // Load existing variants
    if (isEdit && product.variants) {
        product.variants.forEach(variant => addVariantField(variant.name, variant.stock));
    } else {
        addVariantField(); // Add one empty variant field by default
    }
}

function addVariantField(name = '', stock = 0) {
    const container = document.getElementById('variantsContainer');
    const index = container.children.length;
    const div = document.createElement('div');
    div.classList.add('variant-group');
    div.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px;';
    div.innerHTML = `
        <input type="text" class="variant-name" placeholder="اسم الخيار (مثلاً: اللون الأحمر)" value="${name}" required>
        <input type="number" class="variant-stock" placeholder="المخزون" value="${stock}" min="0" required>
        <button type="button" class="btn btn-danger" onclick="this.parentNode.remove()">حذف</button>
    `;
    container.appendChild(div);
}

function editProduct(productId) {
    showProductForm(productId);
}

async function handleProductFormSubmit(e) {
    e.preventDefault();

    const productId = document.getElementById('productId').value;
    const nameAr = document.getElementById('nameAr').value;
    const category = document.getElementById('category').value;
    const price = parseFloat(document.getElementById('price').value);
    const originalPrice = parseFloat(document.getElementById('originalPrice').value) || null;
    const stock = parseInt(document.getElementById('stock').value);

    // Get Variants
    const variantsContainer = document.getElementById('variantsContainer');
    const variantGroups = variantsContainer.querySelectorAll('.variant-group');
    const variants = [];
    variantGroups.forEach(group => {
        const name = group.querySelector('.variant-name').value;
        const variantStock = parseInt(group.querySelector('.variant-stock').value);
        if (name && variantStock >= 0) {
            variants.push({ name, stock: variantStock });
        }
    });
    const isActive = document.getElementById('isActive').value === 'true';
    const image = document.getElementById('image').value;
    const description = document.getElementById('description').value;
    
    // حساب الخصم
    let discount = 0;
    if (originalPrice && price < originalPrice) {
        discount = Math.round(((originalPrice - price) / originalPrice) * 100);
    }

    const productData = {
        nameAr,
        category,
        price,
        originalPrice,
        stock,
        isActive,
        variants,
        image,
        description,
        discount,
        // يمكن إضافة حقول أخرى مثل rating, reviewCount لاحقًا
    };

    try {
        if (productId) {
            // تعديل منتج موجود
            await db.collection('products').doc(productId).update(productData);
            showNotification('تم تحديث المنتج بنجاح', 'success');
        } else {
            // إضافة منتج جديد
            const newProductId = uuidv4(); // استخدام uuidv4 لإنشاء ID فريد
            await db.collection('products').doc(newProductId).set(productData);
            showNotification('تم إضافة المنتج بنجاح', 'success');
        }
        
        // إعادة تحميل قائمة المنتجات في الواجهة الأمامية ولوحة التحكم
        loadProducts(); 
        loadAdminPanel();

    } catch (error) {
        console.error('Error saving product:', error);
        showNotification('خطأ في حفظ المنتج: ' + error.message, 'error');
    }
}

// تحديث دالة deleteProduct
async function deleteProduct(productId) {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟ سيتم حذفه نهائيًا من قاعدة البيانات.')) {
        try {
            await db.collection('products').doc(productId).delete();
            showNotification('تم حذف المنتج بنجاح', 'success');
            loadProducts(); // تحديث قائمة المنتجات في الواجهة الأمامية
            loadAdminProducts(); // تحديث قائمة المنتجات في لوحة التحكم
        } catch (error) {
            console.error('Error deleting product:', error);
            showNotification('خطأ في حذف المنتج: ' + error.message, 'error');
        }
    }
}

// تعديل دالة loadAdminProducts لعرض زر التعديل الجديد
async function loadAdminProducts() {
    try {
        const snapshot = await db.collection('products').get();
        const productsList = document.getElementById('productsList');

        let html = '<table class="products-table"><thead><tr><th>صورة</th><th>المنتج</th><th>السعر</th><th>المخزون</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>';

        snapshot.forEach(doc => {
            const product = doc.data();
            html += `
                <tr>
                    <td><img src="${product.image || 'https://via.placeholder.com/50x50'}" alt="${product.nameAr}"></td>
                    <td>${product.nameAr}</td>
                    <td>${product.price} ريال</td>
                    <td>${product.variants ? product.variants.map(v => `${v.name} (${v.stock})`).join('<br>') : (product.stock || 0)}</td>
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

// إزالة الدالة القديمة التي كانت تظهر رسالة "ميزة التعديل قريباً"
// function editProduct(productId) {
//     showNotification('ميزة التعديل قريباً', 'info');
// }

// --- Coupon Management Functions (CRUD) ---

async function loadAdminCoupons() {
    try {
        const snapshot = await db.collection('coupons').get();
        const couponsList = document.getElementById('couponsList');

        let html = '<table class="products-table"><thead><tr><th>الكود</th><th>النوع</th><th>القيمة</th><th>تاريخ الانتهاء</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>';

        snapshot.forEach(doc => {
            const coupon = doc.data();
            const expiryDate = coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString('ar-SA') : 'لا يوجد';
            html += `
                <tr>
                    <td>${coupon.code}</td>
                    <td>${coupon.type === 'percentage' ? 'نسبة مئوية (%)' : 'مبلغ ثابت (ريال)'}</td>
                    <td>${coupon.value}</td>
                    <td>${expiryDate}</td>
                    <td>
                        <select onchange="updateCouponStatus('${doc.id}', this.value)">
                            <option value="true" ${coupon.isActive ? 'selected' : ''}>مفعل</option>
                            <option value="false" ${!coupon.isActive ? 'selected' : ''}>معطل</option>
                        </select>
                    </td>
                    <td>
                        <button class="edit-btn" onclick="showCouponForm('${doc.id}')">تعديل</button>
                        <button class="delete-btn" onclick="deleteCoupon('${doc.id}')">حذف</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        couponsList.innerHTML = html;
    } catch (error) {
        console.error('Error loading admin coupons:', error);
    }
}

async function showCouponForm(couponId = null) {
    const adminContent = document.getElementById('adminContent');
    let coupon = {};
    const isEdit = !!couponId;

    if (isEdit) {
        try {
            const doc = await db.collection('coupons').doc(couponId).get();
            if (doc.exists) {
                coupon = doc.data();
            } else {
                showNotification('الكوبون غير موجود', 'error');
                return;
            }
        } catch (error) {
            console.error('Error fetching coupon:', error);
            showNotification('خطأ في جلب بيانات الكوبون', 'error');
            return;
        }
    }

    adminContent.innerHTML = `
        <div class="admin-header">
            <h3>${isEdit ? 'تعديل الكوبون: ' + coupon.code : 'إضافة كوبون جديد'}</h3>
            <button class="btn btn-secondary" onclick="loadAdminPanel()">العودة لإدارة الكوبونات</button>
        </div>
        <form id="couponForm" class="product-form" onsubmit="handleCouponFormSubmit(event)">
            <input type="hidden" id="couponId" value="${couponId || ''}">
            
            <div class="form-group">
                <label for="couponCode">كود الكوبون</label>
                <input type="text" id="couponCode" value="${coupon.code || ''}" required ${isEdit ? 'disabled' : ''}>
            </div>
            
            <div class="form-group">
                <label for="couponType">نوع الخصم</label>
                <select id="couponType" required>
                    <option value="percentage" ${coupon.type === 'percentage' ? 'selected' : ''}>نسبة مئوية (%)</option>
                    <option value="fixed" ${coupon.type === 'fixed' ? 'selected' : ''}>مبلغ ثابت (ريال)</option>
                </select>
            </div>

            <div class="form-group">
                <label for="couponValue">قيمة الخصم</label>
                <input type="number" id="couponValue" value="${coupon.value || ''}" step="0.01" required>
            </div>

            <div class="form-group">
                <label for="expiryDate">تاريخ الانتهاء (اختياري)</label>
                <input type="date" id="expiryDate" value="${coupon.expiryDate || ''}">
            </div>

            <div class="form-group">
                <label for="couponIsActive">الحالة</label>
                <select id="couponIsActive" required>
                    <option value="true" ${coupon.isActive !== false ? 'selected' : ''}>مفعل</option>
                    <option value="false" ${coupon.isActive === false ? 'selected' : ''}>معطل</option>
                </select>
            </div>

            <div class="form-group full-width">
                <label for="minAmount">الحد الأدنى للطلب (اختياري)</label>
                <input type="number" id="minAmount" value="${coupon.minAmount || 0}" step="0.01">
            </div>

            <button type="submit" class="btn btn-primary">${isEdit ? 'حفظ التعديلات' : 'إضافة الكوبون'}</button>
        </form>
    `;
}

async function handleCouponFormSubmit(e) {
    e.preventDefault();

    const couponId = document.getElementById('couponId').value;
    const code = document.getElementById('couponCode').value.toUpperCase();
    const type = document.getElementById('couponType').value;
    const value = parseFloat(document.getElementById('couponValue').value);
    const expiryDate = document.getElementById('expiryDate').value;
    const isActive = document.getElementById('couponIsActive').value === 'true';
    const minAmount = parseFloat(document.getElementById('minAmount').value) || 0;

    const couponData = {
        code,
        type,
        value,
        expiryDate,
        isActive,
        minAmount,
        createdAt: new Date().toISOString()
    };

    try {
        if (couponId) {
            // تعديل كوبون موجود
            await db.collection('coupons').doc(couponId).update(couponData);
            showNotification('تم تحديث الكوبون بنجاح', 'success');
        } else {
            // إضافة كوبون جديد
            // التحقق من عدم تكرار الكود
            const existing = await db.collection('coupons').where('code', '==', code).get();
            if (!existing.empty) {
                showNotification('كود الكوبون موجود بالفعل', 'error');
                return;
            }
            await db.collection('coupons').add(couponData);
            showNotification('تم إضافة الكوبون بنجاح', 'success');
        }
        
        loadAdminCoupons();
        switchAdminTab('coupons');

    } catch (error) {
        console.error('Error saving coupon:', error);
        showNotification('خطأ في حفظ الكوبون: ' + error.message, 'error');
    }
}

async function updateCouponStatus(couponId, status) {
    try {
        await db.collection('coupons').doc(couponId).update({
            isActive: status === 'true'
        });
        showNotification('تم تحديث حالة الكوبون', 'success');
        loadAdminCoupons();
    } catch (error) {
        showNotification('خطأ في تحديث حالة الكوبون', 'error');
    }
}

async function deleteCoupon(couponId) {
    if (confirm('هل أنت متأكد من حذف هذا الكوبون؟')) {
        try {
            await db.collection('coupons').doc(couponId).delete();
            showNotification('تم حذف الكوبون بنجاح', 'success');
            loadAdminCoupons();
        } catch (error) {
            showNotification('خطأ في حذف الكوبون', 'error');
        }
    }
}

// تعديل دالة loadAdminPanel لاستدعاء loadAdminCoupons
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
            <button class="admin-tab" onclick="switchAdminTab('coupons')">الكوبونات</button>
            <button class="admin-tab" onclick="switchAdminTab('logout')">تسجيل خروج</button>
        </div>

        <div id="productsTab" class="admin-tab-content active">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3>إدارة المنتجات</h3>
                <button class="btn btn-primary add-product-btn" onclick="showProductForm()">+ إضافة منتج جديد</button>
            </div>
            <div id="productsList"></div>
        </div>

        <div id="ordersTab" class="admin-tab-content">
            <h3>الطلبات</h3>
            <div id="ordersList"></div>
        </div>

        <div id="couponsTab" class="admin-tab-content">
            <h3>إدارة كوبونات الخصم</h3>
            <button class="btn btn-primary add-coupon-btn" onclick="showCouponForm()">+ إضافة كوبون جديد</button>
            <div id="couponsList"></div>
        </div>
    `;

    loadAdminProducts();
    loadAdminOrders();
    loadAdminCoupons(); // استدعاء دالة تحميل الكوبونات
}



// تعديل مستمع الحدث لزر لوحة التحكم لفتح النافذة المنبثقة
document.getElementById('adminBtn').addEventListener('click', openAdmin);
// إغلاق النافذة المنبثقة عند الضغط خارجها
document.getElementById('adminModal').addEventListener('click', (e) => {
    if (e.target.id === 'adminModal') {
        closeAdminModal();
    }
});

// Search Modal Functions
function openSearchModal() {
    document.getElementById('searchModal').classList.add('active');
    // عرض جميع المنتجات عند فتح نافذة البحث لأول مرة
    displayProducts(products, 'searchResultsGrid');
}

function closeSearchModal() {
    document.getElementById('searchModal').classList.remove('active');
    // مسح حقول البحث والتصفية عند الإغلاق
    document.getElementById('searchInputModal').value = '';
    document.getElementById('categoryFilterModal').value = '';
    document.getElementById('priceFilterModal').value = '';
    // إعادة عرض المنتجات الرئيسية
    displayProducts(products);
}

// Coupon Logic Functions
async function getCouponDetails(code) {
    try {
        const snapshot = await db.collection('coupons').where('code', '==', code.toUpperCase()).get();
        if (snapshot.empty) return null;

        const coupon = snapshot.docs[0].data();
        coupon.id = snapshot.docs[0].id;

        // التحقق من الصلاحية
        if (!coupon.isActive) return null;
        if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) return null;

        return coupon;
    } catch (error) {
        console.error('Error fetching coupon details:', error);
        return null;
    }
}

function calculateDiscount(subtotal, coupon) {
    if (subtotal < coupon.minAmount) return 0;

    let discount = 0;
    if (coupon.type === 'percentage') {
        discount = subtotal * (coupon.value / 100);
    } else if (coupon.type === 'fixed') {
        discount = coupon.value;
    }

    // التأكد من أن الخصم لا يتجاوز المجموع الفرعي
    return Math.min(discount, subtotal);
}

async function applyCoupon() {
    const code = document.getElementById('couponCodeInput').value.toUpperCase();
    const coupon = await getCouponDetails(code);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (coupon) {
        if (subtotal < coupon.minAmount) {
            showNotification(`الحد الأدنى للطلب لتطبيق هذا الكوبون هو ${coupon.minAmount} ريال.`, 'error');
            localStorage.removeItem('couponCode');
        } else {
            localStorage.setItem('couponCode', code);
            showNotification('تم تطبيق الكوبون بنجاح!', 'success');
        }
    } else {
        localStorage.removeItem('couponCode');
        showNotification('كوبون الخصم غير صالح أو منتهي الصلاحية.', 'error');
    }
    updateCartTotal();
}
