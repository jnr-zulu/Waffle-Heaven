/**
 * main.js - Core JavaScript functionality for Waffle Heaven restaurant
 */

// DOM ready check
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

/**
 * Initialize all application components
 */
function initApp() {
  // Initialize UI components
  initNavigation();
  initMenuFilters();
  initOrderForms();
  initReservationSystem();
  initAnimations();
  
  // Initialize auth-related functionality if user is logged in
  if (isUserLoggedIn()) {
    initUserProfile();
    initOrderHistory();
  }
  
  // Check for admin access
  if (isAdminUser()) {
    initAdminPanel();
  }
}

/**
 * Navigation functionality
 */
function initNavigation() {
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  
  // Mobile menu toggle
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      mainNav.classList.toggle('active');
      navToggle.setAttribute('aria-expanded', 
        navToggle.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'
      );
    });
  }
  
  // Handle smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // Close mobile menu if open
        if (mainNav.classList.contains('active')) {
          mainNav.classList.remove('active');
          navToggle.setAttribute('aria-expanded', 'false');
        }
      }
    });
  });
  
  // Active link highlighting
  highlightActiveNavLink();
  window.addEventListener('scroll', debounce(highlightActiveNavLink, 100));
}

/**
 * Highlight the current active navigation link based on scroll position
 */
function highlightActiveNavLink() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');
  
  let currentSectionId = '';
  const scrollPosition = window.scrollY + 100; // Offset for better UX
  
  sections.forEach(section => {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.offsetHeight;
    
    if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
      currentSectionId = '#' + section.getAttribute('id');
    }
  });
  
  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === currentSectionId) {
      link.classList.add('active');
    }
  });
}

/**
 * Menu filtering functionality
 */
function initMenuFilters() {
  const filterBtns = document.querySelectorAll('.menu-filter button');
  const menuItems = document.querySelectorAll('.menu-item');
  
  if (filterBtns.length) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active class from all buttons
        filterBtns.forEach(b => b.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        
        const filterValue = btn.getAttribute('data-filter');
        
        // Show/hide menu items based on category
        menuItems.forEach(item => {
          if (filterValue === 'all' || item.classList.contains(filterValue)) {
            item.style.display = 'block';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }
}

/**
 * Order form validation and submission
 */
function initOrderForms() {
  const orderForm = document.querySelector('#order-form');
  
  if (orderForm) {
    // Handle quantity changes
    const quantityInputs = orderForm.querySelectorAll('.quantity-input');
    quantityInputs.forEach(input => {
      const decreaseBtn = input.previousElementSibling;
      const increaseBtn = input.nextElementSibling;
      
      decreaseBtn.addEventListener('click', () => {
        if (input.value > 0) {
          input.value = parseInt(input.value) - 1;
          updateOrderTotal();
        }
      });
      
      increaseBtn.addEventListener('click', () => {
        input.value = parseInt(input.value) + 1;
        updateOrderTotal();
      });
      
      input.addEventListener('change', updateOrderTotal);
    });
    
    // Form submission
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (validateOrderForm()) {
        try {
          const formData = new FormData(orderForm);
          const orderData = Object.fromEntries(formData.entries());
          
          // Add items to order
          orderData.items = getOrderItems();
          
          if (orderData.items.length === 0) {
            showMessage('Please select at least one item to order', 'error');
            return;
          }
          
          // Call API to place order
          const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
          });
          
          const data = await response.json();
          
          if (response.ok) {
            showMessage('Your order has been placed successfully!', 'success');
            orderForm.reset();
            displayOrderConfirmation(data.order);
          } else {
            showMessage(data.message || 'Failed to place order', 'error');
          }
        } catch (err) {
          console.error('Order submission error:', err);
          showMessage('An error occurred. Please try again.', 'error');
        }
      }
    });
  }
}

/**
 * Get order items from the form
 */
function getOrderItems() {
  const items = [];
  const itemRows = document.querySelectorAll('.menu-item-row');
  
  itemRows.forEach(row => {
    const itemId = row.getAttribute('data-item-id');
    const quantity = parseInt(row.querySelector('.quantity-input').value);
    const name = row.querySelector('.item-name').textContent;
    const price = parseFloat(row.querySelector('.item-price').getAttribute('data-price'));
    
    if (quantity > 0) {
      items.push({
        id: itemId,
        name,
        price,
        quantity,
        subtotal: price * quantity
      });
    }
  });
  
  return items;
}

