// auth.js - Authentication functionality for Waffle Heaven

document.addEventListener('DOMContentLoaded', function() {
    // Tab switching between login and registration forms
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetForm = tab.dataset.target;
            
            // Update active tab
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show target form, hide others
            authForms.forEach(form => {
                if (form.id === targetForm) {
                    form.classList.add('active');
                } else {
                    form.classList.remove('active');
                }
            });
        });
    });
    
    // Password visibility toggle
    const togglePassword = document.getElementById('togglePassword');
    const toggleRegPassword = document.getElementById('toggleRegPassword');
    const passwordField = document.getElementById('password');
    const regPasswordField = document.getElementById('regPassword');
    
    if (togglePassword && passwordField) {
        togglePassword.addEventListener('click', function() {
            const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordField.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }
    
    if (toggleRegPassword && regPasswordField) {
        toggleRegPassword.addEventListener('click', function() {
            const type = regPasswordField.getAttribute('type') === 'password' ? 'text' : 'password';
            regPasswordField.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }
    
    // Password strength meter
    if (regPasswordField) {
        const strengthMeter = document.querySelector('.strength-meter');
        const strengthText = document.querySelector('.strength-text');
        
        regPasswordField.addEventListener('input', function() {
            const password = this.value;
            const strength = checkPasswordStrength(password);
            
            // Update strength meter
            strengthMeter.style.width = `${strength.score * 25}%`;
            strengthMeter.className = 'strength-meter';
            strengthMeter.classList.add(strength.class);
            
            // Update strength text
            strengthText.textContent = strength.message;
        });
    }
    
    // Login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const messageContainer = document.getElementById('login-message');
            
            try {
                const formData = new FormData(loginForm);
                const data = {
                    email: formData.get('email'),
                    password: formData.get('password'),
                    remember: formData.get('remember') === 'on'
                };
                
                // Show loading state
                const submitButton = loginForm.querySelector('button[type="submit"]');
                const originalText = submitButton.textContent;
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
                
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // Success
                    messageContainer.innerHTML = '<div class="success-message">Login successful! Redirecting...</div>';
                    
                    // Store authentication token
                    if (result.token) {
                        localStorage.setItem('authToken', result.token);
                        if (data.remember) {
                            localStorage.setItem('rememberMe', 'true');
                        }
                    }
                    
                    // Redirect based on user role
                    setTimeout(() => {
                        if (result.user && result.user.role === 'admin') {
                            window.location.href = '/admin/dashboard.html';
                        } else {
                            window.location.href = '/my-account.html';
                        }
                    }, 1500);
                } else {
                    // Error
                    messageContainer.innerHTML = `<div class="error-message">${result.message || 'Login failed. Please check your credentials.'}</div>`;
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                }
            } catch (error) {
                console.error('Login error:', error);
                messageContainer.innerHTML = '<div class="error-message">An error occurred. Please try again later.</div>';
                
                // Reset button
                const submitButton = loginForm.querySelector('button[type="submit"]');
                submitButton.disabled = false;
                submitButton.textContent = 'Login';
            }
        });
    }
    
    // Registration form submission
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const messageContainer = document.getElementById('register-message');
            
            // Form validation
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
                messageContainer.innerHTML = '<div class="error-message">Passwords do not match.</div>';
                return;
            }
            
            try {
                const formData = new FormData(registerForm);
                const data = {
                    firstName: formData.get('firstName'),
                    lastName: formData.get('lastName'),
                    email: formData.get('email'),
                    phone: formData.get('phone'),
                    password: formData.get('password')
                };
                
                // Show loading state
                const submitButton = registerForm.querySelector('button[type="submit"]');
                const originalText = submitButton.textContent;
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
                
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // Success
                    messageContainer.innerHTML = '<div class="success-message">Registration successful! You can now log in.</div>';
                    
                    // Clear form
                    registerForm.reset();
                    
                    // Switch to login tab after a delay
                    setTimeout(() => {
                        document.querySelector('[data-target="login-form"]').click();
                    }, 2000);
                } else {
                    // Error
                    messageContainer.innerHTML = `<div class="error-message">${result.message || 'Registration failed. Please try again.'}</div>`;
                }
                
                // Reset button
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            } catch (error) {
                console.error('Registration error:', error);
                messageContainer.innerHTML = '<div class="error-message">An error occurred. Please try again later.</div>';
                
                // Reset button
                const submitButton = registerForm.querySelector('button[type="submit"]');
                submitButton.disabled = false;
                submitButton.textContent = 'Create Account';
            }
        });
    }
    
    // Check for stored authentication on page load
    checkAuthentication();
});

// Password strength checker
function checkPasswordStrength(password) {
    // Initialize variables
    let score = 0;
    let message = '';
    let strengthClass = '';
    
    // Check password length
    if (password.length === 0) {
        return { score: 0, message: 'Password strength', class: '' };
    } else if (password.length < 6) {
        score = 1;
        message = 'Very weak';
        strengthClass = 'very-weak';
    } else {
        score = 2;
        message = 'Weak';
        strengthClass = 'weak';
        
        // Check for mixed case
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
            score++;
        }
        
        // Check for numbers
        if (/\d/.test(password)) {
            score++;
        }
        
        // Check for special characters
        if (/[^a-zA-Z0-9]/.test(password)) {
            score++;
        }
        
        // Adjust score based on length for longer passwords
        if (password.length >= 12) {
            score++;
        }
        
        // Cap the score at 4
        score = Math.min(score, 4);
        
        // Set appropriate message and class based on final score
        if (score === 3) {
            message = 'Medium';
            strengthClass = 'medium';
        } else if (score === 4) {
            message = 'Strong';
            strengthClass = 'strong';
        }
    }
    
    return { score, message, class: strengthClass };
}

// Check if user is already authenticated
function checkAuthentication() {
    const authToken = localStorage.getItem('authToken');
    
    if (authToken) {
        // Verify token validity with server
        fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        })
        .then(response => {
            if (response.ok) {
                // If on login page, redirect to appropriate dashboard
                if (window.location.pathname.includes('login.html')) {
                    response.json().then(data => {
                        if (data.user && data.user.role === 'admin') {
                            window.location.href = '/admin/dashboard.html';
                        } else {
                            window.location.href = '/my-account.html';
                        }
                    });
                }
            } else {
                // Invalid token, clear storage
                localStorage.removeItem('authToken');
                localStorage.removeItem('rememberMe');
            }
        })
        .catch(error => {
            console.error('Authentication verification error:', error);
        });
    }
}