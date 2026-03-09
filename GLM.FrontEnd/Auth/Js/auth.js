// API Configuration
const API_URL = 'http://localhost:5268';

// Helper to determine root path relative to current page
function getRelativePath(path) {
    // Check if we are in Auth/Html or Dashboard/Html
    const pathname = window.location.pathname;
    
    // Simple heuristic: if we are in 'Auth/Html', we need to go up 2 levels to root.
    // If we are in 'Dashboard/Html', we need to go up 2 levels to root.
    // Normalized paths to root:
    // Auth/Html -> ../../
    // Dashboard/Html -> ../../
    
    return '../../' + path;
}

// Initialize login page
function initLoginPage() {
    const form = document.getElementById('login-form');
    if (form) {
        form.addEventListener('submit', handleLogin);
    }
    
    // Check if already logged in
    if (isLoggedIn()) {
        window.location.href = '../../Dashboard/Html/dashboard.html';
    }
}

// Initialize register page
function initRegisterPage() {
    // Note: error-message IDs are now specific to forms
    const form = document.getElementById('register-form');
    if (form) {
        form.addEventListener('submit', handleRegister);
    }
    
    // Check if already logged in
    if (isLoggedIn()) {
        window.location.href = '../../Dashboard/Html/dashboard.html';
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = document.getElementById('login-btn');
    const errorMsg = document.getElementById('login-error-message') || document.getElementById('error-message');
    
    // Get form data
    const loginData = {
        email: form.email.value.trim(),
        password: form.password.value
    };
    
    // Validate
    if (!loginData.email || !loginData.password) {
        showError(errorMsg, 'Please fill in all fields');
        return;
    }
    
    // Show loading
    setLoading(submitBtn, true);
    hideError(errorMsg);
    
    try {
        const response = await fetch(`${API_URL}/api/Authentication/Login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData),
            credentials: 'include' // Include cookies for refresh token
        });

        const data = await readResponseBody(response);
        
        console.log('Login response:', response.status, data);
        
        if (!response.ok || !data.isAuthenticated) {
            throw new Error(data.message || 'Login failed. Please check your credentials.');
        }
        
        // Save auth data
        saveAuthData(data);
        
        console.log('Login successful, redirecting to dashboard...');
        
        // Redirect to dashboard
        window.location.href = '../../Dashboard/Html/dashboard.html';
        
    } catch (error) {
        console.error('Login error:', error);
        showError(errorMsg, error.message);
        setLoading(submitBtn, false);
    }
}

// Handle register
async function handleRegister(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = document.getElementById('register-btn');
    const errorMsg = document.getElementById('register-error-message') || document.getElementById('error-message');
    
    // Get form data
    const registerData = {
        firstName: form.firstName.value.trim(),
        lastName: form.lastName.value.trim(),
        userName: form.userName.value.trim(),
        email: form.email.value.trim(),
        password: form.password.value
    };
    
    const confirmPassword = form.confirmPassword.value;
    
    // Validate
    if (!registerData.firstName || !registerData.lastName || !registerData.userName || 
        !registerData.email || !registerData.password || !confirmPassword) {
        showError(errorMsg, 'Please fill in all fields');
        return;
    }
    
    if (registerData.password !== confirmPassword) {
        showError(errorMsg, 'Passwords do not match');
        return;
    }
    
    if (registerData.password.length < 6) {
        showError(errorMsg, 'Password must be at least 6 characters long');
        return;
    }
    
    // Show loading
    setLoading(submitBtn, true);
    hideError(errorMsg);
    
    try {
        const response = await fetch(`${API_URL}/api/Authentication/Register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registerData),
            credentials: 'include' // Include cookies for refresh token
        });

        const data = await readResponseBody(response);
        
        console.log('Register response:', response.status, data);
        
        if (!response.ok || !data.isAuthenticated) {
            throw new Error(data.message || 'Registration failed. Please try again.');
        }
        
        // Save auth data
        saveAuthData(data);
        
        console.log('Registration successful, redirecting to dashboard...');
        
        // Redirect to dashboard
        window.location.href = '../../Dashboard/Html/dashboard.html';
        
    } catch (error) {
        console.error('Register error:', error);
        showError(errorMsg, error.message);
        setLoading(submitBtn, false);
    }
}

async function readResponseBody(response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        return await response.json();
    }

    const text = await response.text();
    return {
        isAuthenticated: false,
        message: text || `Request failed with status ${response.status}`
    };
}

// Save authentication data
function saveAuthData(data) {
    console.log('Saving auth data:', data);
    
    // Save with exact property names from API
    if (data.token) localStorage.setItem('authToken', data.token);
    if (data.userName) localStorage.setItem('userName', data.userName);
    if (data.email) localStorage.setItem('userEmail', data.email);
    if (data.expiresOn) localStorage.setItem('tokenExpiry', data.expiresOn);
    
    // If expiresOn is missing, set a default expiry (e.g., 1 hour from now)
    if (!data.expiresOn) {
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 1);
        localStorage.setItem('tokenExpiry', expiry.toISOString());
    }
    
    if (data.userRoles && data.userRoles.length > 0) {
        localStorage.setItem('userRoles', JSON.stringify(data.userRoles));
    }
    
    console.log('Auth data saved. Username:', data.userName);
}

// Check if user is logged in
function isLoggedIn() {
    const token = localStorage.getItem('authToken');
    const expiry = localStorage.getItem('tokenExpiry');
    
    if (!token) {
        console.log('No token found');
        return false;
    }
    
    if (!expiry) {
        console.log('No expiry found');
        return false;
    }
    
    // Check if token is expired
    const expiryDate = new Date(expiry);
    if (expiryDate <= new Date()) {
        console.log('Token expired');
        // Token expired, clear storage
        clearAuthData();
        return false;
    }
    
    return true;
}

// Clear authentication data
function clearAuthData() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('userRoles');
}

// Logout function
function logout() {
    clearAuthData();
    window.location.href = '../../Auth/Html/login.html';
}

// Get auth token
function getAuthToken() {
    return localStorage.getItem('authToken');
}

// Get user info
function getUserInfo() {
    return {
        userName: localStorage.getItem('userName'),
        email: localStorage.getItem('userEmail'),
        roles: JSON.parse(localStorage.getItem('userRoles') || '[]')
    };
}

// Show error message
function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

// Hide error message
function hideError(element) {
    element.classList.remove('show');
    element.textContent = '';
}

// Set loading state
function setLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
    } else {
        button.disabled = false;
        button.classList.remove('loading');
    }
}

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.parentElement.querySelector('.toggle-password');
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Make API request with auth token
async function apiRequest(endpoint, options = {}) {
    const token = getAuthToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });
    
    // If unauthorized, redirect to login
    if (response.status === 401) {
        clearAuthData();
        window.location.href = '../../Auth/Html/login.html';
        throw new Error('Session expired. Please login again.');
    }
    
    return response;
}
