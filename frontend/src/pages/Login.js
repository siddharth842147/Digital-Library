import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Spinner, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiAlertCircle, FiClock } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [validated, setValidated] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState('');
    const [warningMessage, setWarningMessage] = useState('');
    const [isLocked, setIsLocked] = useState(false);
    const [lockUntilDate, setLockUntilDate] = useState(null);
    const [countdown, setCountdown] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    // Lockout countdown timer
    useEffect(() => {
        if (!lockUntilDate) return;

        const updateCountdown = () => {
            const diff = new Date(lockUntilDate).getTime() - Date.now();
            if (diff <= 0) {
                setIsLocked(false);
                setLockUntilDate(null);
                setCountdown('');
                setServerError('');
            } else {
                const totalSeconds = Math.floor(diff / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                setCountdown(`${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [lockUntilDate]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isLocked) return;

        const form = e.currentTarget;
        
        if (form.checkValidity() === false) {
            e.stopPropagation();
            setValidated(true);
            return;
        }

        setValidated(true);
        setLoading(true);
        setServerError('');
        setWarningMessage('');

        const result = await login(formData.email, formData.password);

        if (result.success) {
            navigate('/dashboard');
        } else {
            if (result.status === 423 || result.locked) {
                setIsLocked(true);
                setServerError(result.message || 'Account locked due to multiple failed attempts.');
                if (result.lockUntil) {
                    setLockUntilDate(result.lockUntil);
                }
            } else {
                setServerError(result.message);
                if (result.warning) {
                    setWarningMessage(result.warning);
                }
            }
        }

        setLoading(false);
    };

    return (
        <div style={{ padding: '4rem 0', minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
            <Container>
                <Row className="justify-content-center">
                    <Col md={6} lg={5}>
                        <Card className="card fade-in" style={{ padding: '2rem' }}>
                            <div className="text-center mb-4">
                                <h2 style={{ fontWeight: 700 }}>Welcome Back</h2>
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    Login to access your library account
                                </p>
                            </div>

                            {/* Lockout Warning Banner */}
                            {isLocked && (
                                <Alert variant="danger" className="d-flex align-items-center mb-3">
                                    <FiClock className="me-2 flex-shrink-0" size={20} />
                                    <div>
                                        <div><strong>Account Temporarily Locked</strong></div>
                                        <div>{serverError}</div>
                                        {countdown && (
                                            <div className="mt-1" style={{ fontWeight: 600 }}>
                                                Time remaining: {countdown}
                                            </div>
                                        )}
                                    </div>
                                </Alert>
                            )}

                            {/* Standard Error Alert */}
                            {!isLocked && serverError && (
                                <Alert variant="danger" className="d-flex align-items-center mb-3">
                                    <FiAlertCircle className="me-2 flex-shrink-0" size={20} />
                                    <div>{serverError}</div>
                                </Alert>
                            )}

                            {/* Remaining Attempts Warning */}
                            {!isLocked && warningMessage && (
                                <Alert variant="warning" className="d-flex align-items-center mb-3">
                                    <FiAlertCircle className="me-2 flex-shrink-0" size={20} />
                                    <div>
                                        <strong>Warning:</strong> {warningMessage}
                                    </div>
                                </Alert>
                            )}

                            <Form noValidate validated={validated} onSubmit={handleSubmit} aria-label="Login Form">
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label">
                                        <FiMail className="me-2" />
                                        Email Address
                                    </Form.Label>
                                    <Form.Control
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="Enter your email"
                                        required
                                        className="form-control"
                                        aria-label="Email Address"
                                        aria-required="true"
                                        autoComplete="email"
                                    />
                                    <Form.Control.Feedback type="invalid">
                                        Please provide a valid email address.
                                    </Form.Control.Feedback>
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label">
                                        <FiLock className="me-2" />
                                        Password
                                    </Form.Label>
                                    <Form.Control
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="Enter your password"
                                        required
                                        className="form-control"
                                        aria-label="Password"
                                        aria-required="true"
                                        autoComplete="current-password"
                                    />
                                    <Form.Control.Feedback type="invalid">
                                        Please provide your password.
                                    </Form.Control.Feedback>
                                </Form.Group>

                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <Form.Check
                                        type="checkbox"
                                        label="Remember me"
                                    />
                                    <Link to="/forgot-password" style={{ fontSize: '0.9rem' }}>
                                        Forgot Password?
                                    </Link>
                                </div>

                                <Button
                                    type="submit"
                                    className="btn btn-primary w-100 mb-3 d-flex justify-content-center align-items-center gap-2"
                                    disabled={loading || isLocked}
                                    aria-busy={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                                            Logging in...
                                        </>
                                    ) : isLocked ? (
                                        `Locked (${countdown || 'Please wait'})`
                                    ) : 'Login'}
                                </Button>

                                <div className="text-center">
                                    <p style={{ color: 'var(--text-secondary)' }}>
                                        Don't have an account?{' '}
                                        <Link to="/register">Register here</Link>
                                    </p>
                                </div>
                            </Form>


                        </Card>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default Login;
