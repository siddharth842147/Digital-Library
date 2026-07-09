import React, { useState } from 'react';
import { Container, Row, Col, Form, Button, Card, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [validated, setValidated] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        
        if (form.checkValidity() === false) {
            e.stopPropagation();
            setValidated(true);
            return;
        }

        setValidated(true);
        setLoading(true);

        const result = await login(formData.email, formData.password);

        if (result.success) {
            navigate('/dashboard');
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
                                    disabled={loading}
                                    aria-busy={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                                            Logging in...
                                        </>
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
