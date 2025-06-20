// reservation.js - Waffle Heaven Restaurant

document.addEventListener('DOMContentLoaded', function() {
    // Get references to DOM elements
    const reservationForm = document.getElementById('reservation-form');
    const dateInput = document.getElementById('reservation-date');
    const timeInput = document.getElementById('reservation-time');
    const guestsInput = document.getElementById('reservation-guests');
    const specialRequestsInput = document.getElementById('special-requests');
    const availabilityMessage = document.getElementById('availability-message');
    const submitButton = document.getElementById('submit-reservation');
    
    // Set minimum date to today
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    dateInput.min = formattedDate;
    
    // Maximum date (6 months from now)
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 6);
    dateInput.max = maxDate.toISOString().split('T')[0];
    
    // Check availability when date or time changes
    dateInput.addEventListener('change', checkAvailability);
    timeInput.addEventListener('change', checkAvailability);
    guestsInput.addEventListener('change', checkAvailability);
    
    // Function to check reservation availability
    function checkAvailability() {
        const date = dateInput.value;
        const time = timeInput.value;
        const guests = guestsInput.value;
        
        if (!date || !time || !guests) {
            return; // Don't check if all fields aren't filled
        }
        
        // Show loading state
        availabilityMessage.textContent = "Checking availability...";
        availabilityMessage.className = "message info";
        submitButton.disabled = true;
        
        // Make API request to check availability
        fetch('/api/reservations/check-availability', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: date,
                time: time,
                guests: parseInt(guests)
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.available) {
                availabilityMessage.textContent = "Tables available! You can proceed with your reservation.";
                availabilityMessage.className = "message success";
                submitButton.disabled = false;
            } else {
                availabilityMessage.textContent = data.message || "Sorry, no tables available for the selected time and party size.";
                availabilityMessage.className = "message error";
                submitButton.disabled = true;
            }
        })
        .catch(error => {
            console.error('Error checking availability:', error);
            availabilityMessage.textContent = "Unable to check availability. Please try again later.";
            availabilityMessage.className = "message error";
            submitButton.disabled = true;
        });
    }
    
    // Form submission handler
    reservationForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validate form
        if (!validateReservationForm()) {
            return;
        }
        
        // Prepare reservation data
        const reservationData = {
            date: dateInput.value,
            time: timeInput.value,
            guests: parseInt(guestsInput.value),
            specialRequests: specialRequestsInput.value,
            // Additional customer info collected from the form
            name: document.getElementById('customer-name').value,
            email: document.getElementById('customer-email').value,
            phone: document.getElementById('customer-phone').value
        };
        
        // Disable form while submitting
        const formElements = reservationForm.elements;
        for (let i = 0; i < formElements.length; i++) {
            formElements[i].disabled = true;
        }
        
        // Show loading state
        submitButton.innerHTML = '<span class="spinner"></span> Processing...';
        
        // Submit reservation
        fetch('/api/reservations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(reservationData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.message || 'Failed to create reservation');
                });
            }
            return response.json();
        })
        .then(data => {
            // Show success message
            reservationForm.innerHTML = `
                <div class="reservation-confirmation">
                    <h3>Reservation Confirmed!</h3>
                    <p>Thank you for your reservation at Waffle Heaven.</p>
                    <div class="reservation-details">
                        <p><strong>Reservation ID:</strong> ${data.reservationId}</p>
                        <p><strong>Date:</strong> ${formatDate(data.date)}</p>
                        <p><strong>Time:</strong> ${data.time}</p>
                        <p><strong>Party Size:</strong> ${data.guests} guests</p>
                    </div>
                    <p>A confirmation email has been sent to ${data.email}.</p>
                    <p>You can manage your reservation by visiting your account or using the link in your email.</p>
                    <button type="button" class="btn primary-btn" onclick="window.print()">Print Confirmation</button>
                    <button type="button" class="btn secondary-btn" onclick="window.location.href='/'">Return to Home</button>
                </div>
            `;
        })
        .catch(error => {
            console.error('Error creating reservation:', error);
            
            // Re-enable form
            for (let i = 0; i < formElements.length; i++) {
                formElements[i].disabled = false;
            }
            
            // Reset submit button
            submitButton.innerHTML = 'Make Reservation';
            
            // Show error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = error.message || 'Failed to create your reservation. Please try again.';
            
            // Insert error message at top of form
            reservationForm.insertBefore(errorDiv, reservationForm.firstChild);
            
            // Remove error message after 5 seconds
            setTimeout(() => {
                if (errorDiv.parentNode === reservationForm) {
                    reservationForm.removeChild(errorDiv);
                }
            }, 5000);
        });
    });
    
    // Form validation
    function validateReservationForm() {
        let isValid = true;
        
        // Reset previous error messages
        const errorMessages = document.querySelectorAll('.field-error');
        errorMessages.forEach(el => el.remove());
        
        // Check required fields
        const requiredFields = [
            { field: document.getElementById('customer-name'), message: 'Please enter your name' },
            { field: document.getElementById('customer-email'), message: 'Please enter your email' },
            { field: document.getElementById('customer-phone'), message: 'Please enter your phone number' },
            { field: dateInput, message: 'Please select a date' },
            { field: timeInput, message: 'Please select a time' },
            { field: guestsInput, message: 'Please enter the number of guests' }
        ];
        
        requiredFields.forEach(item => {
            if (!item.field.value.trim()) {
                showError(item.field, item.message);
                isValid = false;
            }
        });
        
        // Email validation
        const emailField = document.getElementById('customer-email');
        if (emailField.value && !isValidEmail(emailField.value)) {
            showError(emailField, 'Please enter a valid email address');
            isValid = false;
        }
        
        // Phone validation
        const phoneField = document.getElementById('customer-phone');
        if (phoneField.value && !isValidPhone(phoneField.value)) {
            showError(phoneField, 'Please enter a valid phone number');
            isValid = false;
        }
        
        // Guest number validation
        if (guestsInput.value) {
            const guests = parseInt(guestsInput.value);
            if (isNaN(guests) || guests < 1 || guests > 20) {
                showError(guestsInput, 'Please enter a number between 1 and 20');
                isValid = false;
            }
        }
        
        return isValid;
    }
    
    // Helper function to show field errors
    function showError(field, message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        field.parentNode.appendChild(errorElement);
        field.classList.add('error');
        
        // Remove error class when field is focused
        field.addEventListener('focus', function() {
            field.classList.remove('error');
            if (errorElement.parentNode) {
                errorElement.parentNode.removeChild(errorElement);
            }
        }, { once: true });
    }
    
    // Email validation helper
    function isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
    
    // Phone validation helper
    function isValidPhone(phone) {
        // This is a simple validation for South African phone numbers
        // Adjust based on your requirements
        const regex = /^(\+27|0)[1-9][0-9]{8}$/;
        return regex.test(phone);
    }
    
    // Date formatting helper
    function formatDate(dateString) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-ZA', options);
    }
    
    // Time slot generation
    function populateTimeSlots() {
        // Restaurant hours
        const openingTime = 9; // 9 AM
        const closingTime = 21; // 9 PM
        const interval = 30; // 30-minute intervals
        
        // Clear existing options except the default
        while (timeInput.options.length > 1) {
            timeInput.options.remove(1);
        }
        
        // Generate time slots
        for (let hour = openingTime; hour < closingTime; hour++) {
            for (let minute = 0; minute < 60; minute += interval) {
                const formattedHour = hour.toString().padStart(2, '0');
                const formattedMinute = minute.toString().padStart(2, '0');
                const timeValue = `${formattedHour}:${formattedMinute}`;
                
                // Create display time (12-hour format)
                let displayHour = hour;
                const period = hour >= 12 ? 'PM' : 'AM';
                if (displayHour > 12) displayHour -= 12;
                if (displayHour === 0) displayHour = 12;
                
                const displayTime = `${displayHour}:${formattedMinute} ${period}`;
                
                // Add option to select
                const option = new Option(displayTime, timeValue);
                timeInput.appendChild(option);
            }
        }
    }
    
    // Initialize time slots
    populateTimeSlots();
});