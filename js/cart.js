// cart.js - Shopping cart functionality for Waffle Heaven

// Cart state management
let cart = [];
const TAX_RATE = 0.15; // 15% tax rate

// Initialize cart from localStorage if available
document.addEventListener('DOMContentLoaded', () => {
  loadCartFromStorage();
  updateCartDisplay();
  setupEventListeners();
});

// Load cart data from localStorage
function loadCartFromStorage() {
  const savedCart = localStorage.getItem('waffleHeavenCart');
  if (savedCart) {
    try {
      cart = JSON.parse(savedCart);
    } catch (e) {
      console.error('Error loading cart from storage:', e);
      cart = [];
    }
  }
}

// Save cart data to localStorage
function saveCartToStorage() {
  localStorage.setItem('waffleHeavenCart', JSON.stringify(cart));
}

// Add item to cart
function addToCart(item) {
  // Check if item already exists in cart
  const existingItemIndex = cart.findIndex(cartItem => cartItem.id === item.id);
  
  if (existingItemIndex >= 0) {
    // Increment quantity if item already exists
    cart[existingItemIndex].quantity += item.quantity || 1;
  } else {
    // Add new item to cart
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
      image: item.image || 'default-waffle.jpg'
    });
  }
  
  // Update cart display and storage
  updateCartDisplay();
  saveCartToStorage();
  
  // Show notification
  showNotification(`${item.name} added to cart!`);
}

// Remove item from cart
function removeFromCart(itemId) {
  cart = cart.filter(item => item.id !== itemId);
  updateCartDisplay();
  saveCartToStorage();
}

// Update item quantity
function updateItemQuantity(itemId, newQuantity) {
  const itemIndex = cart.findIndex(item => item.id === itemId);
  
  if (itemIndex >= 0) {
    if (newQuantity <= 0) {
      // Remove item if quantity is zero or negative
      removeFromCart(itemId);
    } else {
      // Update quantity
      cart[itemIndex].quantity = newQuantity;
      updateCartDisplay();
      saveCartToStorage();
    }
  }
}

// Calculate cart subtotal
function calculateSubtotal() {
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Calculate tax amount
function calculateTax(subtotal) {
  return subtotal * TAX_RATE;
}

// Calculate total amount
function calculateTotal() {
  const subtotal = calculateSubtotal();
  const tax = calculateTax(subtotal);
  return subtotal + tax;
}

// Update cart display in the DOM
function updateCartDisplay() {
  const cartContainer = document.getElementById('cart-items');
  const cartCountElement = document.getElementById('cart-count');
  const subtotalElement = document.getElementById('cart-subtotal');
  const taxElement = document.getElementById('cart-tax');
  const totalElement = document.getElementById('cart-total');
  
  if (cartContainer) {
    // Clear existing content
    cartContainer.innerHTML = '';
    
    if (cart.length === 0) {
      // Display empty cart message
      cartContainer.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
      
      // Hide checkout button if cart is empty
      const checkoutButton = document.getElementById('checkout-button');
      if (checkoutButton) {
        checkoutButton.style.display = 'none';
      }
    } else {
      // Display cart items
      cart.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.innerHTML = `
          <div class="cart-item-image">
            <img src="/images/${item.image}" alt="${item.name}">
          </div>
          <div class="cart-item-details">
            <h4>${item.name}</h4>
            <p>R${item.price.toFixed(2)}</p>
          </div>
          <div class="cart-item-quantity">
            <button class="quantity-btn decrease" data-id="${item.id}">-</button>
            <span>${item.quantity}</span>
            <button class="quantity-btn increase" data-id="${item.id}">+</button>
          </div>
          <div class="cart-item-subtotal">
            R${(item.price * item.quantity).toFixed(2)}
          </div>
          <button class="remove-item" data-id="${item.id}">
            <i class="fa fa-trash"></i>
          </button>
        `;
        cartContainer.appendChild(itemElement);
      });
      
      // Show checkout button if cart has items
      const checkoutButton = document.getElementById('checkout-button');
      if (checkoutButton) {
        checkoutButton.style.display = 'block';
      }
    }
    
    // Set up event listeners for new buttons
    setupCartItemEvents();
  }
  
  // Update cart count badge
  if (cartCountElement) {
    const itemCount = cart.reduce((count, item) => count + item.quantity, 0);
    cartCountElement.textContent = itemCount;
    cartCountElement.style.display = itemCount > 0 ? 'block' : 'none';
  }
  
  // Update summary elements
  const subtotal = calculateSubtotal();
  const tax = calculateTax(subtotal);
  const total = subtotal + tax;
  
  if (subtotalElement) subtotalElement.textContent = `R${subtotal.toFixed(2)}`;
  if (taxElement) taxElement.textContent = `R${tax.toFixed(2)}`;
  if (totalElement) totalElement.textContent = `R${total.toFixed(2)}`;
}