/**
 * Update order total when quantities change
 */
function updateOrderTotal() {
  const items = getOrderItems();
  let subtotal = 0;
  
  items.forEach(item => {
    subtotal += item.subtotal;
  });
  
  // Calculate tax (15%)
  const tax = subtotal * 0.15;
  
  // Calculate total
  const total = subtotal + tax;
  
  // Update DOM
  document.querySelector('.subtotal-value').textContent = `R${subtotal.toFixed(2)}`;
  document.querySelector('.tax-value').textContent = `R${tax.toFixed(2)}`;
  document.querySelector('.total-value').textContent = `R${total.toFixed(2)}`;
}

/**
 * Validate order form inputs
 */
function validateOrderForm() {
  const form = document.querySelector('#order-form');
  let isValid = true;
  
  // Reset previous error messages
  form.querySelectorAll('.error-message').forEach(el => el.remove());
  
  // Validate name
  const nameInput = form.querySelector('#name');
  if (!nameInput.value.trim()) {
    showInputError(nameInput, 'Name is required');
    isValid = false;
  }
  
  // Validate email
  const emailInput = form.querySelector('#email');
  if (!emailInput.value.trim()) {
    showInputError(emailInput, 'Email is required');
    isValid = false;
  } else if (!isValidEmail(emailInput.value)) {
    showInputError(emailInput, 'Please enter a valid email');
    isValid = false;
  }
  
  // Validate phone
  const phoneInput = form.querySelector('#phone');
  if (phoneInput && !phoneInput.value.trim()) {
    showInputError(phoneInput, 'Phone number is required');
    isValid = false;
  } else if (phoneInput && !isValidPhone(phoneInput.value)) {
    showInputError(phoneInput, 'Please enter a valid phone number');
    isValid = false;
  }
  
  // Validate address for delivery
  const deliveryOption = form.querySelector('#delivery');
  if (deliveryOption && deliveryOption.checked) {
    const addressInput = form.querySelector('#address');
    if (!addressInput.value.trim()) {
      showInputError(addressInput, 'Address is required for delivery');
      isValid = false;
    }
  }
  
  return isValid;
}

/**
 * Display error message for form input
 */
function showInputError(input, message) {
  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.textContent = message;
  
  input.parentNode.appendChild(errorElement);
  input.classList.add('error');
}

/**
 * Reservation system functionality
 */
function initReservationSystem() {
  const reservationForm = document.querySelector('#reservation-form');
  
  if (reservationForm) {
    // Initialize date picker
    const datePicker = reservationForm.querySelector('#reservation-date');
    if (datePicker) {
      // Set min date to today
      const today = new Date().toISOString().split('T')[0];
      datePicker.setAttribute('min', today);
      
      // Set max date to 30 days from now
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 30);
      datePicker.setAttribute('max', maxDate.toISOString().split('T')[0]);
    }
    
    // Form submission
    reservationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (validateReservationForm()) {
        try {
          const formData = new FormData(reservationForm);
          const reservationData = Object.fromEntries(formData.entries());
          
          // Call API to make reservation
          const response = await fetch('/api/reservations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(reservationData)
          });
          
          const data = await response.json();
          
          if (response.ok) {
            showMessage('Your reservation has been confirmed!', 'success');
            reservationForm.reset();
            displayReservationConfirmation(data.reservation);
          } else {
            showMessage(data.message || 'Failed to make reservation', 'error');
          }
        } catch (err) {
          console.error('Reservation submission error:', err);
          showMessage('An error occurred. Please try again.', 'error');
        }
      }
    });
  }
}

/**
 * Validate reservation form inputs
 */
