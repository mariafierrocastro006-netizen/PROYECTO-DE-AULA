// --- Estado Global ---
let cart = [];
const cartBadge = document.querySelector('.cart-badge');
const cartSidebar = document.getElementById('cart-sidebar');
const cartOverlay = document.getElementById('cart-overlay');
const cartItemsContainer = document.getElementById('cart-items');
const cartSubtotal = document.getElementById('cart-subtotal');
const cartTotal = document.getElementById('cart-total-price');

// --- Datos de Productos (Desde Backend SQLite) ---
let products = [];

async function loadProductsFromDB() {
    try {
        const response = await fetch('http://localhost:3000/api/products');
        products = await response.json();
        renderProductsGrid();
    } catch (error) {
        console.error('Error cargando productos de la base de datos:', error);
    }
}

function renderProductsGrid() {
    const productsGrid = document.getElementById('products-grid');
    if (!productsGrid) return;

    productsGrid.innerHTML = products.map(product => `
        <article class="product-card" data-id="${product.id}" data-category="${product.category}" data-discount="${!!product.discount}">
            <div class="product-image">
                <img src="${product.img}" alt="${product.title}">
                <div class="badges">
                    <span class="badge-new">NUEVO</span>
                    ${product.discount ? `<span class="badge-discount">${product.discount}</span>` : ''}
                </div>
                <button class="btn-fav"><i class="fa-regular fa-heart"></i></button>
            </div>
            <div class="product-info">
                <span class="category-tag">${product.category}</span>
                <h3 class="product-title">${product.title}</h3>
                <div class="product-rating"><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><span class="rating-number">(5.0)</span></div>
                <div class="product-price">
                    <span class="current-price">$${product.price.toFixed(2)}</span>
                    ${product.oldPrice ? `<span class="old-price">$${product.oldPrice.toFixed(2)}</span>` : ''}
                </div>
                <button class="btn-add-cart" data-id="${product.id}">
                    <i class="fa-solid fa-cart-plus"></i> Agregar al Carrito
                </button>
            </div>
        </article>
    `).join('');

    // Re-vincular eventos de las tarjetas si es necesario
    setupGridEvents();
}

// Función separada para que se pueda llamar después de renderizar el grid
function setupGridEvents() {
    const productsGrid = document.getElementById('products-grid');
    if (productsGrid) {
        // Clonar para limpiar listeners previos si es necesario (o solo añadir uno delegado)
        // Pero aquí parece que solo añade uno.
        productsGrid.replaceWith(productsGrid.cloneNode(true));
        const newGrid = document.getElementById('products-grid');
        
        newGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            if (!card) return;

            // Botón Agregar al Carrito (Directo)
            const addBtn = e.target.closest('.btn-add-cart');
            if (addBtn) {
                e.stopPropagation();
                const productId = parseInt(addBtn.getAttribute('data-id'));
                addToCart(productId);
                return;
            }

            // Botón Favoritos
            if (e.target.closest('.btn-fav')) {
                e.stopPropagation();
                e.target.closest('.btn-fav').querySelector('i').classList.toggle('fa-solid');
                e.target.closest('.btn-fav').querySelector('i').classList.toggle('fa-regular');
                return;
            }

            // Clic en el resto de la tarjeta -> Abrir Modal
            const productId = parseInt(card.getAttribute('data-id'));
            openProductModal(productId);
        });
    }
}

// --- Funciones del Carrito ---
function updateCartUI() {
    const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

    // Actualizar badge
    if (cartBadge) {
        cartBadge.textContent = totalQty;
    }

    // Renderizar items
    if (cartItemsContainer) {
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<div class="empty-cart-msg">Tu carrito está vacío</div>';
        } else {
            cartItemsContainer.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <div class="cart-item-img">
                        <img src="${item.img}" alt="${item.title}">
                    </div>
                    <div class="cart-item-info">
                        <h4>${item.title}</h4>
                        <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                        <div class="cart-item-qty">
                            <button class="qty-btn" onclick="changeQty(${item.id}, -1)">-</button>
                            <span>${item.qty}</span>
                            <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
                            <button class="btn-remove-item" onclick="removeFromCart(${item.id})"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    // Actualizar totales
    if (cartSubtotal) cartSubtotal.textContent = `$${subtotal.toFixed(2)}`;
    if (cartTotal) cartTotal.textContent = `$${subtotal.toFixed(2)}`;

    // Guardar en LocalStorage
    localStorage.setItem('vidafit_cart', JSON.stringify(cart));
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.push({ ...product, qty: 1 });
    }

    updateCartUI();
    openCart();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartUI();
}

