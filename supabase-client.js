// Wait for Supabase to load from CDN
async function initSupabase() {
    // Supabase configuration
    const SUPABASE_URL = 'https://asnnnoojgbpnjqcweewy.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_-Tf34VGic2cRNmkpZFeI2A_S7HCJffV';

    // Wait for supabase to be loaded from CDN
    let attempts = 0;
    while ((!window.supabase || !window.supabase.createClient) && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (!window.supabase || !window.supabase.createClient) {
        console.error('Supabase library failed to load after 5 seconds');
        console.error('window.supabase:', window.supabase);
        return false;
    }

    try {
        console.log('Supabase library loaded successfully');
        
        // Initialize Supabase client
        const { createClient } = window.supabase;
        window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client created:', window.supabaseClient);
        
        return true;
    } catch (error) {
        console.error('Error creating Supabase client:', error);
        return false;
    }
}

// Ensure supabase is initialized
console.log('Starting Supabase initialization...');
initSupabase().then(success => {
    if (success) {
        console.log('✓ Supabase initialized successfully');
    } else {
        console.error('✗ Failed to initialize Supabase');
    }
}).catch(err => {
    console.error('✗ Error initializing Supabase:', err);
});

const getSupabase = () => window.supabaseClient;


// Check if user is logged in
async function checkAuth() {
    const client = getSupabase();
    if (!client) return null;
    
    const { data: { session }, error } = await client.auth.getSession();
    
    if (error) {
        console.error('Auth error:', error);
        return null;
    }
    
    return session;
}

// Sign up new user
async function signUpUser(username, email, password) {
    const client = getSupabase();
    if (!client) {
        return { success: false, error: 'Supabase not initialized' };
    }
    
    try {
        // Create auth user
        const { data, error: authError } = await client.auth.signUp({
            email: email,
            password: password
        });

        if (authError) {
            console.error('Sign up error:', authError);
            return { success: false, error: authError.message };
        }

        // Create user profile
        const { error: profileError } = await client
            .from('user_profiles')
            .insert({
                id: data.user.id,
                username: username,
                balance: 100.00
            });

        if (profileError) {
            console.error('Profile error:', profileError);
            return { success: false, error: profileError.message };
        }

        return { success: true, user: data.user };
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: error.message };
    }
}

// Sign in user
async function signInUser(email, password) {
    const client = getSupabase();
    if (!client) {
        return { success: false, error: 'Supabase not initialized' };
    }
    
    try {
        const { data, error } = await client.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            console.error('Sign in error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, user: data.user };
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: error.message };
    }
}

// Sign out user
async function signOutUser() {
    const client = getSupabase();
    if (!client) {
        return { success: false, error: 'Supabase not initialized' };
    }
    
    try {
        const { error } = await client.auth.signOut();
        
        if (error) {
            console.error('Sign out error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: error.message };
    }
}

// Get user balance
async function getUserBalance(userId) {
    const client = getSupabase();
    if (!client) return null;
    
    try {
        const { data, error } = await client
            .from('user_profiles')
            .select('balance')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Balance fetch error:', error);
            return null;
        }

        return data?.balance || 0;
    } catch (error) {
        console.error('Unexpected error:', error);
        return null;
    }
}

// Update user balance
async function updateUserBalance(userId, newBalance) {
    const client = getSupabase();
    if (!client) return false;
    
    try {
        const { error } = await client
            .from('user_profiles')
            .update({ balance: newBalance, updated_at: new Date() })
            .eq('id', userId);

        if (error) {
            console.error('Balance update error:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Unexpected error:', error);
        return false;
    }
}

// Save bet to history
async function saveBetHistory(userId, betAmount, percent, result) {
    const client = getSupabase();
    if (!client) return false;
    
    try {
        const { error } = await client
            .from('bet_history')
            .insert({
                user_id: userId,
                bet_amount: betAmount,
                percent: percent,
                result: result
            });

        if (error) {
            console.error('History save error:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Unexpected error:', error);
        return false;
    }
}

// Get user bet history
async function getUserBetHistory(userId, limit = 10) {
    const client = getSupabase();
    if (!client) return [];
    
    try {
        const { data, error } = await client
            .from('bet_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('History fetch error:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Unexpected error:', error);
        return [];
    }
}

// Clear user bet history
async function clearBetHistory(userId) {
    const client = getSupabase();
    if (!client) return false;
    
    try {
        const { error } = await client
            .from('bet_history')
            .delete()
            .eq('user_id', userId);

        if (error) {
            console.error('History clear error:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Unexpected error:', error);
        return false;
    }
}

// Subscribe to auth changes
async function setupAuthListener() {
    // Wait for Supabase to be ready
    let attempts = 0;
    while (!window.supabaseClient && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    const client = getSupabase();
    if (!client) {
        console.error('Supabase client still not ready for auth listener');
        return;
    }
    
    client.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (session) {
            // User logged in
            console.log('User logged in:', session.user.id);
            if (typeof onUserLoggedIn === 'function') {
                onUserLoggedIn(session.user);
            }
        } else {
            // User logged out
            console.log('User logged out');
            if (typeof onUserLoggedOut === 'function') {
                onUserLoggedOut();
            }
        }
    });
}

// Initialize auth listener when Supabase is ready
setTimeout(setupAuthListener, 1000);


// Initialize auth listener when Supabase is ready
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupAuthListener, 500);
});