function validateReservationForm() {
  const form = document.querySelector('#reservation-form');
  let isValid = true;
  
  // Reset previous error messages
  form.querySelectorAll('.error-message').forEach(el => el.remove());
  
  // Validate name
  const nameInput = form.querySelector('#reservation-name');
  if (!nameInput.value.trim()) {
    showInputError(nameInput, 'Name is required');
    isValid = false;
  }
  
  // Validate email
  const emailInput = form.querySelector('#reservation-email');
  if (!emailInput.value.trim()) {
    showInputError(emailInput, 'Email is required');
    isValid = false;
  } else if (!isValidEmail(emailInput.value)) {
    showInputError(emailInput, 'Please enter a valid email');
    isValid = false;
  }
  
  // Validate phone
  const phoneInput = form.querySelector('#reservation-phone');
  if (!phoneInput.value.trim()) {
    showInputError(phoneInput, 'Phone number is required');
    isValid = false;
  } else if (!isValidPhone(phoneInput.value)) {
    showInputError(phoneInput, 'Please enter a valid phone number');
    isValid = false;
  }
  
  // Validate date
  const dateInput = form.querySelector('#reservation-date');
  if (!dateInput.value) {
    showInputError(dateInput, 'Date is required');
    isValid = false;
  }
  
  // Validate time
  const timeInput = form.querySelector('#reservation-time');
  if (!timeInput.value) {
    showInputError(timeInput, 'Time is required');
    isValid = false;
  }
  
  // Validate guests
  const guestsInput = form.querySelector('#reservation-guests');
  if (!guestsInput.value) {
    showInputError(guestsInput, 'Number of guests is required');
    isValid = false;
  } else if (guestsInput.value < 1 || guestsInput.value > 20) {
    showInputError(guestsInput, 'Number of guests must be between 1 and 20');
    isValid = false;
  }
  
  return isValid;
}

/**
 * Initialize animations and visual effects
 */
function initAnimations() {
  // Intersection Observer for scroll animations
  if ('IntersectionObserver' in window) {
    const animatedElements = document.querySelectorAll('.fade-in, .slide-in, .scale-in');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1
    });
    
    animatedElements.forEach(element => {
      observer.observe(element);
    });
  } else {
    // Fallback for browsers that don't support Intersection Observer
    document.querySelectorAll('.fade-in, .slide-in, .scale-in').forEach(element => {
      element.classList.add('animated');
    });
  }
  
  // Initialize image gallery if present
  initGallery();
}

/**
 * Image gallery functionality
 */
function initGallery() {
  const gallery = document.querySelector('.gallery');
  
  if (gallery) {
    const galleryItems = gallery.querySelectorAll('.gallery-item');
    
    galleryItems.forEach(item => {
      item.addEventListener('click', () => {
        const imageUrl = item.querySelector('img').getAttribute('src');
        const caption = item.querySelector('img').getAttribute('alt');
        
        openLightbox(imageUrl, caption);
      });
    });
  }
}

/**
 * Open image lightbox
 */
function openLightbox(imageUrl, caption) {
  // Create lightbox elements
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  
  const lightboxContent = document.createElement('div');
  lightboxContent.className = 'lightbox-content';
  
  const image = document.createElement('img');
  image.src = imageUrl;
  image.alt = caption || 'Gallery image';
  
  const captionElement = document.createElement('div');
  captionElement.className = 'lightbox-caption';
  captionElement.textContent = caption || '';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'lightbox-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Close lightbox');
  
  // Append elements
  lightboxContent.appendChild(image);
  lightboxContent.appendChild(captionElement);
  lightboxContent.appendChild(closeBtn);
  lightbox.appendChild(lightboxContent);
  document.body.appendChild(lightbox);
  
  // Add event listeners
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(lightbox);
  });
  
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      document.body.removeChild(lightbox);
    }
  });
  
  // Close on Escape key
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      document.body.removeChild(lightbox);
      document.removeEventListener('keydown', escHandler);
    }
  });
}

/**
 * User profile functionality if user is logged in
 */
