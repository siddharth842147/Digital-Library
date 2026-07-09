import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Container, Nav, Navbar as BSNavbar, NavDropdown } from 'react-bootstrap';
import { FiBook, FiSun, FiMoon, FiUser, FiLogOut, FiHome, FiGrid, FiGlobe } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

const Navbar = () => {
    const { isAuthenticated, user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <BSNavbar expand="lg" className="navbar" sticky="top">
            <Container>
                <BSNavbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2 gap-md-3">
                    <div className="logo-container" style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: 'white',
                        padding: '3px',
                        boxShadow: 'var(--shadow-sm)',
                        border: '2px solid var(--primary-light)'
                    }}>
                        <img
                            src={`${process.env.PUBLIC_URL}/logo.jpg`}
                            alt="JVIT Logo"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={(e) => { e.target.src = "https://placehold.co/150x150/065f46/ffffff?text=JVIT"; }}
                        />
                    </div>
                    <div className="d-flex flex-column justify-content-center">
                        <span style={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1, color: 'var(--primary-dark)', letterSpacing: '-0.5px' }}>JVIT Library</span>
                        <span className="d-none d-sm-block" style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Knowledge Hub</span>
                    </div>
                </BSNavbar.Brand>

                <BSNavbar.Toggle aria-controls="basic-navbar-nav" className="border-0 shadow-none" aria-label="Toggle navigation">
                    <span className="navbar-toggler-icon" style={{ width: '1.2em', height: '1.2em' }}></span>
                </BSNavbar.Toggle>

                <BSNavbar.Collapse id="basic-navbar-nav">
                    <Nav className="ms-auto align-items-center gap-3">
                        <Nav.Link as={Link} to="/">
                            <FiHome className="me-1" /> Home
                        </Nav.Link>
                        <Nav.Link as={Link} to="/books">
                            <FiBook className="me-1" /> {t('Library')}
                        </Nav.Link>
                        <Nav.Link as={Link} to="/policy">Library Policy</Nav.Link>
                        <Nav.Link as={Link} to="/resources">{t('Resources')}</Nav.Link>

                        {isAuthenticated ? (
                            <>
                                <Nav.Link as={Link} to="/dashboard">
                                    <FiGrid className="me-1" /> {t('Dashboard')}
                                </Nav.Link>

                                {user?.role === 'student' && (
                                    <Nav.Link as={Link} to="/my-books">
                                        {t('My Books')}
                                    </Nav.Link>
                                )}

                                {(user?.role === 'admin' || user?.role === 'librarian') && (
                                    <NavDropdown title="Admin" id="admin-dropdown">
                                        <NavDropdown.Item as={Link} to="/admin/dashboard">
                                            Dashboard
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/books">
                                            Manage Books
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/holidays">
                                            Manage Holidays
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/resources">
                                            Manage Resources
                                        </NavDropdown.Item>
                                        {user?.role === 'admin' && (
                                            <>
                                                <NavDropdown.Item as={Link} to="/admin/users">
                                                    Manage Users
                                                </NavDropdown.Item>
                                                <NavDropdown.Item as={Link} to="/admin/holidays">
                                                    Manage Holidays
                                                </NavDropdown.Item>
                                            </>
                                        )}
                                        <NavDropdown.Item as={Link} to="/admin/borrows">
                                            Borrow Management
                                        </NavDropdown.Item>
                                        <NavDropdown.Divider />
                                        <NavDropdown.Item as={Link} to="/admin/verify-payments">
                                            Verify Payments
                                        </NavDropdown.Item>
                                    </NavDropdown>
                                )}

                                <NavDropdown
                                    title={
                                        <span className="profile-name-glow">
                                            <FiUser className="me-1" /> {user?.name}
                                        </span>
                                    }
                                    id="user-dropdown"
                                >
                                    <NavDropdown.Item as={Link} to="/profile">
                                        Profile
                                    </NavDropdown.Item>
                                    <NavDropdown.Item as={Link} to="/payment-history">
                                        {t('Payment History')}
                                    </NavDropdown.Item>
                                    <NavDropdown.Divider />
                                    <NavDropdown.Item onClick={handleLogout}>
                                        <FiLogOut className="me-1" /> {t('Logout')}
                                    </NavDropdown.Item>
                                </NavDropdown>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="btn btn-outline">
                                    {t('Login')}
                                </Link>
                                <Link to="/register" className="btn btn-primary">
                                    {t('Register')}
                                </Link>
                            </>
                        )}

                        <NavDropdown
                            title={<FiGlobe size={20} aria-hidden="true" />}
                            id="language-dropdown"
                            align="end"
                            aria-label="Select Language"
                        >
                            <NavDropdown.Item onClick={() => i18n.changeLanguage('en')}>
                                English
                            </NavDropdown.Item>
                            <NavDropdown.Item onClick={() => i18n.changeLanguage('hi')}>
                                हिंदी (Hindi)
                            </NavDropdown.Item>
                        </NavDropdown>

                        <button
                            onClick={toggleTheme}
                            className="btn btn-outline theme-toggle-btn"
                            style={{
                                padding: '0.5rem',
                                borderRadius: 'var(--radius-full)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            aria-label="Toggle theme"
                        >
                            {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
                        </button>
                    </Nav>
                </BSNavbar.Collapse>
            </Container >
        </BSNavbar >
    );
};

export default Navbar;
