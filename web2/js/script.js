// 1. GLOBAL DATA & STATE
let cart = JSON.parse(localStorage.getItem("cart")) || [];

const products = {
    "Espresso": { price: 12, image: "../images/espresso.jpg", desc: "A bold, concentrated shot of coffee with a rich crema." },
    "Latte": { price: 10, image: "../images/latte.jpg", desc: "Smooth espresso balanced with plenty of steamed milk and a light layer of foam." },
    "Americano": { price: 11, image: "../images/americano.jpg", desc: "Espresso shots topped with hot water for a clean, strong coffee experience." },
    "Cappuccino": { price: 11, image: "../images/cappuccino.jpg", desc: "A classic balance of espresso, steamed milk, and a thick layer of frothy foam." },
    "Flat White": { price: 12, image: "../images/flatwhite.jpg", desc: "Micro-foamed milk poured over a double shot of espresso for a velvety texture." },
    "Mocha": { price: 13, image: "../images/mocha.jpg", desc: "The perfect fusion of rich chocolate and bold espresso." },
    "Cold Brew": { price: 14, image: "../images/coldbrew.jpg", desc: "Coffee grounds steeped in cold water for 12+ hours for a smooth, low-acid kick." },
    "Ethiopia Beans": { price: 20, image: "../images/ethiopia.jpg", desc: "Single-origin beans with floral notes and a bright, citrusy acidity. Perfect for filter coffee." },
    "Brazil Beans": { price: 18, image: "../images/brazil.jpg", desc: "Nutty and chocolatey beans with a smooth, low-acidity finish. Ideal for espresso lovers." },
    "Columbia Beans": { price: 19, image: "../images/columbia.jpg", desc: "Classic medium-bodied beans with notes of caramel and red apple." },
    "Yirgacheffe Beans": { price: 21, image: "../images/yirgacheffe.jpg", desc: "Exotic Ethiopian beans known for their intense jasmine aroma and lemon-tea finish." },
    "Costa Rica Beans": { price: 22, image: "../images/costarica.jpg", desc: "Honey-processed beans with a sweet, syrupy body and tropical fruit undertones." },
    "Guatemala Beans": { price: 20, image: "../images/guatemala.jpg", desc: "Balanced beans with a smoky cocoa aroma and a clean, spicy finish." }
};

// 2. CORE CART FUNCTIONS
function addToCart(name, price, quantity = 1) {
    const qty = parseInt(quantity);
    const existingItem = cart.find(item => item.name === name);

    if (existingItem) {
        existingItem.quantity += qty;
    } else {
        cart.push({ name, price, quantity: qty });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    alert(`${name} added to cart!`);
    loadCart(); // Refresh if on cart page
}

function updateCartQty(index, change) {
    cart[index].quantity += change;
    if (cart[index].quantity < 1) cart[index].quantity = 1;
    localStorage.setItem("cart", JSON.stringify(cart));
    loadCart();
}

function removeItem(index) {
    cart.splice(index, 1);
    localStorage.setItem("cart", JSON.stringify(cart));
    loadCart();
}

function loadCart() {
    const cartItems = document.getElementById("cart-items") || document.getElementById("checkout-items");
    const totalEl = document.getElementById("total") || document.getElementById("checkout-total");

    if (!cartItems) return;

    cartItems.innerHTML = "";
    let total = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        const div = document.createElement("div");
        // We use summary-item for checkout and cart-card for the cart page
        div.className = document.getElementById("checkout-items") ? "summary-item" : "cart-card";

        div.innerHTML = `
            <div class="summary-details">
                <strong>${item.name}</strong>
                <span>RM ${item.price.toFixed(2)} x ${item.quantity}</span>
            </div>
            <div style="font-weight: bold;">RM ${itemTotal.toFixed(2)}</div>
        `;
        cartItems.appendChild(div);
    });

    if (totalEl) totalEl.textContent = `RM ${total.toFixed(2)}`;
}

// 4. ITEM PAGE LOGIC
function changeQty(amount) {
    const input = document.getElementById("item-qty");
    if (!input) return;
    let val = parseInt(input.value);
    val += amount;
    if (val < 1) val = 1;
    input.value = val;
}

// 5. INITIALIZE ON LOAD
document.addEventListener("DOMContentLoaded", () => {
    // Check if we are on item.html
    const urlParams = new URLSearchParams(window.location.search);
    const productName = urlParams.get("product");

    if (productName && products[productName]) {
        const product = products[productName];
        if (document.getElementById("item-title")) document.getElementById("item-title").textContent = productName;
        if (document.getElementById("item-price")) document.getElementById("item-price").textContent = `RM ${product.price}`;
        if (document.getElementById("item-image")) document.getElementById("item-image").src = product.image;
        if (document.getElementById("item-description")) document.getElementById("item-description").textContent = product.desc;

        const btn = document.getElementById("add-to-cart-btn");
        if (btn) {
            btn.onclick = () => {
                const qty = parseInt(document.getElementById("item-qty").value);
                addToCart(productName, product.price, qty);
            };
        }
    }

    loadCart(); // Run on every page to see if cart/checkout items need rendering
});

// 6. NAVIGATION & CHECKOUT
function goToCheckout() { window.location.href = "checkout.html"; }

function placeOrder(event) {
    event.preventDefault();
    alert("Disclaimer: This is a fictional online store created for educational purposes only. No actual products are sold, and no payments are processed.");
    localStorage.removeItem("cart");
    window.location.href = "home.html";
}

function displayCart() {
    const cartItemsContainer = document.getElementById('cart-items');
    // Assuming 'cart' is your array of items
    cartItemsContainer.innerHTML = cart.map((item, index) => `
        <div class="cart-card">
            <div class="cart-item-group">
                <img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
                
                <div class="cart-text">
                    <strong style="text-transform: uppercase; display: block; font-size: 0.85rem;">${item.name}</strong>
                    <span style="color: var(--lunar); font-size: 0.8rem;">RM ${item.price.toFixed(2)}</span>
                </div>
                
                <div style="margin-left: auto; font-weight: 600; color: var(--inkwell); font-size: 0.9rem;">
                    Qty: ${item.quantity}
                </div>
            </div>

            <button class="remove-item-btn" onclick="removeFromCart(${index})" aria-label="Remove item">×</button>
        </div>
    `).join('');
}