function initUserProfile() {
  const profileSection = document.querySelector('#profile-section');
  
  if (profileSection) {
    // Load user data
    fetchUserProfile();
    
    // Profile form submission
    const profileForm = profileSection.querySelector('#profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (validateProfileForm()) {
          try {
            const formData = new FormData(profileForm);
            const userData = Object.fromEntries(formData.entries());
            
            const response = await fetch('/api/users', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(userData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
              showMessage('Your profile has been updated successfully!', 'success');
            } else {
              showMessage(data.message || 'Failed to update profile', 'error');
            }
          } catch (err) {
            console.error('Profile update error:', err);
            showMessage('An error occurred. Please try again.', 'error');
          }
        }
      });
    }
    
    // Password change form
    const passwordForm = profileSection.querySelector('#password-form');
    if (passwordForm) {
      passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (validatePasswordForm()) {
          try {
            const formData = new FormData(passwordForm);
            const passwordData = Object.fromEntries(formData.entries());
            
            const response = await fetch('/api/users/password', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(passwordData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
              showMessage('Your password has been updated successfully!', 'success');
              passwordForm.reset();
            } else {
              showMessage(data.message || 'Failed to update password', 'error');
            }
          } catch (err) {
            console.error('Password update error:', err);
            showMessage('An error occurred. Please try again.', 'error');
          }
        }
      });
    }
  }
}

/**
 * Fetch and display user profile data
 */
async function fetchUserProfile() {
  try {
    const response = await fetch('/api/users');
    const data = await response.json();
    
    if (response.ok) {
      // Populate profile form
      const profileForm = document.querySelector('#profile-form');
      if (profileForm) {
        profileForm.querySelector('#profile-name').value = data.name || '';
        profileForm.querySelector('#profile-email').value = data.email || '';
        profileForm.querySelector('#profile-phone').value = data.phone || '';
        profileForm.querySelector('#profile-address').value = data.address || '';
      }
      
      // Update profile display
      const profileName = document.querySelector('.profile-name');
      if (profileName) {
        profileName.textContent = data.name || 'User';
      }
    } else {
      console.error('Failed to fetch user profile:', data.message);
    }
  } catch (err) {
    console.error('Profile fetch error:', err);
  }
}

/**
 * Order history functionality for logged-in users
 */
function initOrderHistory() {
  const orderHistorySection = document.querySelector('#order-history');
  
  if (orderHistorySection) {
    fetchOrderHistory();
  }
}

/**
 * Fetch and display order history
 */
async function fetchOrderHistory() {
  try {
    const response = await fetch('/api/orders');
    const data = await response.json();
    
    if (response.ok) {
      displayOrderHistory(data.orders);
    } else {
      console.error('Failed to fetch order history:', data.message);
    }
  } catch (err) {
    console.error('Order history fetch error:', err);
  }
}

/**
 * Display order history in the orders table
 */
function displayOrderHistory(orders) {
  const orderTable = document.querySelector('#orders-table tbody');
  if (!orderTable) return;
  
  // Clear existing rows
  orderTable.innerHTML = '';
  
  if (orders.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `<td colspan="5" class="text-center">No orders found</td>`;
    orderTable.appendChild(emptyRow);
    return;
  }
  
  // Add orders to table
  orders.forEach(order => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td data-label="Order ID">#${order.id}</td>
      <td data-label="Date">${formatDate(order.created_at)}</td>
      <td data-label="Items">${order.items.length}</td>
      <td data-label="Total">R${order.total.toFixed(2)}</td>
      <td data-label="Status"><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
      <td data-label="Actions">
        <button class="btn btn-sm btn-outline" data-order-id="${order.id}">View Details</button>
      </td>
    `;
    
    orderTable.appendChild(row);
    
    // Add event listener to view details button
    row.querySelector('button').addEventListener('click', () => {
      displayOrderDetails(order);
    });
  });
}

/**
 * Admin panel initialization
 */
function initAdminPanel() {
  const adminPanel = document.querySelector('#admin-panel');
  
  if (adminPanel) {
    // Initialize tabs
    const tabButtons = adminPanel.querySelectorAll('.tab-btn');
    const tabContents = adminPanel.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');
        
        // Hide all tab contents
        tabContents.forEach(content => {
          content.classList.remove('active');
        });
        
        // Deactivate all tab buttons
        tabButtons.forEach(btn => {
          btn.classList.remove('active');
        });
        
        // Activate selected tab and content
        button.classList.add('active');
        document.querySelector(`#${tabId}`).classList.add('active');
        
        // Load data for selected tab
        if (tabId === 'admin-orders') {
          loadAdminOrders();
        } else if (tabId === 'admin-menu') {
          loadAdminMenu();
        } else if (tabId === 'admin-users') {
          loadAdminUsers();
        } else if (tabId === 'admin-reservations') {
          loadAdminReservations();
        }
      });
    });
    
    // Initialize default tab
    if (tabButtons.length > 0) {
      tabButtons[0].click();
    }
  }
}