// Set up event listeners for cart item buttons
function setupCartItemEvents() {
  // Quantity decrease buttons
  document.querySelectorAll('.quantity-btn.decrease').forEach(button => {
    button.addEventListener('click', () => {
      const itemId = button.getAttribute('data-id');
      const item = cart.find(i => i.id === itemId);
      if (item) {
        updateItemQuantity(itemId, item.quantity - 1);
      }
    });
  });
  
  // Quantity increase buttons
  document.querySelectorAll('.quantity-btn.increase').forEach(button => {
    button.addEventListener('click', () => {
      const itemId = button.getAttribute('data-id');
      const item = cart.find(i => i.id === itemId);
      if (item) {
        updateItemQuantity(itemId, item.quantity + 1);
      }
    });
  });
  
  // Remove item buttons
  document.querySelectorAll('.remove-item').forEach(button => {
    button.addEventListener('click', () => {
      const itemId = button.getAttribute('data-id');
      removeFromCart(itemId);
    });
  });
}

// Set up global event listeners
function setupEventListeners() {
  // Cart toggle (for mobile view)
  const cartToggle = document.getElementById('cart-toggle');
  const cartSidebar = document.getElementById('cart-sidebar');
  
  if (cartToggle && cartSidebar) {
    cartToggle.addEventListener('click', () => {
      cartSidebar.classList.toggle('active');
    });
  }
  
  // Close cart when clicking outside
  document.addEventListener('click', (event) => {
    if (cartSidebar && 
        cartSidebar.classList.contains('active') && 
        !cartSidebar.contains(event.target) && 
        !cartToggle.contains(event.target)) {
      cartSidebar.classList.remove('active');
    }
  });
  
  // Clear cart button
  const clearCartButton = document.getElementById('clear-cart');
  if (clearCartButton) {
    clearCartButton.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your cart?')) {
        cart = [];
        updateCartDisplay();
        saveCartToStorage();
      }
    });
  }
  
  // Checkout button
  const checkoutButton = document.getElementById('checkout-button');
  if (checkoutButton) {
    checkoutButton.addEventListener('click', proceedToCheckout);
  }
  
  // Add to cart buttons on menu page
  document.querySelectorAll('.add-to-cart-btn').forEach(button => {
    button.addEventListener('click', () => {
      const itemId = button.getAttribute('data-id');
      const itemName = button.getAttribute('data-name');
      const itemPrice = parseFloat(button.getAttribute('data-price'));
      const itemImage = button.getAttribute('data-image');
      
      addToCart({
        id: itemId,
        name: itemName,
        price: itemPrice,
        quantity: 1,
        image: itemImage
      });
    });
  });
}

// Proceed to checkout
function proceedToCheckout() {
  // Check if user is logged in
  const isLoggedIn = checkUserAuthentication();
  
  if (!isLoggedIn) {
    // Redirect to login page with return URL
    window.location.href = '/login?redirect=checkout';
    return;
  }
  
  // Navigate to checkout page
  window.location.href = '/checkout';
}

// Check if user is authenticated
function checkUserAuthentication() {
  // This is a simple example - in real app, would check session/JWT
  return localStorage.getItem('waffleHeavenUser') !== null;
}

// Show notification
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Export functions for use in other modules
export { 
  addToCart, 
  removeFromCart, 
  updateItemQuantity, 
  calculateTotal, 
  cart
};