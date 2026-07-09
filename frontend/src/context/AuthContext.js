import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showSessionExpired, setShowSessionExpired] = useState(false);

    axios.defaults.withCredentials = true;

    // Helper to extract a safe error message
    const getSafeErrorMessage = (error, defaultMessage) => {
        const msg = error.response?.data?.message;
        if (typeof msg === 'string' && msg.length < 100) return msg;
        return defaultMessage;
    };

    const fetchCsrfToken = async () => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/csrf-token`);
            axios.defaults.headers.common['x-csrf-token'] = res.data.csrfToken;
        } catch (error) {
            console.error('Failed to fetch CSRF token', error);
        }
    };

    // Load user data
    const loadUser = useCallback(async () => {
        try {
            await fetchCsrfToken();
            const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/me`);
            setUser(res.data.data);
        } catch (error) {
            console.error('Error loading user:', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUser();

        const interceptor = axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
                if (error.response?.status === 401 && originalRequest && !originalRequest._retry && originalRequest.url !== `${apiUrl}/auth/login` && originalRequest.url !== `${apiUrl}/auth/refresh`) {
                    originalRequest._retry = true;
                    try {
                        await axios.post(`${apiUrl}/auth/refresh`);
                        return axios(originalRequest);
                    } catch (refreshError) {
                        setUser(null);
                        // Show modal if they were previously authenticated
                        setShowSessionExpired(true);
                        return Promise.reject(refreshError);
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, [loadUser]);

    // Login
    const login = async (email, password) => {
        try {
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/auth/login`, {
                email,
                password
            });

            const { user } = res.data;
            setUser(user);

            toast.success('Login successful!');
            return { success: true, user };
        } catch (error) {
            const message = getSafeErrorMessage(error, 'Login failed. Please check your credentials.');
            toast.error(message);
            return { success: false, message };
        }
    };

    // Register
    const register = async (userData) => {
        try {
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/auth/register`, userData);
            // Backend now returns token and user immediately (OTP disabled)
            const { user } = res.data;
            setUser(user);
            toast.success('Registration successful!');
            return { success: true, user };
        } catch (error) {
            const message = getSafeErrorMessage(error, 'Registration failed. Please try again.');
            toast.error(message);
            return { success: false, message };
        }
    };

    // Verify OTP for registration
    const verifyOtp = async (userId, otp) => {
        try {
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/auth/verify-otp`, { userId, otp });
            const { user } = res.data;
            setUser(user);
            toast.success('OTP verified! Registration complete.');
            return { success: true, user };
        } catch (error) {
            const message = getSafeErrorMessage(error, 'OTP verification failed');
            toast.error(message);
            return { success: false, message };
        }
    };

    // Logout
    const logout = async () => {
        try {
            await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/logout`);
        } catch (err) {
            console.error('Logout error:', err);
        }
        setUser(null);
        toast.info('Logged out successfully');
    };

    // Update user profile
    const updateProfile = async (userData) => {
        try {
            const res = await axios.put(`${process.env.REACT_APP_API_URL}/auth/update-details`, userData);
            setUser(res.data.data);
            toast.success('Profile updated successfully!');
            return { success: true };
        } catch (error) {
            const message = getSafeErrorMessage(error, 'Profile update failed. Please try again.');
            toast.error(message);
            return { success: false, message };
        }
    };

    // Update password
    const updatePassword = async (currentPassword, newPassword) => {
        try {
            await axios.put(`${process.env.REACT_APP_API_URL}/auth/update-password`, {
                currentPassword,
                newPassword
            });
            toast.success('Password updated successfully!');
            return { success: true };
        } catch (error) {
            const message = getSafeErrorMessage(error, 'Password update failed. Please check your current password.');
            toast.error(message);
            return { success: false, message };
        }
    };

    // Forgot password
    const forgotPassword = async (email) => {
        try {
            await axios.post(`${process.env.REACT_APP_API_URL}/auth/forgot-password`, { email });
            toast.success('Password reset email sent!');
            return { success: true };
        } catch (error) {
            const message = getSafeErrorMessage(error, 'Password reset request failed.');
            toast.error(message);
            return { success: false, message };
        }
    };

    const value = {
        user,
        loading,
        login,
        register,
        verifyOtp,
        logout,
        updateProfile,
        updatePassword,
        forgotPassword,
        showSessionExpired,
        setShowSessionExpired,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isLibrarian: user?.role === 'librarian' || user?.role === 'admin',
        isStudent: user?.role === 'student'
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