/**
 * Load admin orders
 */
async function loadAdminOrders() {
  try {
    const response = await fetch('/api/admin/orders');
    const data = await response.json();
    
    if (response.ok) {
      const ordersTable = document.querySelector('#admin-orders-table tbody');
      if (!ordersTable) return;
      
      // Clear existing rows
      ordersTable.innerHTML = '';
      
      if (data.orders.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="6" class="text-center">No orders found</td>`;
        ordersTable.appendChild(emptyRow);
        return;
      }
      
      // Add orders to table
      data.orders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td data-label="Order ID">#${order.id}</td>
          <td data-label="Customer">${order.customer_name}</td>
          <td data-label="Date">${formatDate(order.created_at)}</td>
          <td data-label="Total">R${order.total.toFixed(2)}</td>
          <td data-label="Status">
            <select class="form-control status-select" data-order-id="${order.id}">
              <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
          <td data-label="Actions">
            <button class="btn btn-sm btn-outline view-order-btn" data-order-id="${order.id}">View</button>
          </td>
        `;
        
        ordersTable.appendChild(row);
      });
      
      // Add event listeners to status selects
      document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', updateOrderStatus);
      });
      
      // Add event listeners to view buttons
      document.querySelectorAll('.view-order-btn').forEach(button => {
        button.addEventListener('click', () => {
          const orderId = button.getAttribute('data-order-id');
          viewOrderDetails(orderId);
        });
      });
    } else {
      console.error('Failed to load admin orders:', data.message);
    }
  } catch (err) {
    console.error('Admin orders load error:', err);
  }
}

/**
 * Helper functions
 */

// Check if user is logged in
function isUserLoggedIn() {
  return !!localStorage.getItem('auth_token');
}

// Check if user is admin
function isAdminUser() {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return false;
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role === 'admin';
  } catch (err) {
    console.error('Error checking admin status:', err);
    return false;
  }
}

// Show message to user
function showMessage(message, type = 'info') {
  const messageContainer = document.querySelector('.message-container') || createMessageContainer();
  
  const messageElement = document.createElement('div');
  messageElement.className = `message ${type}`;
  messageElement.innerHTML = `
    <span>${message}</span>
    <button class="close-btn" aria-label="Close message">&times;</button>
  `;
  
  messageContainer.appendChild(messageElement);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (messageElement.parentNode) {
      messageElement.classList.add('fade-out');
      setTimeout(() => {
        if (messageElement.parentNode) {
          messageContainer.removeChild(messageElement);
        }
      }, 300);
    }
  }, 5000);
  
  // Close button
  messageElement.querySelector('.close-btn').addEventListener('click', () => {
    messageElement.classList.add('fade-out');
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageContainer.removeChild(messageElement);
      }
    }, 300);
  });
}

// Create message container if it doesn't exist
function createMessageContainer() {
  const container = document.createElement('div');
  container.className = 'message-container';
  document.body.appendChild(container);
  return container;
}

// Format date
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-ZA', options);
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone format
function isValidPhone(phone) {
  // Basic South African phone validation
  const phoneRegex = /^(\+27|0)[6-8][0-9]{8}$/;
  return phoneRegex.test(phone);
}

// Debounce function for scroll events
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Dark mode toggle
 */
function initDarkMode() {
  const darkModeToggle = document.querySelector('#dark-mode-toggle');
  
  if (darkModeToggle) {
    // Check user preference
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedMode = localStorage.getItem('darkMode');
    
    // Set initial mode
    if (savedMode === 'dark' || (savedMode !== 'light' && prefersDarkMode)) {
      document.body.classList.add('dark-mode');
      darkModeToggle.checked = true;
    }
    
    // Handle toggle change
    darkModeToggle.addEventListener('change', () => {
      if (darkModeToggle.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'dark');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'light');
      }
    });
  }
}

// Call dark mode initialization
initDarkMode();