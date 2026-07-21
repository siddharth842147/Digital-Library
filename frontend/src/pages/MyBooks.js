import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Button, Spinner, Modal } from 'react-bootstrap';
import { FiBook, FiCalendar, FiRotateCcw, FiAlertCircle, FiInfo } from 'react-icons/fi';
import axios from 'axios';
import { getMyBorrowedBooks, returnBook } from '../services/borrowService';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';

const MyBooks = () => {
    const [borrows, setBorrows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [returningId, setReturningId] = useState(null);
    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: '',
        message: [],
        fineAmount: 0,
        onConfirm: null
    });

    const fetchMyBooks = async () => {
        try {
            setLoading(true);
            const response = await getMyBorrowedBooks();
            setBorrows(response.data);
        } catch (error) {
            toast.error('Error fetching your borrowed books', { className: 'alert-slide-top-red', position: 'top-center' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMyBooks();
    }, []);

    const handleRenew = (id) => {
        setConfirmModal({
            show: true,
            title: 'Confirm Renewal',
            message: ['Renew this book for 7 more days?', '(Limit: 2 renewals)'],
            fineAmount: 0,
            onConfirm: () => executeRenew(id)
        });
    };

    const executeRenew = async (id) => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        try {
            const response = await axios.put(`${process.env.REACT_APP_API_URL}/borrow/renew/${id}`, {}, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success(response.data.message || 'Book renewed successfully!', { className: 'alert-slide-bottom-green', position: 'bottom-center' });
            fetchMyBooks();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Renewal failed', { className: 'alert-slide-top-red', position: 'top-center' });
        }
    };

    const handleReturn = (id, accruedFine) => {
        const message = ['Are you sure you want to return this book?'];
        setConfirmModal({
            show: true,
            title: 'Confirm Return',
            message,
            fineAmount: accruedFine,
            onConfirm: () => executeReturn(id, accruedFine)
        });
    };

    const executeReturn = async (id, accruedFine) => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        try {
            setReturningId(id);
            const response = await returnBook(id);
            if (response.coinsEarned && response.coinsEarned > 0) {
                toast.success(`Book returned successfully! You earned ${response.coinsEarned} JViT Coins 🎉!`, { className: 'alert-slide-bottom-green', position: 'bottom-center' });
            } else {
                toast.success(response.message || 'Book returned successfully!', { className: 'alert-slide-bottom-green', position: 'bottom-center' });
            }
            fetchMyBooks(); // Refresh list
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to return book';
            toast.error(message, { className: 'alert-slide-top-red', position: 'top-center' });
        } finally {
            setReturningId(null);
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <Spinner animation="border" variant="primary" />
            </div>
        );
    }

    return (
        <div style={{ padding: '3rem 0', background: 'var(--bg-secondary)', minHeight: 'calc(100vh - 70px)' }}>
            <Container>
                <div className="d-flex justify-content-between align-items-center mb-5">
                    <div>
                        <h1 style={{ fontWeight: 800 }}>My Borrowed Books</h1>
                        <p className="text-muted">Track your reading and manage returns</p>
                    </div>
                    <Badge bg="primary" style={{ padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-full)', fontSize: '1rem' }}>
                        {borrows.length} Active Borrows
                    </Badge>
                </div>

                {borrows.length === 0 ? (
                    <Card className="text-center py-5 border-0 shadow-sm" style={{ borderRadius: 'var(--radius-2xl)' }}>
                        <Card.Body>
                            <div className="mb-4" style={{ color: 'var(--gray-light)' }}>
                                <FiBook size={80} />
                            </div>
                            <h3>No borrowed books</h3>
                            <p className="text-muted mb-4">You don't have any books issued at the moment.</p>
                            <Link to="/books" className="btn btn-primary btn-lg">
                                Browse Collection
                            </Link>
                        </Card.Body>
                    </Card>
                ) : (
                    <Row className="g-4">
                        {borrows.map((borrow, index) => (
                            <Col key={borrow._id} xl={6}>
                                <Card className="border-0 shadow-sm h-100 mybook-card-anim" style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', animationDelay: `${0.1 * index}s` }}>
                                    <Row className="g-0 h-100">
                                        <Col md={4}>
                                            <img
                                                src={borrow.book?.coverImage?.startsWith('http') ? borrow.book.coverImage : (borrow.book?.coverImage ? `${(process.env.REACT_APP_API_URL || 'https://jvit-backend.onrender.com/api').replace('/api', '')}${borrow.book.coverImage}` : 'https://placehold.co/400x600?text=No+Cover')}
                                                alt={borrow.book?.title || 'Unknown Book'}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '250px' }}
                                            />
                                        </Col>
                                        <Col md={8}>
                                            <Card.Body className="d-flex flex-column p-4">
                                                <div className="flex-grow-1">
                                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                                         <Badge bg="info">
                                                             {typeof borrow.book?.category === 'object' && borrow.book.category ? (borrow.book.category.en || borrow.book.category.hi || Object.values(borrow.book.category)[0]) : (borrow.book?.category || 'Unknown')}
                                                         </Badge>
                                                        <div className="d-flex gap-2">
                                                            {borrow.status === 'overdue' && (
                                                                <Badge bg="danger" className="d-flex align-items-center gap-1 badge-glow-red">
                                                                    <FiAlertCircle /> OVERDUE
                                                                </Badge>
                                                            )}
                                                            {borrow.status === 'pending' && <Badge bg="warning" className="badge-glow-yellow">APPROVAL PENDING</Badge>}
                                                            {borrow.status === 'return_pending' && <Badge bg="secondary">RETURN PENDING VERIFICATION</Badge>}
                                                        </div>
                                                    </div>
                                                     <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                                                         {typeof borrow.book?.title === 'object' && borrow.book.title ? (borrow.book.title.en || borrow.book.title.hi || Object.values(borrow.book.title)[0]) : (borrow.book?.title || 'Unknown Book')}
                                                     </h4>
                                                     <p className="text-muted mb-4">
                                                         by {typeof borrow.book?.author === 'object' && borrow.book.author ? (borrow.book.author.en || borrow.book.author.hi || Object.values(borrow.book.author)[0]) : (borrow.book?.author || 'Unknown Author')}
                                                     </p>

                                                    <div className="mb-4">
                                                        <div className="d-flex align-items-center gap-2 mb-2 text-muted">
                                                            <FiCalendar /> <small>Borrowed: {new Date(borrow.borrowDate).toLocaleDateString()}</small>
                                                        </div>
                                                        <div className={`d-flex align-items-center gap-2 ${borrow.status === 'overdue' ? 'text-danger fw-bold' : 'text-primary'}`}>
                                                            <FiCalendar /> <small>Due Date: {new Date(borrow.dueDate).toLocaleDateString()}</small>
                                                            {borrow.accruedFine > 0 && (
                                                                <Badge bg="danger" className="ms-2 badge-glow-red">₹{borrow.accruedFine} Fine</Badge>
                                                            )}
                                                        </div>
                                                        <div className="mt-2 small text-muted">
                                                            <strong>Renewals:</strong> {borrow.renewalCount || 0}/2
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="d-flex flex-wrap gap-2 mt-auto">
                                                    <Button
                                                        variant={borrow.status === 'return_pending' ? 'outline-secondary' : 'primary'}
                                                        className="flex-grow-1 d-flex align-items-center justify-content-center gap-2 mybook-btn-ripple"
                                                        onClick={() => handleReturn(borrow._id, borrow.accruedFine)}
                                                        disabled={returningId === borrow._id || borrow.status === 'pending' || borrow.status === 'return_pending'}
                                                    >
                                                        {returningId === borrow._id ? <Spinner size="sm" /> : <FiRotateCcw />}
                                                        {borrow.status === 'return_pending' ? 'Verifying Receipt...' : 'Return'}
                                                    </Button>
                                                    {borrow.status === 'borrowed' && borrow.renewalCount < 2 && (
                                                        <Button
                                                            variant="outline-primary"
                                                            className="flex-grow-1 mybook-btn-ripple"
                                                            onClick={() => handleRenew(borrow._id)}
                                                        >
                                                            Renew (7 days)
                                                        </Button>
                                                    )}
                                                    <Link to={borrow.book ? `/books/${borrow.book._id}` : '#'} className="btn btn-outline-secondary mybook-btn-ripple" disabled={!borrow.book}>
                                                        <FiInfo />
                                                    </Link>
                                                </div>
                                            </Card.Body>
                                        </Col>
                                    </Row>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                )}

                <Card className="mt-5 border-0 bg-light p-4" style={{ borderRadius: 'var(--radius-lg)' }}>
                    <div className="d-flex gap-3 align-items-start text-muted">
                        <FiInfo size={24} className="flex-shrink-0" style={{ color: 'var(--primary)' }} />
                        <div>
                            <h6 className="mb-1 fw-bold">Library Rules</h6>
                            <ul className="mb-0 small">
                                <li>The standard borrowing period is 14 days.</li>
                                <li>A fine of ₹10 per day is applicable for late returns.</li>
                                <li>You can borrow up to 3 books at a time.</li>
                                <li>Please handle books with care.</li>
                            </ul>
                        </div>
                    </div>
                </Card>
            </Container>

            {/* Custom Confirm Modal */}
            <Modal 
                show={confirmModal.show} 
                onHide={() => setConfirmModal(prev => ({ ...prev, show: false }))} 
                centered
                backdropClassName="confirm-modal-backdrop"
                dialogClassName="confirm-modal-bounce"
            >
                <Modal.Header closeButton className="confirm-title-shimmer border-0 px-4 py-3">
                    <Modal.Title className="fw-bold fs-4 d-flex align-items-center gap-2">
                        <FiAlertCircle /> {confirmModal.title}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="px-4 py-4 text-center">
                    {confirmModal.message.map((msg, idx) => (
                        <p key={idx} className="mb-2 fs-5 confirm-text-fade" style={{ animationDelay: `${0.1 * idx}s` }}>
                            {msg}
                        </p>
                    ))}
                    {confirmModal.fineAmount > 0 && (
                        <div className="mt-4 confirm-text-fade" style={{ animationDelay: '0.3s' }}>
                            <p className="mb-1 text-muted">Accrued Fine for Late Return:</p>
                            <h2 className="text-glow-red m-0">₹{confirmModal.fineAmount}</h2>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer className="border-0 px-4 pb-4 justify-content-center gap-3">
                    <Button variant="light" className="confirm-btn-3d flex-grow-1" onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}>
                        Cancel
                    </Button>
                    <Button variant="primary" className="confirm-btn-3d flex-grow-1 shadow-sm" onClick={confirmModal.onConfirm}>
                        Confirm
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default MyBooks;
