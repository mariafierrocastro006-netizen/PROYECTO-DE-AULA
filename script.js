// --- Estado Global ---
let cart = [];
const cartBadge = document.querySelector('.cart-badge');
const cartSidebar = document.getElementById('cart-sidebar');
const cartOverlay = document.getElementById('cart-overlay');
const cartItemsContainer = document.getElementById('cart-items');
const cartSubtotal = document.getElementById('cart-subtotal');
const cartTotal = document.getElementById('cart-total-price');

// --- Estado Global Favoritos ---
let favorites = [];
const favBadge = document.getElementById('fav-badge');
const favSidebar = document.getElementById('fav-sidebar');
const favOverlay = document.getElementById('fav-overlay');
const favItemsContainer = document.getElementById('fav-items');

// --- Estado Global Comentarios ---
let comments = [];
const commentsSidebar = document.getElementById('comments-sidebar');
const commentsOverlay = document.getElementById('comments-overlay');
const commentsItemsContainer = document.getElementById('comments-items');
const commentForm = document.getElementById('comment-form');

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
    
    // Actualizar estado de favoritos
    updateFavoritesUI();
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
                const productId = parseInt(card.getAttribute('data-id'));
                toggleFavorite(productId);
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
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);
    const currentQty = existingItem ? existingItem.qty : 0;

    if (product.stock <= 0) {
        alert(`Lo sentimos, el producto "${product.title}" está agotado.`);
        return;
    }

    if (currentQty + 1 > product.stock) {
        alert(`Lo sentimos, no hay suficiente stock disponible de "${product.title}". Stock disponible: ${product.stock}`);
        return;
    }

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
        if (delta > 0) {
            const product = products.find(p => p.id === productId);
            if (product && item.qty + delta > product.stock) {
                alert(`Lo sentimos, no hay suficiente stock disponible de "${product.title}". Stock disponible: ${product.stock}`);
                return;
            }
        }
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

