// menu.js - Waffle Heaven Restaurant

/**
 * Menu Management Module
 * 
 * This file handles all menu-related functionality for the Waffle Heaven website,
 * including displaying menu items, filtering by category, handling item clicks,
 * and adding items to cart.
 */

// DOM Elements
const menuContainer = document.getElementById('menu-grid');
const categoryFilters = document.querySelectorAll('.category-filter');
const searchInput = document.getElementById('menu-search');
const sortSelect = document.getElementById('sort-menu');

// State
let menuItems = [];
let activeCategory = 'all';
let cart = JSON.parse(localStorage.getItem('waffleHeavenCart')) || [];

// Fetch menu items from API
async function fetchMenuItems() {
  try {
    const response = await fetch('/api/menu');
    if (!response.ok) {
      throw new Error('Failed to fetch menu items');
    }
    menuItems = await response.json();
    renderMenu(menuItems);
    updateCartCount();
  } catch (error) {
    console.error('Error fetching menu:', error);
    showErrorMessage('Could not load menu items. Please try again later.');
  }
}

// Render menu items to the page
function renderMenu(items) {
  if (!menuContainer) return;
  
  menuContainer.innerHTML = '';
  
  if (items.length === 0) {
    menuContainer.innerHTML = '<div class="no-results">No menu items found. Please try a different search.</div>';
    return;
  }
  
  items.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.className = 'menu-item';
    menuItem.dataset.id = item.id;
    menuItem.dataset.category = item.category;
    
    // Check if item is a special or featured item
    if (item.featured) {
      menuItem.classList.add('featured-item');
    }
    
    // Create HTML for the menu item
    menuItem.innerHTML = `
      <div class="menu-image-container">
        <img src="${item.image || 'images/placeholder-waffle.jpg'}" alt="${item.name}" class="menu-image">
        ${item.special ? '<span class="special-badge">Special</span>' : ''}
      </div>
      <div class="menu-details">
        <h3 class="menu-title">${item.name}</h3>
        <p class="menu-description">${item.description}</p>
        <div class="menu-footer">
          <span class="menu-price">R${item.price.toFixed(2)}</span>
          <button class="add-to-cart-btn" data-id="${item.id}">Add to Cart</button>
        </div>
      </div>
    `;
    
    menuContainer.appendChild(menuItem);
  });
  
  // Add event listeners to Add to Cart buttons
  document.querySelectorAll('.add-to-cart-btn').forEach(button => {
    button.addEventListener('click', handleAddToCart);
  });
  
  // Add event listeners to menu items for details view
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', event => {
      if (!event.target.classList.contains('add-to-cart-btn')) {
        showMenuItemDetails(item.dataset.id);
      }
    });
  });
}

// Filter menu items by category
function filterMenuByCategory(category) {
  activeCategory = category;
  let filteredItems = menuItems;
  
  if (category !== 'all') {
    filteredItems = menuItems.filter(item => item.category === category);
  }
  
  // Also apply any active search filter
  if (searchInput.value) {
    const searchTerm = searchInput.value.toLowerCase();
    filteredItems = filteredItems.filter(item => 
      item.name.toLowerCase().includes(searchTerm) || 
      item.description.toLowerCase().includes(searchTerm)
    );
  }
  
  // Apply current sort
  sortMenuItems(filteredItems);
}

// Handle category filter clicks
function setupCategoryFilters() {
  if (!categoryFilters) return;
  
  categoryFilters.forEach(filter => {
    filter.addEventListener('click', () => {
      // Remove active class from all filters
      categoryFilters.forEach(f => f.classList.remove('active'));
      
      // Add active class to clicked filter
      filter.classList.add('active');
      
      // Filter menu items
      filterMenuByCategory(filter.dataset.category);
    });
  });
}

// Search functionality
function setupSearch() {
  if (!searchInput) return;
  
  searchInput.addEventListener('input', debounce(() => {
    const searchTerm = searchInput.value.toLowerCase();
    let filteredItems = menuItems;
    
    // First filter by active category
    if (activeCategory !== 'all') {
      filteredItems = filteredItems.filter(item => item.category === activeCategory);
    }
    
    // Then filter by search term
    if (searchTerm) {
      filteredItems = filteredItems.filter(item => 
        item.name.toLowerCase().includes(searchTerm) || 
        item.description.toLowerCase().includes(searchTerm)
      );
    }
    
    renderMenu(filteredItems);
  }, 300));
}

// Sort menu items
function sortMenuItems(items) {
  if (!sortSelect) return;
  
  const sortValue = sortSelect.value;
  let sortedItems = [...items];
  
  switch(sortValue) {
    case 'price-low':
      sortedItems.sort((a, b) => a.price - b.price);
      break;
    case 'price-high':
      sortedItems.sort((a, b) => b.price - a.price);
      break;
    case 'name-asc':
      sortedItems.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      sortedItems.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'popular':
      sortedItems.sort((a, b) => b.popularity - a.popularity);
      break;
    default:
      // Default sort (featured items first, then by id)
      sortedItems.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return a.id - b.id;
      });
  }
  
  renderMenu(sortedItems);
}

// Set up sort functionality
function setupSort() {
  if (!sortSelect) return;
  
  sortSelect.addEventListener('change', () => {
    let filteredItems = menuItems;
    
    // First apply category filter
    if (activeCategory !== 'all') {
      filteredItems = filteredItems.filter(item => item.category === activeCategory);
    }
    
    // Then apply search filter if needed
    if (searchInput.value) {
      const searchTerm = searchInput.value.toLowerCase();
      filteredItems = filteredItems.filter(item => 
        item.name.toLowerCase().includes(searchTerm) || 
        item.description.toLowerCase().includes(searchTerm)
      );
    }
    
    // Then sort
    sortMenuItems(filteredItems);
  });
}