function changeQty(productId, delta) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.qty += delta;
        if (item.qty <= 0) {
            removeFromCart(productId);
        } else {
            updateCartUI();
        }
    }
}

function openCart() {
    cartSidebar.classList.add('active');
    cartOverlay.style.display = 'block';
}

function closeCart() {
    cartSidebar.classList.remove('active');
    cartOverlay.style.display = 'none';
}

// --- Funciones del Modal de Producto ---
const productModal = document.getElementById('product-modal');
const modalImg = document.getElementById('modal-img');
const modalTitle = document.getElementById('modal-title');
const modalPrice = document.getElementById('modal-price');
const modalOldPrice = document.getElementById('modal-old-price');
const modalCat = document.getElementById('modal-cat');
const modalDiscount = document.getElementById('modal-discount');
const modalDesc = document.getElementById('modal-desc');
const modalAddBtn = document.getElementById('modal-add-btn');

function openProductModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    modalImg.src = product.img;
    modalTitle.textContent = product.title;
    modalPrice.textContent = `$${product.price.toFixed(2)}`;
    modalOldPrice.textContent = product.oldPrice ? `$${product.oldPrice.toFixed(2)}` : "";
    modalCat.textContent = product.category;
    modalDiscount.textContent = product.discount || "";
    modalDiscount.style.display = product.discount ? "block" : "none";
    if (modalDesc) {
        modalDesc.textContent = product.description || "Este producto no tiene descripción.";
    }

    // Configurar botón de agregar en el modal
    modalAddBtn.onclick = () => {
        addToCart(product.id);
        closeProductModal();
    };

    productModal.style.display = 'flex';
}

