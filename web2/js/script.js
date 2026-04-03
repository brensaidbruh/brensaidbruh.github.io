// 1. GLOBAL DATA & STATE (Synchronized Prices)
const products = {
    "Espresso": { price: 9, image: "../images/espresso.jpg", desc: "A bold, concentrated shot of coffee with a rich crema." },
    "Latte": { price: 11, image: "../images/latte.jpg", desc: "Smooth espresso balanced with plenty of steamed milk and a light layer of foam." },
    "Americano": { price: 10, image: "../images/americano.jpg", desc: "Espresso shots topped with hot water for a clean, strong coffee experience." },
    "Cappuccino": { price: 11, image: "../images/cappuccino.jpg", desc: "A classic balance of espresso, steamed milk, and a thick layer of frothy foam." },
    "Flat White": { price: 11, image: "../images/flatwhite.jpg", desc: "Micro-foamed milk poured over a double shot of espresso for a velvety texture." },
    "Mocha": { price: 12, image: "../images/mocha.jpg", desc: "The perfect fusion of rich chocolate and bold espresso." },
    "Cold Brew": { price: 14, image: "../images/coldbrew.jpg", desc: "Coffee grounds steeped in cold water for 12+ hours for a smooth, low-acid kick." },
    // Premium Bean Prices (250g bags)
    "Ethiopia Beans": { price: 55, image: "../images/ethiopia.jpg", desc: "Single-origin Yirgacheffe beans with floral notes and bright acidity." },
    "Brazil Beans": { price: 42, image: "../images/brazil.jpg", desc: "Nutty and chocolatey Santos beans with a smooth, low-acidity finish." },
    "Columbia Beans": { price: 48, image: "../images/columbia.jpg", desc: "Classic Huila medium-bodied beans with notes of caramel and red apple." },
    "Yirgacheffe Beans": { price: 65, image: "../images/yirgacheffe.jpg", desc: "Special Reserve beans known for their intense jasmine aroma and lemon-tea finish." },
    "Costa Rica Beans": { price: 52, image: "../images/costarica.jpg", desc: "Honey-processed Tarrazu beans with a sweet, syrupy body." },
    "Guatemala Beans": { price: 50, image: "../images/guatemala.jpg", desc: "Antigua beans with a smoky cocoa aroma and a clean, spicy finish." }
};

// 2. CORE CART SAVING LOGIC
function saveToCart(name, price, quantity) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];

    // Create a key for comparison (e.g., "Latte (Iced)")
    const existingItem = cart.find(item => item.name === name);

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        // Find the base name to get the correct image (e.g., "Latte (Hot)" -> "Latte")
        const baseName = name.split(' (')[0];
        const itemImage = products[baseName] ? products[baseName].image : "../images/placeholder.jpg";

        cart.push({
            name: name,
            price: price,
            quantity: quantity,
            image: itemImage
        });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    alert(`${name} added to your bag!`);

    // If user is currently on the cart page, refresh it
    if (document.getElementById('cart-items')) {
        loadCart();
    }
}

// 3. SHOP PAGE ACTIONS
function addToCartFromShop(name, price) {
    const tempSelect = document.getElementById(`shop-temp-${name}`);
    const finalName = tempSelect ? `${name} (${tempSelect.value})` : name;
    saveToCart(finalName, price, 1);
}

function addToCart(name, price) {
    let finalName = name;
    const tempSelect = document.getElementById('item-temp');
    const tempWrapper = document.getElementById('temperature-wrapper');

    // 1. Get the temperature value if visible
    if (tempWrapper && tempWrapper.style.display !== "none" && tempSelect) {
        finalName = `${name} (${tempSelect.value})`;
    }

    // 2. Get the quantity
    const qtyInput = document.getElementById('item-qty');
    const quantity = qtyInput ? parseInt(qtyInput.value) : 1;

    // 3. REMOVE THE ALERT FROM HERE
    // Just call the save function. 
    // If saveToCart also has an alert, that's why you saw two!
    saveToCart(finalName, price, quantity);
}

function changeQty(amount) {
    const input = document.getElementById("item-qty");
    if (!input) return;
    let val = parseInt(input.value);
    val += amount;
    if (val < 1) val = 1;
    input.value = val;
}

// 5. CART & CHECKOUT DISPLAY LOGIC
function loadCart() {
    const cartItemsContainer = document.getElementById('cart-items') || document.getElementById('checkout-items');
    const totalEl = document.getElementById('total') || document.getElementById('checkout-total');
    let cart = JSON.parse(localStorage.getItem('cart')) || [];

    if (!cartItemsContainer) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align:center; padding:20px; color:var(--lunar);">Your bag is empty.</p>';
        if (totalEl) totalEl.innerText = "RM 0.00";
        return;
    }

    let total = 0;
    cartItemsContainer.innerHTML = cart.map((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        return `
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
        `;
    }).join('');

    if (totalEl) totalEl.innerText = `RM ${total.toFixed(2)}`;
}

function removeFromCart(index) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    loadCart();
}

// 6. INITIALIZATION & ROUTING
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productName = urlParams.get("product");

    // Logic for loading specific item details on item.html
    if (productName && products[productName]) {
        const product = products[productName];

        if (document.getElementById("item-title")) document.getElementById("item-title").textContent = productName;
        if (document.getElementById("item-price")) document.getElementById("item-price").textContent = `RM ${product.price.toFixed(2)}`;
        if (document.getElementById("item-image")) document.getElementById("item-image").src = product.image;
        if (document.getElementById("item-description")) document.getElementById("item-description").textContent = product.desc;

        // Show/Hide temperature based on drink type
        const tempWrapper = document.getElementById('temperature-wrapper');
        const drinkOptions = ["Latte", "Americano", "Mocha"];
        if (tempWrapper) {
            tempWrapper.style.display = drinkOptions.includes(productName) ? "block" : "none";
        }

        const btn = document.getElementById("add-to-cart-btn");
        if (btn) {
            btn.onclick = () => addToCart(productName, product.price);
        }
    }

    // Always try to load cart contents if on cart or checkout page
    loadCart();
});

function goToCheckout() { window.location.href = "checkout.html"; }

function placeOrder(event) {
    event.preventDefault();
    alert("Disclaimer: This is a fictional online store created for educational purposes only. No actual products are sold, and no payments are processed.");
    localStorage.removeItem("cart");
    window.location.href = "home.html";
}