// --- Funciones de Favoritos ---
function updateFavoritesUI() {
    if (favBadge) {
        favBadge.textContent = favorites.length;
        if (favorites.length > 0) {
            favBadge.classList.add('visible');
        } else {
            favBadge.classList.remove('visible');
        }
    }

    if (favItemsContainer) {
        if (favorites.length === 0) {
            favItemsContainer.innerHTML = `
                <div class="empty-fav-msg">
                    <i class="fa-regular fa-heart"></i>
                    <p>No tienes favoritos aún</p>
                </div>`;
        } else {
            favItemsContainer.innerHTML = favorites.map(item => `
                <div class="fav-item">
                    <div class="fav-item-img">
                        <img src="${item.img}" alt="${item.title}">
                    </div>
                    <div class="fav-item-info">
                        <div class="fav-item-category">${item.category}</div>
                        <h4>${item.title}</h4>
                        <div class="fav-item-price">$${item.price.toFixed(2)}</div>
                    </div>
                    <div class="fav-item-actions">
                        <button class="btn-fav-to-cart" onclick="addFavToCart(${item.id})" title="Agregar al carrito">
                            <i class="fa-solid fa-cart-plus"></i>
                        </button>
                        <button class="btn-remove-fav" onclick="toggleFavorite(${item.id})" title="Eliminar de favoritos">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }

    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => {
        const productId = parseInt(card.getAttribute('data-id'));
        const favBtn = card.querySelector('.btn-fav');
        if (favBtn) {
            const isFav = favorites.some(f => f.id === productId);
            if (isFav) {
                favBtn.classList.add('is-fav');
                favBtn.querySelector('i').classList.replace('fa-regular', 'fa-solid');
            } else {
                favBtn.classList.remove('is-fav');
                favBtn.querySelector('i').classList.replace('fa-solid', 'fa-regular');
            }
        }
    });

    localStorage.setItem('vidafit_favorites', JSON.stringify(favorites));
}

function toggleFavorite(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const index = favorites.findIndex(item => item.id === productId);
    
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(product);
    }
    
    updateFavoritesUI();
}

function addFavToCart(productId) {
    addToCart(productId);
    openCart();
}

function openFav() {
    if (favSidebar) favSidebar.classList.add('active');
    if (favOverlay) favOverlay.style.display = 'block';
}

function closeFav() {
    if (favSidebar) favSidebar.classList.remove('active');
    if (favOverlay) favOverlay.style.display = 'none';
}

// --- Funciones de Comentarios ---
function updateCommentsUI() {
    if (commentsItemsContainer) {
        if (comments.length === 0) {
            commentsItemsContainer.innerHTML = `
                <div class="empty-comments-msg">
                    <i class="fa-regular fa-comments"></i>
                    <p>No hay comentarios aún. ¡Sé el primero!</p>
                </div>`;
        } else {
            // Mostrar los más recientes primero
            const reversedComments = [...comments].reverse();
            commentsItemsContainer.innerHTML = reversedComments.map(comment => `
                <div class="comment-card">
                    <div class="comment-card-header">
                        <div class="comment-author">
                            <i class="fa-solid fa-circle-user"></i>
                            ${comment.name}
                        </div>
                        <div class="comment-date">${comment.date}</div>
                    </div>
                    <div class="comment-rating">
                        ${'<i class="fa-solid fa-star"></i>'.repeat(comment.rating)}
                        ${'<i class="fa-regular fa-star"></i>'.repeat(5 - comment.rating)}
                    </div>
                    <div class="comment-text">${comment.text}</div>
                </div>
            `).join('');
        }
    }
    localStorage.setItem('vidafit_comments', JSON.stringify(comments));
}

function openComments() {
    if (commentsSidebar) commentsSidebar.classList.add('active');
    if (commentsOverlay) commentsOverlay.style.display = 'block';
}

function closeComments() {
    if (commentsSidebar) commentsSidebar.classList.remove('active');
    if (commentsOverlay) commentsOverlay.style.display = 'none';
}

function handleCommentSubmit(e) {
    e.preventDefault();
    const nameInput = document.getElementById('comment-name');
    const ratingInput = document.getElementById('comment-rating');
    const textInput = document.getElementById('comment-text');

    if (!nameInput.value.trim() || !textInput.value.trim()) return;

    const newComment = {
        id: Date.now(),
        name: nameInput.value.trim(),
        rating: parseInt(ratingInput.value),
        text: textInput.value.trim(),
        date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    comments.push(newComment);
    updateCommentsUI();

    // Limpiar formulario
    nameInput.value = '';
    ratingInput.value = '5';
    textInput.value = '';
}

// --- Búsqueda de Productos ---
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResultsMsg = document.getElementById('search-results-msg');
    const searchResultsText = document.getElementById('search-results-text');
    const clearSearchBtn = document.getElementById('clear-search');
    const noResultsMsg = document.getElementById('no-results-msg');
    const productsGrid = document.getElementById('products-grid');
    const productCountDisplay = document.getElementById('product-count');

    if (!searchInput) return;

    function performSearch() {
        const query = searchInput.value.toLowerCase().trim();
        const categoryBtns = document.querySelectorAll('.category-btn');
        
        if (query.length > 0) {
            categoryBtns.forEach(b => b.classList.remove('active'));
            const todoBtn = document.querySelector('.category-btn[data-filter="Todo"]');
            if (todoBtn) todoBtn.classList.add('active');
        }

        const cards = document.querySelectorAll('.product-card');
        let count = 0;

        cards.forEach(card => {
            const titleElement = card.querySelector('.product-title');
            const title = titleElement ? titleElement.textContent.toLowerCase() : '';
            const category = card.getAttribute('data-category') ? card.getAttribute('data-category').toLowerCase() : '';
            
            if (title.includes(query) || category.includes(query)) {
                card.style.display = 'block';
                count++;
            } else {
                card.style.display = 'none';
            }
        });

        if (productCountDisplay) {
            productCountDisplay.textContent = `${count} productos`;
        }

        if (query.length > 0) {
            if(searchResultsMsg) searchResultsMsg.style.display = 'flex';
            if(searchResultsText) searchResultsText.innerHTML = `Resultados para: <strong>"${searchInput.value}"</strong>`;
            
            if (count === 0) {
                if(productsGrid) productsGrid.style.display = 'none';
                if(noResultsMsg) noResultsMsg.style.display = 'block';
            } else {
                if(productsGrid) productsGrid.style.display = 'grid';
                if(noResultsMsg) noResultsMsg.style.display = 'none';
            }
        } else {
            if(searchResultsMsg) searchResultsMsg.style.display = 'none';
            if(productsGrid) productsGrid.style.display = 'grid';
            if(noResultsMsg) noResultsMsg.style.display = 'none';
        }
    }

    searchInput.addEventListener('input', performSearch);
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            performSearch();
        });
    }
}

// --- Funciones del Modal de Producto ---
const productModal = document.getElementById('product-modal');
const modalImg = document.getElementById('modal-img');
const modalTitle = document.getElementById('modal-title');
const modalPrice = document.getElementById('modal-price');
const modalOldPrice = document.getElementById('modal-old-price');
const modalCat = document.getElementById('modal-cat');
const modalDiscount = document.getElementById('modal-discount');
const modalStock = document.getElementById('modal-stock');
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
    
    if (modalStock) {
        if (product.stock > 10) {
            modalStock.textContent = `Disponible: ${product.stock} unidades`;
            modalStock.style.color = "#10b981"; // verde
        } else if (product.stock > 0) {
            modalStock.textContent = `¡Últimas unidades! Solo quedan ${product.stock} en stock`;
            modalStock.style.color = "#f97316"; // naranja
        } else {
            modalStock.textContent = "Agotado";
            modalStock.style.color = "#ef4444"; // rojo
        }
    }

    if (modalDesc) {
        modalDesc.textContent = product.description || "Este producto no tiene descripción.";
    }

    // Configurar botón de agregar en el modal dependiendo del stock
    if (product.stock <= 0) {
        modalAddBtn.disabled = true;
        modalAddBtn.innerHTML = `<i class="fa-solid fa-ban"></i> Agotado`;
        modalAddBtn.style.background = "#ccc";
        modalAddBtn.style.cursor = "not-allowed";
        modalAddBtn.onclick = null;
    } else {
        modalAddBtn.disabled = false;
        modalAddBtn.innerHTML = `<i class="fa-solid fa-cart-plus"></i> Agregar al Carrito`;
        modalAddBtn.style.background = ""; // Restaurar estilo original
        modalAddBtn.style.cursor = "";
        modalAddBtn.onclick = () => {
            addToCart(product.id);
            closeProductModal();
        };
    }

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

    // Cargar favoritos previo
    const savedFavs = localStorage.getItem('vidafit_favorites');
    if (savedFavs) {
        favorites = JSON.parse(savedFavs);
    }

    // Cargar comentarios
    const savedComments = localStorage.getItem('vidafit_comments');
    if (savedComments) {
        comments = JSON.parse(savedComments);
    } else {
        // Comentarios de ejemplo
        comments = [
            { id: 1, name: "Carlos M.", rating: 5, text: "Excelentes productos, el balón de fútbol tiene muy buena calidad.", date: "15 may 2026" },
            { id: 2, name: "Ana P.", rating: 4, text: "El envío fue rápido. Las mancuernas llegaron en perfecto estado.", date: "18 may 2026" }
        ];
    }
    updateCommentsUI();

    // Configurar búsqueda
    setupSearch();

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

    // Finalizar Compra
    const checkoutBtn = document.querySelector('.btn-checkout');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async () => {
            if (cart.length === 0) {
                alert("Tu carrito está vacío. Agrega productos antes de finalizar la compra.");
                return;
            }

            const loggedIn = localStorage.getItem("loggedIn") === "true";
            const userEmail = localStorage.getItem("userEmail") || "Cliente Invitado";
            const customerName = loggedIn ? userEmail.split('@')[0] : "Cliente Invitado";

            const confirmPurchase = confirm(`¿Estás seguro de que deseas finalizar tu compra por un total de ${cartTotal.textContent}?`);
            if (!confirmPurchase) return;

            // Deshabilitar botón para evitar múltiples peticiones
            checkoutBtn.disabled = true;
            checkoutBtn.textContent = "Procesando...";

            try {
                const response = await fetch('http://localhost:3000/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cart: cart.map(item => ({ id: item.id, qty: item.qty })),
                        customerName: customerName
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Vaciar carrito
                    cart = [];
                    updateCartUI();
                    closeCart();

                    // Restaurar botón antes del alert para que no quede bloqueado visualmente
                    checkoutBtn.disabled = false;
                    checkoutBtn.textContent = "Finalizar Compra";

                    // Mostrar alerta de éxito
                    alert(`🎉 ¡Compra finalizada con éxito!\n\nOrden: ${data.orderId}\nTotal: $${data.total.toFixed(2)}\n\n¡Gracias por tu compra en VidaFit!`);
                    
                    // Recargar productos desde el backend para actualizar el stock local y de la interfaz
                    await loadProductsFromDB();
                } else {
                    checkoutBtn.disabled = false;
                    checkoutBtn.textContent = "Finalizar Compra";
                    alert(`❌ Error al procesar la compra: ${data.message || 'Inténtelo de nuevo.'}`);
                }
            } catch (error) {
                console.error("Error al procesar el checkout:", error);
                checkoutBtn.disabled = false;
                checkoutBtn.textContent = "Finalizar Compra";
                alert("❌ Error de conexión al procesar la compra. Asegúrate de que el servidor esté encendido.");
            } finally {
                // Doble check por seguridad
                if (checkoutBtn.textContent === "Procesando...") {
                    checkoutBtn.disabled = false;
                    checkoutBtn.textContent = "Finalizar Compra";
                }
            }
        });
    }

    // Abrir/Cerrar favoritos
    const favIcon = document.getElementById('fav-icon');
    const closeFavBtn = document.getElementById('close-fav');
    
    if (favIcon) favIcon.addEventListener('click', (e) => { e.preventDefault(); openFav(); });
    if (closeFavBtn) closeFavBtn.addEventListener('click', closeFav);
    if (favOverlay) favOverlay.addEventListener('click', closeFav);

    // Vaciar favoritos
    const clearFavBtn = document.getElementById('clear-fav');
    if (clearFavBtn) clearFavBtn.addEventListener('click', () => {
        favorites = [];
        updateFavoritesUI();
    });

    // Eventos de Comentarios
    const commentsIcon = document.getElementById('comments-icon');
    const closeCommentsBtn = document.getElementById('close-comments');
    
    if (commentsIcon) commentsIcon.addEventListener('click', (e) => { e.preventDefault(); openComments(); });
    if (closeCommentsBtn) closeCommentsBtn.addEventListener('click', closeComments);
    if (commentsOverlay) commentsOverlay.addEventListener('click', closeComments);
    
    if (commentForm) commentForm.addEventListener('submit', handleCommentSubmit);

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
                // Limpiar búsqueda al cambiar categoría
                const searchInput = document.getElementById('search-input');
                if (searchInput && searchInput.value !== '') {
                    searchInput.value = '';
                    const searchResultsMsg = document.getElementById('search-results-msg');
                    const noResultsMsg = document.getElementById('no-results-msg');
                    const productsGrid = document.getElementById('products-grid');
                    if (searchResultsMsg) searchResultsMsg.style.display = 'none';
                    if (noResultsMsg) noResultsMsg.style.display = 'none';
                    if (productsGrid) productsGrid.style.display = 'grid';
                }

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
                localStorage.setItem("userEmail", data.user.email);

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
                localStorage.setItem("userEmail", data.user.email);

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