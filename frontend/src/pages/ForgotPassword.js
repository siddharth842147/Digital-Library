import React, { useState } from 'react';
import { Container, Row, Col, Form, Button, Card, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiKey, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const ForgotPassword = () => {
    const [step, setStep] = useState(1); // 1: Send OTP, 2: Reset Password
    const [validated, setValidated] = useState(false);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const { forgotPassword, resetPasswordOtp } = useAuth();
    const navigate = useNavigate();

    const handleSendOtp = async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        
        if (form.checkValidity() === false) {
            e.stopPropagation();
            setValidated(true);
            return;
        }

        setValidated(true);
        setLoading(true);

        const result = await forgotPassword(email);

        if (result.success) {
            setStep(2);
            setValidated(false); // Reset validation for next step
        }

        setLoading(false);
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        
        if (form.checkValidity() === false) {
            e.stopPropagation();
            setValidated(true);
            return;
        }

        if (password !== confirmPassword) {
            toast.error("Passwords do not match!");
            return;
        }

        setValidated(true);
        setLoading(true);

        const result = await resetPasswordOtp(email, otp, password);

        if (result.success) {
            navigate('/login');
        }

        setLoading(false);
    };

    return (
        <div style={{ padding: '4rem 0', minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
            <Container>
                <Row className="justify-content-center">
                    <Col md={6} lg={5}>
                        <Card className="card fade-in" style={{ padding: '2rem' }}>
                            <div className="mb-4">
                                <Link to="/login" className="d-flex align-items-center gap-2 text-decoration-none text-muted mb-3" style={{ fontSize: '0.9rem' }}>
                                    <FiArrowLeft /> Back to Login
                                </Link>
                                <h2 style={{ fontWeight: 700 }} className="text-center">Reset Password</h2>
                                <p style={{ color: 'var(--text-secondary)' }} className="text-center">
                                    {step === 1 
                                        ? "Enter your registered email address to receive a 6-digit OTP code."
                                        : "Enter the verification code sent to your email and choose a new password."
                                    }
                                </p>
                            </div>

                            {step === 1 ? (
                                <Form noValidate validated={validated} onSubmit={handleSendOtp} aria-label="Forgot Password Step 1 Form">
                                    <Form.Group className="mb-3">
                                        <Form.Label className="form-label">
                                            <FiMail className="me-2" />
                                            Email Address
                                        </Form.Label>
                                        <Form.Control
                                            type="email"
                                            name="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Enter your registered email"
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

                                    <Button
                                        type="submit"
                                        className="btn btn-primary w-100 mb-3 d-flex justify-content-center align-items-center gap-2"
                                        disabled={loading}
                                        aria-busy={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                                                Sending OTP...
                                            </>
                                        ) : 'Send Verification OTP'}
                                    </Button>
                                </Form>
                            ) : (
                                <Form noValidate validated={validated} onSubmit={handleResetPassword} aria-label="Forgot Password Step 2 Form">
                                    <Form.Group className="mb-3">
                                        <Form.Label className="form-label">
                                            <FiKey className="me-2" />
                                            Verification Code (OTP)
                                        </Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="otp"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            placeholder="Enter 6-digit OTP"
                                            required
                                            pattern="[0-9]{6}"
                                            className="form-control"
                                            aria-label="Verification Code"
                                            aria-required="true"
                                        />
                                        <Form.Control.Feedback type="invalid">
                                            Please provide a valid 6-digit verification code.
                                        </Form.Control.Feedback>
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label className="form-label">
                                            <FiLock className="me-2" />
                                            New Password
                                        </Form.Label>
                                        <Form.Control
                                            type="password"
                                            name="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter new password"
                                            required
                                            minLength={6}
                                            pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$"
                                            className="form-control"
                                            aria-label="New Password"
                                            aria-required="true"
                                        />
                                        <Form.Control.Feedback type="invalid">
                                            Password must be at least 6 characters and contain one uppercase, one lowercase, and one number.
                                        </Form.Control.Feedback>
                                    </Form.Group>

                                    <Form.Group className="mb-4">
                                        <Form.Label className="form-label">
                                            <FiLock className="me-2" />
                                            Confirm New Password
                                        </Form.Label>
                                        <Form.Control
                                            type="password"
                                            name="confirmPassword"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Confirm new password"
                                            required
                                            className="form-control"
                                            aria-label="Confirm New Password"
                                            aria-required="true"
                                        />
                                        <Form.Control.Feedback type="invalid">
                                            Please confirm your new password.
                                        </Form.Control.Feedback>
                                    </Form.Group>

                                    <Button
                                        type="submit"
                                        className="btn btn-primary w-100 mb-3 d-flex justify-content-center align-items-center gap-2"
                                        disabled={loading}
                                        aria-busy={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                                                Resetting Password...
                                            </>
                                        ) : 'Reset Password'}
                                    </Button>

                                    <div className="text-center">
                                        <Button 
                                            variant="link" 
                                            onClick={() => setStep(1)} 
                                            style={{ fontSize: '0.9rem', color: 'var(--primary)' }}
                                            className="p-0 text-decoration-none"
                                        >
                                            Resend OTP Code
                                        </Button>
                                    </div>
                                </Form>
                            )}
                        </Card>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default ForgotPassword;