// Show detailed view of a menu item
function showMenuItemDetails(itemId) {
  const item = menuItems.find(item => item.id.toString() === itemId);
  if (!item) return;
  
  // Create modal content
  const modalContent = `
    <div class="item-detail-container">
      <div class="item-detail-image">
        <img src="${item.image || 'images/placeholder-waffle.jpg'}" alt="${item.name}">
      </div>
      <div class="item-detail-info">
        <h2>${item.name}</h2>
        <p class="item-description">${item.description}</p>
        <div class="item-meta">
          <p><strong>Category:</strong> ${capitalizeFirstLetter(item.category)}</p>
          ${item.allergens ? `<p><strong>Allergens:</strong> ${item.allergens}</p>` : ''}
          ${item.calories ? `<p><strong>Calories:</strong> ${item.calories} cal</p>` : ''}
        </div>
        <div class="item-price-container">
          <p class="item-detail-price">R${item.price.toFixed(2)}</p>
          <div class="quantity-control">
            <button class="quantity-btn minus">-</button>
            <input type="number" class="quantity-input" value="1" min="1" max="10">
            <button class="quantity-btn plus">+</button>
          </div>
        </div>
        <button class="btn primary-btn add-to-cart-detail" data-id="${item.id}">Add to Cart</button>
      </div>
    </div>
  `;
  
  // Show modal
  showModal(item.name, modalContent);
  
  // Set up quantity buttons
  const modal = document.querySelector('.modal');
  const minusBtn = modal.querySelector('.quantity-btn.minus');
  const plusBtn = modal.querySelector('.quantity-btn.plus');
  const quantityInput = modal.querySelector('.quantity-input');
  const addToCartBtn = modal.querySelector('.add-to-cart-detail');
  
  minusBtn.addEventListener('click', () => {
    if (parseInt(quantityInput.value) > 1) {
      quantityInput.value = parseInt(quantityInput.value) - 1;
    }
  });
  
  plusBtn.addEventListener('click', () => {
    if (parseInt(quantityInput.value) < 10) {
      quantityInput.value = parseInt(quantityInput.value) + 1;
    }
  });
  
  addToCartBtn.addEventListener('click', () => {
    const quantity = parseInt(quantityInput.value);
    addItemToCart(item, quantity);
    closeModal();
    showToast(`Added ${quantity} ${item.name} to cart`);
  });
}

// Handle adding an item to the cart
function handleAddToCart(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const itemId = event.target.dataset.id;
  const item = menuItems.find(item => item.id.toString() === itemId);
  
  if (item) {
    addItemToCart(item, 1);
    showToast(`Added ${item.name} to cart`);
  }
}

// Add item to cart
function addItemToCart(item, quantity) {
  const existingItemIndex = cart.findIndex(cartItem => cartItem.id === item.id);
  
  if (existingItemIndex !== -1) {
    // Item already in cart, update quantity
    cart[existingItemIndex].quantity += quantity;
  } else {
    // New item, add to cart
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity: quantity
    });
  }
  
  // Save cart to localStorage
  localStorage.setItem('waffleHeavenCart', JSON.stringify(cart));
  
  // Update cart count
  updateCartCount();
}

// Update cart item count in the header
function updateCartCount() {
  const cartCountElement = document.getElementById('cart-count');
  if (!cartCountElement) return;
  
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  cartCountElement.textContent = itemCount;
  
  if (itemCount > 0) {
    cartCountElement.classList.add('has-items');
  } else {
    cartCountElement.classList.remove('has-items');
  }
}

// Utility Functions
function showModal(title, content) {
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  
  const modalContainer = document.createElement('div');
  modalContainer.className = 'modal';
  
  modalContainer.innerHTML = `
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="close-modal">&times;</button>
    </div>
    <div class="modal-body">
      ${content}
    </div>
  `;
  
  modalOverlay.appendChild(modalContainer);
  document.body.appendChild(modalOverlay);
  
  // Prevent body scrolling when modal is open
  document.body.classList.add('modal-open');
  
  // Close modal when clicking the close button or outside the modal
  const closeBtn = modalContainer.querySelector('.close-modal');
  closeBtn.addEventListener('click', closeModal);
  
  modalOverlay.addEventListener('click', event => {
    if (event.target === modalOverlay) {
      closeModal();
    }
  });
}

function closeModal() {
  const modalOverlay = document.querySelector('.modal-overlay');
  if (modalOverlay) {
    modalOverlay.remove();
    document.body.classList.remove('modal-open');
  }
}

function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Show the toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Hide and remove the toast after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

function showErrorMessage(message) {
  if (!menuContainer) return;
  
  menuContainer.innerHTML = `
    <div class="error-message">
      <i class="fas fa-exclamation-circle"></i>
      <p>${message}</p>
      <button id="retry-btn" class="btn">Try Again</button>
    </div>
  `;
  
  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', fetchMenuItems);
  }
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function debounce(func, delay) {
  let timeoutId;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, delay);
  };
}

// Initialize menu functionality
function initMenu() {
  fetchMenuItems();
  setupCategoryFilters();
  setupSearch();
  setupSort();
  updateCartCount();
}

// Run initialization when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMenu);
} else {
  initMenu();
}

// Export functions for testing or external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initMenu,
    filterMenuByCategory,
    sortMenuItems,
    addItemToCart
  };
}