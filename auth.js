// Auth UI Elements
const authActions = document.getElementById('authActions');
const userInfo = document.getElementById('userInfo');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');

const authModal = document.getElementById('authModal');
const authForm = document.getElementById('authForm');
const authModalTitle = document.getElementById('authModalTitle');
const authEmail = document.getElementById('authEmail');
const authUsername = document.getElementById('authUsername');
const authPassword = document.getElementById('authPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authCancelBtn = document.getElementById('authCancelBtn');
const authToggleBtn = document.getElementById('authToggleBtn');
const authToggleText = document.getElementById('authToggleText');

let isRegisterMode = false;
let currentUser = null;

// Open login modal
function openLoginModal() {
    isRegisterMode = false;
    updateAuthModal();
    authModal.classList.add('open');
    authEmail.focus();
}

// Open register modal
function openRegisterModal() {
    isRegisterMode = true;
    updateAuthModal();
    authModal.classList.add('open');
    authEmail.focus();
}

// Close auth modal
function closeAuthModal() {
    authModal.classList.remove('open');
    authForm.reset();
}

// Update modal content based on mode
function updateAuthModal() {
    if (isRegisterMode) {
        authModalTitle.textContent = 'Регистрация';
        authSubmitBtn.textContent = 'Зарегистрироваться';
        authUsername.style.display = 'block';
        authToggleText.textContent = 'Уже есть аккаунт?';
        authToggleBtn.textContent = 'Войти';
    } else {
        authModalTitle.textContent = 'Вход';
        authSubmitBtn.textContent = 'Войти';
        authUsername.style.display = 'none';
        authToggleText.textContent = 'Нет аккаунта?';
        authToggleBtn.textContent = 'Регистрация';
    }
}

// Handle auth form submission
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = authEmail.value.trim();
    const password = authPassword.value.trim();
    const username = authUsername.value.trim();

    if (!email || !password) {
        alert('Заполните все поля');
        return;
    }

    if (isRegisterMode && !username) {
        alert('Введите имя пользователя');
        return;
    }

    // Check if Supabase is initialized
    if (!window.supabaseClient) {
        alert('Ошибка: Supabase не инициализирован. Проверьте интернет-соединение и перезагрузите страницу.');
        console.error('Supabase client not initialized');
        return;
    }

    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = 'Загрузка...';

    try {
        if (isRegisterMode) {
            console.log('Attempting to sign up...');
            const result = await signUpUser(username, email, password);
            
            if (result.success) {
                alert('Регистрация успешна! Проверьте почту для подтверждения.');
                console.log('Sign up successful');
                closeAuthModal();
            } else {
                console.error('Sign up failed:', result.error);
                alert('Ошибка: ' + result.error);
            }
        } else {
            console.log('Attempting to sign in...');
            const result = await signInUser(email, password);
            
            if (result.success) {
                console.log('Sign in successful');
                currentUser = result.user;
                closeAuthModal();
                updateAuthUI();
            } else {
                console.error('Sign in failed:', result.error);
                alert('Ошибка входа: ' + result.error);
            }
        }
    } catch (error) {
        console.error('Auth error:', error);
        alert('Произошла ошибка. Попробуйте позже.');
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = isRegisterMode ? 'Зарегистрироваться' : 'Войти';
    }
});

// Toggle between login and register
authToggleBtn.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    updateAuthModal();
});

// Cancel auth
authCancelBtn.addEventListener('click', closeAuthModal);

// Close modal when clicking outside
authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
        closeAuthModal();
    }
});

// Login button
loginBtn.addEventListener('click', openLoginModal);

// Register button
registerBtn.addEventListener('click', openRegisterModal);

// Logout button
logoutBtn.addEventListener('click', async () => {
    const result = await signOutUser();
    
    if (result.success) {
        currentUser = null;
        updateAuthUI();
    } else {
        alert('Ошибка при выходе: ' + result.error);
    }
});

// Update UI based on auth state
function updateAuthUI() {
    if (currentUser) {
        // Hide login buttons, show user info
        authActions.style.display = 'none';
        userInfo.style.display = 'flex';
        userEmail.textContent = currentUser.email;
        
        // Load user balance
        if (typeof loadUserBalance === 'function') {
            loadUserBalance(currentUser.id);
        }
    } else {
        // Show login buttons, hide user info
        authActions.style.display = 'flex';
        userInfo.style.display = 'none';
        
        // Reset to local data
        if (typeof resetToLocalData === 'function') {
            resetToLocalData();
        }
    }
}

// Check auth on page load
async function initAuth() {
    console.log('Initializing auth...');
    
    // Wait a bit for Supabase to initialize
    let attempts = 0;
    while (!window.supabaseClient && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (!window.supabaseClient) {
        console.warn('⚠️ Supabase not ready - using offline mode');
        updateAuthUI();
        return;
    }

    console.log('Supabase ready, checking session...');
    const session = await checkAuth();
    
    if (session) {
        console.log('User session found:', session.user.email);
        currentUser = session.user;
        updateAuthUI();
    } else {
        console.log('No session found');
        updateAuthUI();
    }
}

// Callback when user logs in
function onUserLoggedIn(user) {
    currentUser = user;
    updateAuthUI();
}

// Callback when user logs out
function onUserLoggedOut() {
    currentUser = null;
    updateAuthUI();
}

// Initialize auth on page load
window.addEventListener('DOMContentLoaded', initAuth);