function closeProductModal() {
    productModal.style.display = 'none';
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Cargar productos del Backend
    loadProductsFromDB();

    // Cargar carrito previo
    const savedCart = localStorage.getItem('vidafit_cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartUI();
    }

    // Abrir/Cerrar carrito
    const cartIcon = document.getElementById('cart-icon');
    const closeCartBtn = document.getElementById('close-cart');

    if (cartIcon) cartIcon.addEventListener('click', (e) => { e.preventDefault(); openCart(); });
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    // Vaciar carrito
    const clearBtn = document.getElementById('clear-cart');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        cart = [];
        updateCartUI();
    });



    // Botones de cerrar modal
    const closeModalBtn = document.querySelector('.close-product-modal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeProductModal);
    if (productModal) productModal.addEventListener('click', (e) => {
        if (e.target === productModal) closeProductModal();
    });

    // --- Funcionalidad de Botones de index.html ---

    // 1. Filtros de Categorías
    const categoryBtns = document.querySelectorAll('.category-btn');
    const productCountDisplay = document.getElementById('product-count');

    if (categoryBtns.length > 0) {
        categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Quitar clase active de todos
                categoryBtns.forEach(b => b.classList.remove('active'));
                // Añadir al seleccionado
                btn.classList.add('active');

                const filter = btn.getAttribute('data-filter');
                let count = 0;

                // Obtener las tarjetas dinámicamente cada vez que se filtra
                const currentProductCards = document.querySelectorAll('.product-card');

                currentProductCards.forEach(card => {
                    const cardCategory = card.getAttribute('data-category');
                    if (filter === 'Todo' || cardCategory === filter) {
                        card.style.display = 'block';
                        count++;
                    } else {
                        card.style.display = 'none';
                    }
                });

                if (productCountDisplay) {
                    productCountDisplay.textContent = `${count} productos`;
                }
            });
        });
    }

    // 2. Botón Ver Ofertas (scroll hacia la sección de promos)
    const btnHeroOffers = document.getElementById('btn-hero-offers');
    if (btnHeroOffers) {
        btnHeroOffers.addEventListener('click', () => {
            const promoSection = document.getElementById('promo-section');
            if (promoSection) {
                promoSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // 3. Botón Comprar Ahora de la Promo
    const btnPromoBuy = document.getElementById('btn-promo-buy');
    if (btnPromoBuy) {
        btnPromoBuy.addEventListener('click', () => {
            const productsSection = document.getElementById('products-section');
            if (productsSection) {
                productsSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // 4. Hamburguer Menu Toggle
    const menuToggle = document.getElementById('menu-toggle');
    const navIcons = document.querySelector('.nav-icons');
    if (menuToggle && navIcons) {
        menuToggle.addEventListener('click', () => {
            navIcons.classList.toggle('active');
            // Opcional: Cambiar el icono
            const icon = menuToggle.querySelector('i');
            if (icon.classList.contains('fa-bars')) {
                icon.classList.replace('fa-bars', 'fa-xmark');
            } else {
                icon.classList.replace('fa-xmark', 'fa-bars');
            }
        });
    }

});

// --- Lógica de Login y Registro ---
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const toggleFormBtn = document.getElementById("toggle-form-btn");
const toggleText = document.getElementById("toggle-text");

if (toggleFormBtn) {
    toggleFormBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (loginForm.style.display !== 'none') {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            toggleText.innerHTML = '¿Ya tienes cuenta? <a href="#" id="toggle-form-btn">Inicia sesión aquí</a>';
            // Re-vincular evento al nuevo link
            document.getElementById("toggle-form-btn").addEventListener('click', toggleForms);
        }
    });
}

function toggleForms(e) {
    e.preventDefault();
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        toggleText.innerHTML = '¿No tienes cuenta? <a href="#" id="toggle-form-btn">Regístrate aquí</a>';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        toggleText.innerHTML = '¿Ya tienes cuenta? <a href="#" id="toggle-form-btn">Inicia sesión aquí</a>';
    }
    document.getElementById("toggle-form-btn").addEventListener('click', toggleForms);
}

if (toggleFormBtn) {
    toggleFormBtn.removeEventListener('click', toggleForms);
    toggleFormBtn.addEventListener('click', toggleForms);
}

if (loginForm) {
    const message = document.getElementById("message");

    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                if (message) {
                    message.style.color = "green";
                    message.textContent = `Login exitoso. Redirigiendo...`;
                }
                localStorage.setItem("loggedIn", "true");
                localStorage.setItem("userRole", data.user.role);

                setTimeout(() => {
                    window.location.href = data.user.role === 'admin' ? 'dashboard.html' : 'index.html';
                }, 1000);
            } else {
                if (message) {
                    message.style.color = "red";
                    message.textContent = data.message || "Correo o contraseña incorrectos";
                }
            }
        } catch (error) {
            console.error('Error de red en el login:', error);
            if (message) {
                message.style.color = "red";
                message.textContent = "Error de conexión con el servidor";
            }
        }
    });
}

if (registerForm) {
    const regMessage = document.getElementById("reg-message");

    registerForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const email = document.getElementById("reg-email").value;
        const password = document.getElementById("reg-password").value;

        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                if (regMessage) {
                    regMessage.style.color = "green";
                    regMessage.textContent = `Registro exitoso. Redirigiendo...`;
                }
                localStorage.setItem("loggedIn", "true");
                localStorage.setItem("userRole", data.user.role);

                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            } else {
                if (regMessage) {
                    regMessage.style.color = "red";
                    regMessage.textContent = data.message || "Error al registrarse";
                }
            }
        } catch (error) {
            console.error('Error de red en el registro:', error);
            if (regMessage) {
                regMessage.style.color = "red";
                regMessage.textContent = "Error de conexión con el servidor";
            }
        }
    });
}