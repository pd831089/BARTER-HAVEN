import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseConfig';
import { useRouter } from 'expo-router';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [initialCheck, setInitialCheck] = useState(true);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const checkSession = async () => {
            await supabase.auth.refreshSession();
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            setLoading(false);
            setInitialCheck(false);
            if (!session && mounted) {
                router.replace('/auth/signIn');
            }
        };
        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setTimeout(() => {
                if (!session && !initialCheck && mounted) {
                    router.replace('/auth/signIn');
                }
            }, 0);
        });

        return () => subscription.unsubscribe();
    }, [initialCheck, mounted]);

    const value = {
        user,
        loading,
        signIn: async (email, password) => {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        },
        signUp: async (email, password) => {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
        },
        signOut: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        },
        signInWithGoogle: async () => {
            const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
            if (error) throw error;
            // The redirect will happen automatically. After redirect, session will be set.
        },
    };

    useEffect(() => {
        const checkAndInsertUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (user) {
                // Check if user exists in users table
                const { data: userProfile } = await supabase
                    .from('users')
                    .select('id')
                    .eq('id', user.id)
                    .maybeSingle();
                if (!userProfile) {
                    // Insert new user
                    await supabase.from('users').insert([
                        {
                            id: user.id,
                            email: user.email,
                            name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                            created_at: new Date().toISOString(),
                        },
                    ]);
                }
            }
        };
        checkAndInsertUser();
    }, [user]);

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};