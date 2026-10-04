import React, { useState, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Spinner, Badge, Modal } from 'react-bootstrap';
import { FiUser, FiMail, FiPhone, FiMapPin, FiShield, FiSave, FiEdit2, FiCamera, FiHash, FiLayers, FiCalendar, FiMaximize2, FiPrinter } from 'react-icons/fi';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const Profile = () => {
    const { user, updateProfile } = useAuth();
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [validated, setValidated] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        address: user?.address || '',
        usn: user?.usn || '',
        year: user?.year || 'N/A',
        branch: user?.branch || '',
        profilePic: user?.profilePic || ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleProfilePicChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast.error('Image size should be less than 5MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, profilePic: reader.result });
            };
            reader.readAsDataURL(file);
        }
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
        try {
            setLoading(true);
            const result = await updateProfile(formData);
            if (result.success) {
                setEditing(false);
                toast.success('Profile updated successfully!');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const triggerFileSelect = () => {
        if (editing) {
            fileInputRef.current.click();
        }
    };

    return (
        <div style={{ padding: '3rem 0', background: 'var(--bg-secondary)', minHeight: 'calc(100vh - 70px)' }}>
            <Container>
                <Row className="justify-content-center">
                    <Col lg={10} xl={9}>
                        {/* Header Card */}
                        <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
                            <div style={{ height: '140px', background: 'var(--gradient-primary)' }}></div>
                            <Card.Body className="p-4 pt-0 text-center" style={{ marginTop: '-70px' }}>
                                <div className="mb-3 d-inline-block position-relative">
                                    <div className="p-1 bg-white rounded-circle shadow-sm">
                                        <div
                                            style={{
                                                width: '140px',
                                                height: '140px',
                                                background: '#f1f5f9',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden',
                                                border: '4px solid white',
                                                cursor: editing ? 'pointer' : 'default'
                                            }}
                                            onClick={triggerFileSelect}
                                        >
                                            {formData.profilePic ? (
                                                <img src={formData.profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: loading ? 0.5 : 1 }} />
                                            ) : (
                                                <span style={{ fontSize: '3.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                    {user?.name.charAt(0)}
                                                </span>
                                            )}
                                            {loading && (
                                                <div className="position-absolute d-flex align-items-center justify-content-center" style={{ width: '100%', height: '100%', top: 0, left: 0 }}>
                                                    <Spinner animation="border" variant="primary" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {editing && (
                                        <div
                                            className="position-absolute bottom-0 end-0 bg-primary text-white p-2 rounded-circle shadow-sm"
                                            style={{ cursor: 'pointer', marginBottom: '10px', marginRight: '10px' }}
                                            onClick={triggerFileSelect}
                                        >
                                            <FiCamera size={18} />
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleProfilePicChange}
                                        style={{ display: 'none' }}
                                        accept="image/*"
                                    />
                                </div>
                                <h2 className="fw-bold mb-1">{user?.name}</h2>
                                <p className="text-muted mb-3 d-flex align-items-center justify-content-center gap-2">
                                    <FiMail size={16} /> {user?.email}
                                </p>
                                <div className="d-flex justify-content-center gap-2">
                                    <Badge bg="primary" className="px-3 py-2" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        {user?.role}
                                    </Badge>
                                    <Badge bg="success" className="px-3 py-2" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        {user?.membershipStatus || 'Active Member'}
                                    </Badge>
                                </div>
                            </Card.Body>
                        </Card>

                        {/* ================= DIGITAL PATRON PASS / STUDENT ID CARD ================= */}
                        <Card className="border-0 shadow-sm mb-4 text-white" style={{
                            borderRadius: 'var(--radius-xl)',
                            overflow: 'hidden',
                            background: 'linear-gradient(135deg, #0b132b 0%, #1c2541 55%, #3a506b 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.12)'
                        }}>
                            {/* Card Top Branding Strip */}
                            <div className="d-flex justify-content-between align-items-center px-4 py-3" style={{ background: 'rgba(0, 0, 0, 0.35)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                <div className="d-flex align-items-center gap-2">
                                    <span style={{ fontSize: '1.25rem' }}>🏛️</span>
                                    <div>
                                        <div className="fw-bold tracking-wide" style={{ fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                            JVIT Central Digital Library
                                        </div>
                                        <div className="text-white-50" style={{ fontSize: '0.68rem' }}>
                                            OFFICIAL STUDENT CIRCULATION PASS • ACADEMIC YEAR 2025-26
                                        </div>
                                    </div>
                                </div>
                                <Badge bg={user?.membershipStatus === 'active' ? 'success' : 'danger'} className="px-3 py-1.5 text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                                    ● {user?.membershipStatus ? user.membershipStatus.toUpperCase() : 'ACTIVE PATRON'}
                                </Badge>
                            </div>

                            {/* Card Main Body */}
                            <Card.Body className="p-4">
                                <Row className="align-items-center g-4">
                                    {/* Student Credentials Column */}
                                    <Col md={7}>
                                        <div className="d-flex align-items-center gap-3 mb-3">
                                            <div
                                                className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white shadow"
                                                style={{
                                                    width: '56px',
                                                    height: '56px',
                                                    background: 'var(--gradient-primary)',
                                                    fontSize: '1.4rem',
                                                    border: '2px solid rgba(255, 255, 255, 0.25)',
                                                    flexShrink: 0
                                                }}
                                            >
                                                {user?.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="fw-bold mb-0 text-white">{user?.name}</h4>
                                                <div className="text-white-50 small">{user?.email}</div>
                                            </div>
                                        </div>

                                        <div className="p-3 rounded-3 mb-3" style={{ background: 'rgba(255, 255, 255, 0.06)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                            <Row className="g-2 text-white">
                                                <Col sm={6}>
                                                    <div className="text-white-50" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>USN / REGISTER NO</div>
                                                    <div className="fw-bold small">{user?.usn || 'Not Registered'}</div>
                                                </Col>
                                                <Col sm={6}>
                                                    <div className="text-white-50" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>BRANCH / DEPT</div>
                                                    <div className="fw-bold small">{user?.branch || 'General Circulation'}</div>
                                                </Col>
                                                <Col sm={6} className="mt-2">
                                                    <div className="text-white-50" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>CURRENT YEAR</div>
                                                    <div className="fw-bold small">{user?.year || 'N/A'}</div>
                                                </Col>
                                                <Col sm={6} className="mt-2">
                                                    <div className="text-white-50" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>ROLE / PRIVILEGES</div>
                                                    <div className="fw-bold small text-info text-capitalize">{user?.role}</div>
                                                </Col>
                                            </Row>
                                        </div>

                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <span className="text-white-50 small" style={{ fontSize: '0.75rem' }}>MEMBER ID:</span>
                                            <code className="text-warning small px-2 py-0.5 rounded font-monospace" style={{ background: 'rgba(0,0,0,0.35)', letterSpacing: '0.5px' }}>
                                                {user?._id?.toUpperCase()}
                                            </code>
                                        </div>
                                    </Col>

                                    {/* Optical QR Scanner Target Column */}
                                    <Col md={5} className="text-center">
                                        <div className="d-inline-block p-3 rounded-4 bg-white shadow-lg text-dark">
                                            <QRCodeSVG
                                                value={`LIB-PATRON:${user?._id}`}
                                                size={140}
                                                level="H"
                                                includeMargin={false}
                                            />
                                            <div className="mt-2 fw-bold text-dark" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                                                OPTICAL SCAN MATRIX
                                            </div>
                                        </div>
                                        <div className="mt-3 d-flex justify-content-center gap-2">
                                            <Button
                                                variant="light"
                                                size="sm"
                                                className="fw-bold d-flex align-items-center gap-1.5 shadow-sm text-dark"
                                                style={{ fontSize: '0.78rem' }}
                                                onClick={() => setShowQrModal(true)}
                                            >
                                                <FiMaximize2 size={13} /> Enlarge Pass
                                            </Button>
                                            <Button
                                                variant="outline-light"
                                                size="sm"
                                                className="d-flex align-items-center gap-1.5"
                                                style={{ fontSize: '0.78rem' }}
                                                onClick={() => window.print()}
                                            >
                                                <FiPrinter size={13} /> Print Card
                                            </Button>
                                        </div>
                                        <small className="text-white-50 d-block mt-2" style={{ fontSize: '0.7rem' }}>
                                            Scan at circulation counter for book issue & return
                                        </small>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>

                        {/* Details Card */}
                        <Card className="border-0 shadow-sm" style={{ borderRadius: 'var(--radius-xl)' }}>
                            <Card.Header className="bg-transparent border-0 p-4 d-flex justify-content-between align-items-center">
                                <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                    <FiUser style={{ color: 'var(--primary)' }} /> {user?.role === 'student' ? 'Academic & Personal Details' : 'Professional & Personal Details'}
                                </h5>
                                {!editing && (
                                    <Button variant="link" className="text-decoration-none p-0 d-flex align-items-center gap-2" onClick={() => setEditing(true)}>
                                        <FiEdit2 size={18} /> Edit Profile
                                    </Button>
                                )}
                            </Card.Header>
                            <Card.Body className="p-4 pt-2">
                                <Form noValidate validated={validated} onSubmit={handleSubmit}>
                                    <Row className="g-4">
                                        {/* Basic Info */}
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="small fw-bold text-muted mb-2">FULL NAME</Form.Label>
                                                <div className="position-relative">
                                                    <FiUser className="position-absolute translate-middle-y top-50 ms-3 text-muted" />
                                                    <Form.Control
                                                        type="text"
                                                        name="name"
                                                        value={formData.name}
                                                        onChange={handleChange}
                                                        disabled={!editing}
                                                        style={{ paddingLeft: '2.75rem', borderRadius: 'var(--radius-md)', height: '50px' }}
                                                        placeholder="Enter your full name"
                                                    />
                                                </div>
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="small fw-bold text-muted mb-2">PHONE NUMBER</Form.Label>
                                                <div className="position-relative">
                                                    <FiPhone className="position-absolute translate-middle-y top-50 ms-3 text-muted" />
                                                    <Form.Control
                                                        type="tel"
                                                        name="phone"
                                                        pattern="[0-9]{10}"
                                                        maxLength={10}
                                                        value={formData.phone}
                                                        onChange={handleChange}
                                                        disabled={!editing}
                                                        style={{ paddingLeft: '2.75rem', borderRadius: 'var(--radius-md)', height: '50px' }}
                                                        placeholder="Enter 10-digit phone number"
                                                    />
                                                    <Form.Control.Feedback type="invalid" style={{ paddingLeft: '2.75rem' }}>
                                                        Please provide a valid 10-digit phone number.
                                                    </Form.Control.Feedback>
                                                </div>
                                            </Form.Group>
                                        </Col>

                                        {/* Academic Info - ONLY FOR STUDENTS */}
                                        {user?.role === 'student' && (
                                            <>
                                                <Col md={4}>
                                                    <Form.Group>
                                                        <Form.Label className="small fw-bold text-muted mb-2">USN / REGISTER NO</Form.Label>
                                                        <div className="position-relative">
                                                            <FiHash className="position-absolute translate-middle-y top-50 ms-3 text-muted" />
                                                            <Form.Control
                                                                type="text"
                                                                name="usn"
                                                                value={formData.usn}
                                                                onChange={handleChange}
                                                                disabled={!editing}
                                                                style={{ paddingLeft: '2.75rem', borderRadius: 'var(--radius-md)', height: '50px' }}
                                                                placeholder="e.g. 1MS20CS001"
                                                            />
                                                        </div>
                                                    </Form.Group>
                                                </Col>
                                                <Col md={4}>
                                                    <Form.Group>
                                                        <Form.Label className="small fw-bold text-muted mb-2">CURRENT YEAR</Form.Label>
                                                        <div className="position-relative">
                                                            <FiCalendar className="position-absolute translate-middle-y top-50 ms-3 text-muted" />
                                                            <Form.Select
                                                                name="year"
                                                                value={formData.year}
                                                                onChange={handleChange}
                                                                disabled={!editing}
                                                                style={{ paddingLeft: '2.75rem', borderRadius: 'var(--radius-md)', height: '50px' }}
                                                            >
                                                                <option value="N/A">Select Year</option>
                                                                <option value="1st Year">1st Year</option>
                                                                <option value="2nd Year">2nd Year</option>
                                                                <option value="3rd Year">3rd Year</option>
                                                                <option value="4th Year">4th Year</option>
                                                            </Form.Select>
                                                        </div>
                                                    </Form.Group>
                                                </Col>
                                                <Col md={4}>
                                                    <Form.Group>
                                                        <Form.Label className="small fw-bold text-muted mb-2">BRANCH / DEPT</Form.Label>
                                                        <div className="position-relative">
                                                            <FiLayers className="position-absolute translate-middle-y top-50 ms-3 text-muted" />
                                                            <Form.Control
                                                                type="text"
                                                                name="branch"
                                                                value={formData.branch}
                                                                onChange={handleChange}
                                                                disabled={!editing}
                                                                style={{ paddingLeft: '2.75rem', borderRadius: 'var(--radius-md)', height: '50px' }}
                                                                placeholder="e.g. CSE / ISE"
                                                            />
                                                        </div>
                                                    </Form.Group>
                                                </Col>
                                            </>
                                        )}

                                        <Col md={12}>
                                            <Form.Group>
                                                <Form.Label className="small fw-bold text-muted mb-2">PERMANENT ADDRESS</Form.Label>
                                                <div className="position-relative">
                                                    <FiMapPin className="position-absolute ms-3 text-muted" style={{ top: '15px' }} />
                                                    <Form.Control
                                                        as="textarea"
                                                        rows={3}
                                                        name="address"
                                                        value={formData.address}
                                                        onChange={handleChange}
                                                        disabled={!editing}
                                                        style={{ paddingLeft: '2.75rem', borderRadius: 'var(--radius-md)' }}
                                                        placeholder="Enter your full residential address"
                                                    />
                                                </div>
                                            </Form.Group>
                                        </Col>

                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="small fw-bold text-muted mb-2">MEMBER ID (SYSTEM GEN)</Form.Label>
                                                <div className="position-relative">
                                                    <FiShield className="position-absolute translate-middle-y top-50 ms-3 text-muted" />
                                                    <Form.Control
                                                        type="text"
                                                        value={user?._id.toUpperCase()}
                                                        disabled={true}
                                                        style={{ paddingLeft: '2.75rem', borderRadius: 'var(--radius-md)', height: '50px', background: '#f8fafc' }}
                                                    />
                                                </div>
                                            </Form.Group>
                                        </Col>

                                        {editing && (
                                            <Col md={12} className="d-flex gap-2 mt-4">
                                                <Button
                                                    variant="primary"
                                                    type="submit"
                                                    disabled={loading}
                                                    className="px-5 py-2 fw-bold d-flex align-items-center gap-2"
                                                    style={{ borderRadius: 'var(--radius-lg)' }}
                                                >
                                                    {loading ? <Spinner size="sm" /> : <FiSave />} Update Profile
                                                </Button>
                                                <Button
                                                    variant="outline-secondary"
                                                    onClick={() => setEditing(false)}
                                                    className="px-4 py-2"
                                                    style={{ borderRadius: 'var(--radius-lg)' }}
                                                >
                                                    Cancel
                                                </Button>
                                            </Col>
                                        )}
                                    </Row>
                                </Form>
                            </Card.Body>
                        </Card>

                        <div className="mt-4 text-center">
                            <p className="text-muted small">
                                <FiShield className="me-1" /> Your data is secure. For sensitive changes contact the library admin.
                            </p>
                        </div>

                        {/* Fullscreen High-Contrast QR Pass Modal */}
                        <Modal show={showQrModal} onHide={() => setShowQrModal(false)} centered size="sm">
                            <Modal.Header closeButton className="border-0 pb-0">
                                <Modal.Title className="fw-bold small text-muted text-uppercase" style={{ letterSpacing: '1px' }}>
                                    Digital Patron Pass
                                </Modal.Title>
                            </Modal.Header>
                            <Modal.Body className="text-center p-4 pt-2">
                                <div className="p-3 bg-white rounded-4 shadow-sm d-inline-block border mb-3">
                                    <QRCodeSVG
                                        value={`LIB-PATRON:${user?._id}`}
                                        size={220}
                                        level="H"
                                        includeMargin={true}
                                    />
                                </div>
                                <h5 className="fw-bold mb-1 text-dark">{user?.name}</h5>
                                <div className="text-muted small mb-2">{user?.usn || user?.email}</div>
                                <Badge bg={user?.membershipStatus === 'active' ? 'success' : 'danger'} className="px-3 py-1 mb-3">
                                    ● {user?.membershipStatus ? user.membershipStatus.toUpperCase() : 'ACTIVE PATRON'}
                                </Badge>
                                <div className="p-2 rounded bg-light text-muted small font-monospace" style={{ fontSize: '0.75rem' }}>
                                    ID: {user?._id?.toUpperCase()}
                                </div>
                                <p className="text-muted mt-3 mb-0" style={{ fontSize: '0.78rem' }}>
                                    Present this screen in front of the librarian's optical camera at the circulation counter to issue or return books.
                                </p>
                            </Modal.Body>
                            <Modal.Footer className="border-0 pt-0 justify-content-center">
                                <Button variant="secondary" size="sm" onClick={() => setShowQrModal(false)}>
                                    Close
                                </Button>
                            </Modal.Footer>
                        </Modal>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default Profile;
