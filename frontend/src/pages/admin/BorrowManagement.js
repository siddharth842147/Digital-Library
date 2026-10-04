import React, { useState, useEffect, useRef } from 'react';
import { Container, Card, Table, Badge, Button, Spinner, InputGroup, Form, Tabs, Tab, Modal, Row, Col, Alert } from 'react-bootstrap';
import { FiSearch, FiFileText, FiUserCheck, FiRotateCcw, FiCamera, FiX, FiCheckCircle, FiAlertTriangle, FiUser, FiBook, FiShield, FiXCircle } from 'react-icons/fi';
import { Html5Qrcode } from 'html5-qrcode';
import { getBorrowHistory, approveBorrow, rejectBorrow, verifyReturn } from '../../services/borrowService';
import { getUser, getAllUsers } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { getLocalizedStr } from '../../utils/localization';

const BorrowManagement = () => {
    const { user: loggedInUser } = useAuth();
    const [borrows, setBorrows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('requests');

    // Optical Camera QR Scanner states
    const [showScanner, setShowScanner] = useState(false);
    const [manualIdInput, setManualIdInput] = useState('');
    const scannerRef = useRef(null);
    const isScanningRef = useRef(false);

    // Patron Desk Verification Modal states
    const [verifying, setVerifying] = useState(false);
    const [verifiedPatron, setVerifiedPatron] = useState(null);
    const [showPatronModal, setShowPatronModal] = useState(false);

    // Reject Modal states
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectTargetId, setRejectTargetId] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    const fetchBorrows = async () => {
        try {
            setLoading(true);
            const response = await getBorrowHistory({ limit: 100 });
            setBorrows(response.data);
        } catch (error) {
            toast.error('Failed to load borrow records');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBorrows();
    }, []);

    // Clean up scanner on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {}).finally(() => {
                    try { scannerRef.current.clear(); } catch (e) {}
                });
            }
        };
    }, []);

    const handleApprove = async (id) => {
        try {
            const response = await approveBorrow(id);
            toast.success(response.message || 'Book issued successfully (14-day loan period set)!');
            await fetchBorrows();
            if (verifiedPatron?.student?._id) {
                verifyAndDisplayPatron(verifiedPatron.student._id);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Approval failed');
        }
    };

    const handleOpenReject = (borrowRecord) => {
        setRejectTargetId(borrowRecord._id);
        setRejectReason('Student invalid or circulation quota exceeded.');
        setShowRejectModal(true);
    };

    const handleConfirmReject = async () => {
        if (!rejectTargetId) return;
        try {
            await rejectBorrow(rejectTargetId, rejectReason);
            toast.info('Borrow request rejected.');
            setShowRejectModal(false);
            setRejectTargetId(null);
            setRejectReason('');
            await fetchBorrows();
            if (verifiedPatron?.student?._id) {
                verifyAndDisplayPatron(verifiedPatron.student._id);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Rejection failed');
        }
    };

    const handleVerifyReturn = async (id) => {
        try {
            const response = await verifyReturn(id);
            toast.success(response.message || 'Return finalized & stock incremented!');
            await fetchBorrows();
            if (verifiedPatron?.student?._id) {
                verifyAndDisplayPatron(verifiedPatron.student._id);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Verification failed');
        }
    };

    // Camera Scanner Controls
    const startScanner = () => {
        setShowScanner(true);
        isScanningRef.current = false;
        setTimeout(() => {
            try {
                const qrcode = new Html5Qrcode('student-qr-reader');
                scannerRef.current = qrcode;
                const config = {
                    fps: 15,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    videoConstraints: {
                        facingMode: 'environment'
                    }
                };
                qrcode.start(
                    { facingMode: 'environment' },
                    config,
                    (decodedText) => handleQrScanned(decodedText),
                    () => {}
                ).catch((err) => {
                    console.error('Camera start error', err);
                    toast.warn('Could not access camera. You may paste or type the Member ID manually below.');
                });
            } catch (err) {
                console.error('Scanner init error', err);
                toast.error('Scanner initialization error');
            }
        }, 400);
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
            } catch (e) {}
            try {
                scannerRef.current.clear();
            } catch (e) {}
            scannerRef.current = null;
        }
        setShowScanner(false);
    };

    const handleQrScanned = async (raw) => {
        if (isScanningRef.current) return;
        isScanningRef.current = true;
        await stopScanner();

        let cleanId = (raw || '').trim();
        if (cleanId.startsWith('LIB-PATRON:')) {
            cleanId = cleanId.replace('LIB-PATRON:', '').trim();
        }
        if (cleanId.startsWith('{')) {
            try {
                const parsed = JSON.parse(cleanId);
                cleanId = parsed.id || parsed._id || cleanId;
            } catch (e) {}
        }
        await verifyAndDisplayPatron(cleanId);
    };

    const handleManualLookup = async (e) => {
        e.preventDefault();
        if (!manualIdInput.trim()) return;
        await stopScanner();
        await verifyAndDisplayPatron(manualIdInput.trim());
    };

    // Patron Desk Verification Logic
    const verifyAndDisplayPatron = async (queryId) => {
        try {
            setVerifying(true);
            let student = null;

            // 1. Try finding by MongoDB ObjectId
            if (/^[0-9a-fA-F]{24}$/.test(queryId)) {
                try {
                    const res = await getUser(queryId);
                    if (res.data?.user) student = res.data.user;
                } catch (e) {}
            }

            // 2. Check if student matches existing records in borrows
            if (!student) {
                const qLower = queryId.toLowerCase();
                const matchBorrow = borrows.find(b =>
                    (b.user?._id && b.user._id.toLowerCase() === qLower) ||
                    (b.user?.usn && b.user.usn.toLowerCase() === qLower) ||
                    (b.user?.email && b.user.email.toLowerCase() === qLower) ||
                    (b.user?.name && b.user.name.toLowerCase() === qLower)
                );
                if (matchBorrow?.user) {
                    student = matchBorrow.user;
                }
            }

            // 3. Fallback: Search user directory via API
            if (!student) {
                try {
                    const usersRes = await getAllUsers({ search: queryId });
                    if (usersRes.data && usersRes.data.length > 0) {
                        student = usersRes.data[0];
                    }
                } catch (e) {}
            }

            if (!student) {
                toast.error(`No student record found for identifier: ${queryId}`);
                return;
            }

            // Calculate Circulation Verification Metrics
            const studentBorrows = borrows.filter(b =>
                (b.user?._id === student._id) || (b.user === student._id)
            );
            const activeLoans = studentBorrows.filter(b => ['borrowed', 'overdue'].includes(b.status));
            const pendingRequests = studentBorrows.filter(b => b.status === 'pending');

            const isStatusActive = (student.membershipStatus || 'active').toLowerCase() === 'active';
            const isFineFree = (student.totalFines || 0) <= 0;
            const isUnderQuota = activeLoans.length < 3;
            const isValid = isStatusActive && isFineFree && isUnderQuota;

            setVerifiedPatron({
                student,
                activeLoans,
                pendingRequests,
                isStatusActive,
                isFineFree,
                isUnderQuota,
                isValid
            });
            setShowPatronModal(true);
            toast.success(`Patron Verified: ${student.name}`);
        } catch (err) {
            console.error(err);
            toast.error('Student verification lookup failed');
        } finally {
            setVerifying(false);
            isScanningRef.current = false;
        }
    };

    const getFilteredBorrows = () => {
        let filtered = borrows;
        if (activeTab === 'requests') {
            filtered = borrows.filter(b => b.status === 'pending');
        } else if (activeTab === 'active') {
            filtered = borrows.filter(b => b.status === 'borrowed' || b.status === 'overdue');
        } else if (activeTab === 'returns') {
            filtered = borrows.filter(b => b.status === 'return_pending');
        } else {
            filtered = borrows.filter(b => b.status === 'returned' || b.status === 'rejected');
        }

        return filtered.filter(b =>
            (b.user?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.book?.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.book?.isbn || '').includes(searchTerm) ||
            (b.user?.usn || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    const filteredBorrows = getFilteredBorrows();

    return (
        <div style={{ padding: '3rem 0', background: 'var(--bg-secondary)', minHeight: 'calc(100vh - 70px)' }}>
            <Container>
                {/* Header & Desk Actions */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                    <div>
                        <h1 style={{ fontWeight: 800 }}>Borrowing Operations 📋</h1>
                        <p className="text-muted mb-0">Circulation desk validation, optical QR issuance, and return verification.</p>
                    </div>
                    <Button
                        variant="primary"
                        size="lg"
                        className="d-flex align-items-center gap-2 shadow px-4 py-2.5 fw-bold"
                        style={{ borderRadius: 'var(--radius-lg)' }}
                        onClick={startScanner}
                    >
                        <FiCamera size={20} /> Scan Student Digital QR
                    </Button>
                </div>

                {/* Navigation Tabs */}
                <div className="mb-4">
                    <Tabs
                        activeKey={activeTab}
                        onSelect={(k) => setActiveTab(k)}
                        className="border-0 custom-tabs mb-4"
                        fill
                    >
                        <Tab eventKey="requests" title={`Approval Requests (${borrows.filter(b => b.status === 'pending').length})`} />
                        <Tab eventKey="active" title={`Active Loans (${borrows.filter(b => b.status === 'borrowed' || b.status === 'overdue').length})`} />
                        <Tab eventKey="returns" title={`Return Verification (${borrows.filter(b => b.status === 'return_pending').length})`} />
                        <Tab eventKey="history" title="Finalized History" />
                    </Tabs>
                </div>

                {/* Filter and Search Bar */}
                <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 'var(--radius-xl)' }}>
                    <Card.Body className="p-3">
                        <InputGroup>
                            <InputGroup.Text className="bg-white border-end-0">
                                <FiSearch className="text-muted" />
                            </InputGroup.Text>
                            <Form.Control
                                placeholder="Search by student name, USN, book title, or ISBN..."
                                className="border-start-0"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <Button variant="outline-secondary" onClick={() => setSearchTerm('')}>
                                    Clear Filter
                                </Button>
                            )}
                        </InputGroup>
                    </Card.Body>
                </Card>

                {/* Borrow Records Table */}
                <Card className="border-0 shadow-sm" style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                    <Card.Body className="p-0">
                        {loading ? (
                            <div className="text-center py-5">
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <Table hover className="align-middle mb-0 border-0">
                                    <thead className="bg-light">
                                        <tr>
                                            <th className="px-4 py-3 border-0 small text-muted">MEMBER</th>
                                            <th className="py-3 border-0 small text-muted">BOOK</th>
                                            <th className="py-3 border-0 small text-muted">STATUS / DETAILS</th>
                                            <th className="py-3 border-0 small text-muted text-end px-4">ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBorrows.map((b) => {
                                            return (
                                                <tr key={b._id}>
                                                    <td className="px-4 py-3">
                                                        <div className="fw-bold text-dark">{b.user?.name || 'Unknown Student'}</div>
                                                        <div className="d-flex align-items-center gap-1 flex-wrap my-1">
                                                            {b.user?.usn && (
                                                                <Badge bg="success-subtle" className="text-success border border-success-subtle" style={{ fontSize: '0.7rem' }}>
                                                                    {b.user.usn}
                                                                </Badge>
                                                            )}
                                                            {b.user?.branch && (
                                                                <Badge bg="secondary-subtle" className="text-secondary border border-secondary-subtle" style={{ fontSize: '0.7rem' }}>
                                                                    {b.user.branch}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <small className="text-muted d-block" style={{ fontSize: '0.78rem' }}>
                                                            {b.user?.email || 'N/A'}{b.user?.phone ? ` • 📞 ${b.user.phone}` : ''}
                                                        </small>
                                                    </td>
                                                    <td>
                                                        <div className="fw-bold text-dark">{getLocalizedStr(b.book?.title, 'Unknown Book')}</div>
                                                        {b.book?.author && (
                                                            <small className="text-muted d-block" style={{ fontSize: '0.8rem' }}>
                                                                By {getLocalizedStr(b.book.author, 'Unknown Author')}
                                                            </small>
                                                        )}
                                                        <small className="text-secondary" style={{ fontSize: '0.75rem' }}>
                                                            Due: {new Date(b.dueDate).toLocaleDateString()}{b.book?.isbn ? ` • ISBN: ${b.book.isbn}` : ''}
                                                        </small>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex flex-column gap-1">
                                                            <Badge bg={
                                                                b.status === 'pending' ? 'warning' :
                                                                    b.status === 'overdue' ? 'danger' :
                                                                        b.status === 'return_pending' ? 'info' :
                                                                            b.status === 'returned' ? 'success' :
                                                                                b.status === 'rejected' ? 'secondary' : 'primary'
                                                            } pill className="w-fit">
                                                                {b.status.toUpperCase().replace('_', ' ')}
                                                            </Badge>

                                                            {b.status === 'pending' && (
                                                                <div className="d-flex gap-1 mt-1">
                                                                    <Badge bg={b.approvedByLibrarian ? 'success' : 'secondary'} size="sm">
                                                                        {b.approvedByLibrarian ? 'Librarian OK' : 'Wait Staff'}
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="text-end px-4">
                                                        {activeTab === 'requests' && (
                                                            <div className="d-flex gap-2 justify-content-end">
                                                                <Button
                                                                    variant="outline-primary"
                                                                    size="sm"
                                                                    className="fw-bold shadow-sm"
                                                                    onClick={() => handleApprove(b._id)}
                                                                    disabled={(loggedInUser.role === 'admin' && b.approvedByAdmin) || (loggedInUser.role === 'librarian' && b.approvedByLibrarian)}
                                                                >
                                                                    <FiUserCheck className="me-1" />
                                                                    {(loggedInUser.role === 'admin' && b.approvedByAdmin) || (loggedInUser.role === 'librarian' && b.approvedByLibrarian) ? 'Approved' : 'Approve'}
                                                                </Button>
                                                                <Button
                                                                    variant="outline-danger"
                                                                    size="sm"
                                                                    onClick={() => handleOpenReject(b)}
                                                                    title="Reject / Cancel request"
                                                                >
                                                                    <FiXCircle className="me-1" /> Reject
                                                                </Button>
                                                            </div>
                                                        )}

                                                        {activeTab === 'returns' && (
                                                            <Button
                                                                variant="success"
                                                                size="sm"
                                                                className="fw-bold shadow-sm"
                                                                onClick={() => handleVerifyReturn(b._id)}
                                                            >
                                                                <FiRotateCcw className="me-1" /> Finalize Return
                                                            </Button>
                                                        )}

                                                        {activeTab === 'active' && (
                                                            <span className="text-muted small italic">Waiting for student return...</span>
                                                        )}

                                                        {activeTab === 'history' && (
                                                            <span className="text-muted small">Updated: {new Date(b.updatedAt).toLocaleDateString()}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </Table>
                            </div>
                        )}
                        {!loading && filteredBorrows.length === 0 && (
                            <div className="text-center py-5">
                                <FiFileText size={48} className="text-muted mb-3" />
                                <h5>No records found for this section</h5>
                            </div>
                        )}
                    </Card.Body>
                </Card>
            </Container>

            {/* ================= OPTICAL SCANNER MODAL ================= */}
            <Modal show={showScanner} onHide={stopScanner} centered size="md">
                <Modal.Header closeButton>
                    <Modal.Title className="fw-bold d-flex align-items-center gap-2">
                        <FiCamera style={{ color: 'var(--primary)' }} /> Scan Student Digital QR Pass
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <p className="text-muted small mb-3">
                        Point the camera at the student's phone screen showing their <strong>Digital Patron Pass</strong>.
                    </p>
                    <div id="student-qr-reader" style={{ width: '100%', minHeight: '260px', borderRadius: '12px', overflow: 'hidden' }} />

                    {/* Manual Fallback Option */}
                    <div className="mt-4 pt-3 border-top">
                        <Form onSubmit={handleManualLookup}>
                            <Form.Label className="small fw-bold text-muted">OR ENTER MEMBER ID / USN MANUALLY</Form.Label>
                            <InputGroup>
                                <Form.Control
                                    placeholder="e.g. 6A809484... or 1MS20CS001"
                                    value={manualIdInput}
                                    onChange={(e) => setManualIdInput(e.target.value)}
                                />
                                <Button variant="secondary" type="submit" disabled={!manualIdInput.trim()}>
                                    Verify
                                </Button>
                            </InputGroup>
                        </Form>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={stopScanner}>
                        Cancel
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* ================= PATRON VERIFICATION & CIRCULATION DESK MODAL ================= */}
            <Modal show={showPatronModal} onHide={() => setShowPatronModal(false)} centered size="lg">
                {verifiedPatron && (
                    <>
                        <Modal.Header closeButton className="border-0 pb-0">
                            <div>
                                <Modal.Title className="fw-bold">Circulation Desk Patron Verification 🏛️</Modal.Title>
                                <small className="text-muted">Instant Optical Verification & Fast Book Issuance Desk</small>
                            </div>
                        </Modal.Header>
                        <Modal.Body className="p-4 pt-3">
                            {/* Student Profile Identity Card */}
                            <div className="p-3 rounded-4 mb-4 text-white" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
                                <Row className="align-items-center g-3">
                                    <Col sm={8}>
                                        <div className="d-flex align-items-center gap-3">
                                            <div
                                                className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white shadow"
                                                style={{ width: '50px', height: '50px', background: 'var(--gradient-primary)', fontSize: '1.25rem' }}
                                            >
                                                {verifiedPatron.student.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <h5 className="fw-bold mb-0 text-white">{verifiedPatron.student.name}</h5>
                                                <div className="text-white-50 small">{verifiedPatron.student.email}</div>
                                                <div className="mt-1 d-flex gap-2 flex-wrap">
                                                    {verifiedPatron.student.usn && (
                                                        <Badge bg="info" style={{ fontSize: '0.7rem' }}>USN: {verifiedPatron.student.usn}</Badge>
                                                    )}
                                                    {verifiedPatron.student.branch && (
                                                        <Badge bg="secondary" style={{ fontSize: '0.7rem' }}>{verifiedPatron.student.branch}</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Col>
                                    <Col sm={4} className="text-sm-end">
                                        <div className="text-white-50 small" style={{ fontSize: '0.7rem' }}>SYSTEM MEMBER ID</div>
                                        <code className="text-warning small font-monospace">
                                            {verifiedPatron.student._id?.toUpperCase()}
                                        </code>
                                    </Col>
                                </Row>
                            </div>

                            {/* 3-Point Validation Matrix */}
                            <h6 className="fw-bold mb-3 small text-uppercase text-muted" style={{ letterSpacing: '0.5px' }}>
                                Circulation Desk Validation Matrix
                            </h6>
                            <Row className="g-3 mb-4">
                                <Col md={4}>
                                    <div className="p-3 rounded-3 border text-center h-100" style={{ background: verifiedPatron.isStatusActive ? '#f0fdf4' : '#fef2f2' }}>
                                        <div className="small fw-bold text-muted mb-1">1. MEMBERSHIP STATUS</div>
                                        <Badge bg={verifiedPatron.isStatusActive ? 'success' : 'danger'} pill className="px-3 py-1.5">
                                            {verifiedPatron.isStatusActive ? '✅ ACTIVE PATRON' : '❌ SUSPENDED'}
                                        </Badge>
                                    </div>
                                </Col>
                                <Col md={4}>
                                    <div className="p-3 rounded-3 border text-center h-100" style={{ background: verifiedPatron.isFineFree ? '#f0fdf4' : '#fef2f2' }}>
                                        <div className="small fw-bold text-muted mb-1">2. OVERDUE FINES</div>
                                        <Badge bg={verifiedPatron.isFineFree ? 'success' : 'danger'} pill className="px-3 py-1.5">
                                            {verifiedPatron.isFineFree ? '✅ ₹0 CLEAR' : `❌ ₹${verifiedPatron.student.totalFines} PENDING`}
                                        </Badge>
                                    </div>
                                </Col>
                                <Col md={4}>
                                    <div className="p-3 rounded-3 border text-center h-100" style={{ background: verifiedPatron.isUnderQuota ? '#f0fdf4' : '#fef2f2' }}>
                                        <div className="small fw-bold text-muted mb-1">3. BORROW QUOTA</div>
                                        <Badge bg={verifiedPatron.isUnderQuota ? 'success' : 'danger'} pill className="px-3 py-1.5">
                                            {verifiedPatron.isUnderQuota ? `✅ ${verifiedPatron.activeLoans.length}/3 BOOKS` : '❌ QUOTA FULL (3/3)'}
                                        </Badge>
                                    </div>
                                </Col>
                            </Row>

                            {/* Overall Decision Banner */}
                            {verifiedPatron.isValid ? (
                                <Alert variant="success" className="d-flex align-items-center gap-2 mb-4">
                                    <FiCheckCircle size={22} className="flex-shrink-0" />
                                    <div>
                                        <div className="fw-bold">PATRON VALIDATED & ELIGIBLE FOR ISSUANCE</div>
                                        <div className="small">Books can be issued immediately for a 14-day loan period. Inventory stock will automatically decrement.</div>
                                    </div>
                                </Alert>
                            ) : (
                                <Alert variant="danger" className="d-flex align-items-center gap-2 mb-4">
                                    <FiAlertTriangle size={22} className="flex-shrink-0" />
                                    <div>
                                        <div className="fw-bold">VALIDATION FAILED — ISSUANCE RESTRICTED</div>
                                        <div className="small">
                                            {!verifiedPatron.isStatusActive && '• Student membership is not active. '}
                                            {!verifiedPatron.isFineFree && `• Student owes ₹${verifiedPatron.student.totalFines} in unpaid fines. `}
                                            {!verifiedPatron.isUnderQuota && '• Maximum loan quota reached (3 books). Return a book before borrowing again.'}
                                        </div>
                                    </div>
                                </Alert>
                            )}

                            {/* Pending Requests Section */}
                            <div className="mb-4">
                                <h6 className="fw-bold mb-2 small text-uppercase text-muted" style={{ letterSpacing: '0.5px' }}>
                                    Pending Book Requests ({verifiedPatron.pendingRequests.length})
                                </h6>
                                {verifiedPatron.pendingRequests.length === 0 ? (
                                    <div className="p-3 rounded-3 bg-light text-muted small text-center">
                                        No pending book requests for this student. The student can browse the catalog and request an in-stock title.
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column gap-2">
                                        {verifiedPatron.pendingRequests.map((req) => (
                                            <div key={req._id} className="p-3 rounded-3 border d-flex justify-content-between align-items-center flex-wrap gap-2 bg-white">
                                                <div>
                                                    <div className="fw-bold text-dark">{getLocalizedStr(req.book?.title, 'Book Title')}</div>
                                                    <small className="text-muted">
                                                        Requested: {new Date(req.createdAt).toLocaleDateString()} • Available Copies: {req.book?.availableCopies ?? 'N/A'}
                                                    </small>
                                                </div>
                                                <div className="d-flex gap-2">
                                                    <Button
                                                        variant="success"
                                                        size="sm"
                                                        className="fw-bold d-flex align-items-center gap-1.5 shadow-sm"
                                                        disabled={!verifiedPatron.isValid}
                                                        onClick={() => handleApprove(req._id)}
                                                    >
                                                        <FiUserCheck /> Issue Book (14-Day Loan)
                                                    </Button>
                                                    <Button
                                                        variant="outline-danger"
                                                        size="sm"
                                                        onClick={() => handleOpenReject(req)}
                                                    >
                                                        <FiXCircle /> Reject Request
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Active Loans Section */}
                            {verifiedPatron.activeLoans.length > 0 && (
                                <div>
                                    <h6 className="fw-bold mb-2 small text-uppercase text-muted" style={{ letterSpacing: '0.5px' }}>
                                        Currently Borrowed Books ({verifiedPatron.activeLoans.length})
                                    </h6>
                                    <div className="d-flex flex-column gap-2">
                                        {verifiedPatron.activeLoans.map((loan) => (
                                            <div key={loan._id} className="p-2.5 rounded-3 border d-flex justify-content-between align-items-center bg-light">
                                                <div>
                                                    <span className="fw-bold text-dark small">{getLocalizedStr(loan.book?.title, 'Title')}</span>
                                                    <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                                                        Due Date: {new Date(loan.dueDate).toLocaleDateString()}
                                                    </small>
                                                </div>
                                                <Button
                                                    variant="outline-success"
                                                    size="sm"
                                                    style={{ fontSize: '0.78rem' }}
                                                    onClick={() => handleVerifyReturn(loan._id)}
                                                >
                                                    <FiRotateCcw className="me-1" /> Return Book
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Modal.Body>
                        <Modal.Footer className="justify-content-between">
                            <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => {
                                    setSearchTerm(verifiedPatron.student.name);
                                    setShowPatronModal(false);
                                }}
                            >
                                Filter Main Table by this Student
                            </Button>
                            <div className="d-flex gap-2">
                                <Button variant="secondary" size="sm" onClick={() => setShowPatronModal(false)}>
                                    Done
                                </Button>
                                <Button variant="primary" size="sm" onClick={() => { setShowPatronModal(false); startScanner(); }}>
                                    <FiCamera className="me-1" /> Scan Next Student
                                </Button>
                            </div>
                        </Modal.Footer>
                    </>
                )}
            </Modal>

            {/* ================= REJECT REASON MODAL ================= */}
            <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered size="sm">
                <Modal.Header closeButton>
                    <Modal.Title className="fw-bold text-danger small text-uppercase">Reject Borrow Request</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-3">
                    <p className="small text-muted mb-2">Provide a reason for cancelling or rejecting this circulation request:</p>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g. Patron account suspended or quota exceeded."
                    />
                </Modal.Body>
                <Modal.Footer className="p-2">
                    <Button variant="secondary" size="sm" onClick={() => setShowRejectModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleConfirmReject}>
                        Confirm Rejection
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default BorrowManagement;
