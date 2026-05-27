import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Loading from './components/Loading';
import Chatbot from './components/Chatbot';
import SessionExpiryModal from './components/SessionExpiryModal';

// Pages (Lazy Loaded)
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Books = lazy(() => import('./pages/Books'));
const BookDetails = lazy(() => import('./pages/BookDetails'));
const MyBooks = lazy(() => import('./pages/MyBooks'));
const Payment = lazy(() => import('./pages/Payment'));
const PaymentHistory = lazy(() => import('./pages/PaymentHistory'));
const Profile = lazy(() => import('./pages/Profile'));
const Policy = lazy(() => import('./pages/Policy'));
const AcademicResources = lazy(() => import('./pages/AcademicResources'));

// Admin Pages (Lazy Loaded)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ManageBooks = lazy(() => import('./pages/admin/ManageBooks'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const BorrowManagement = lazy(() => import('./pages/admin/BorrowManagement'));
const VerifyPayments = lazy(() => import('./pages/admin/VerifyPayments'));
const ManageHolidays = lazy(() => import('./pages/admin/ManageHolidays'));
const ManageResources = lazy(() => import('./pages/admin/ManageResources'));

// Protected Route Component
const ProtectedRoute = ({ children, roles = [] }) => {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) {
        return <Loading />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    if (roles.length > 0 && !roles.includes(user?.role)) {
        return <Navigate to="/dashboard" />;
    }

    return children;
};

// Public Route Component (redirect if authenticated)
const PublicRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <Loading />;
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" />;
    }

    return children;
};

function AppContent() {
    const { showSessionExpired, setShowSessionExpired } = useAuth();

    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="app">
                <Navbar />
                <main style={{ minHeight: '80vh' }}>
                    <Suspense fallback={<Loading />}>
                        <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<Home />} />
                        <Route path="/books" element={<Books />} />
                        <Route path="/books/:id" element={<BookDetails />} />
                        <Route path="/policy" element={<Policy />} />
                        <Route path="/resources" element={<AcademicResources />} /> {/* Added public route for Policy */}

                        <Route
                            path="/login"
                            element={
                                <PublicRoute>
                                    <Login />
                                </PublicRoute>
                            }
                        />
                        <Route
                            path="/register"
                            element={
                                <PublicRoute>
                                    <Register />
                                </PublicRoute>
                            }
                        />

                        {/* Protected Routes - All Users */}
                        <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute>
                                    <Dashboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/my-books"
                            element={
                                <ProtectedRoute>
                                    <MyBooks />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/payment"
                            element={
                                <ProtectedRoute>
                                    <Payment />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/payment-history"
                            element={
                                <ProtectedRoute>
                                    <PaymentHistory />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/profile"
                            element={
                                <ProtectedRoute>
                                    <Profile />
                                </ProtectedRoute>
                            }
                        />

                        {/* Admin/Librarian Routes */}
                        <Route
                            path="/admin/dashboard"
                            element={
                                <ProtectedRoute roles={['admin', 'librarian']}>
                                    <AdminDashboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/books"
                            element={
                                <ProtectedRoute roles={['admin', 'librarian']}>
                                    <ManageBooks />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/users"
                            element={
                                <ProtectedRoute roles={['admin']}>
                                    <ManageUsers />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/borrows"
                            element={
                                <ProtectedRoute roles={['admin', 'librarian']}>
                                    <BorrowManagement />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/verify-payments"
                            element={
                                <ProtectedRoute roles={['admin', 'librarian']}>
                                    <VerifyPayments />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/holidays"
                            element={
                                <ProtectedRoute roles={['admin']}>
                                    <ManageHolidays />
                                </ProtectedRoute>
                            }
                        />

                        {/* 404 */}
                        <Route
                            path="/admin/resources"
                            element={
                                <ProtectedRoute roles={['admin', 'librarian']}>
                                    <ManageResources />
                                </ProtectedRoute>
                            }
                        />
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                    </Suspense>
                </main>
                <Footer />
                <SessionExpiryModal 
                    show={showSessionExpired} 
                    onHide={() => setShowSessionExpired(false)} 
                />
            </div>
        </Router>
    );
}

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <AppContent />
                <Chatbot />
                <ToastContainer
                    position="top-right"
                    autoClose={3000}
                    hideProgressBar={false}
                    newestOnTop
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="colored"
                />
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
