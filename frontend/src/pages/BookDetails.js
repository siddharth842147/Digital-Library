import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Badge, Spinner, ListGroup, Modal, Form } from 'react-bootstrap';
import { FiArrowLeft, FiBook, FiCalendar, FiHash, FiMapPin, FiLayers, FiCheckCircle, FiClock, FiInfo, FiHeart, FiStar } from 'react-icons/fi';
import { getBook } from '../services/bookService';
import { borrowBook } from '../services/borrowService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import { API_URL } from '../config/api';

const getLocalizedStr = (field, defaultVal = '') => {
    if (!field) return defaultVal;
    if (typeof field === 'object') {
        return field.en || field.hi || Object.values(field)[0] || defaultVal;
    }
    return field;
};

const BookDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();

    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [borrowing, setBorrowing] = useState(false);
    const [showBorrowModal, setShowBorrowModal] = useState(false);
    
    const [reviewText, setReviewText] = useState('');
    const [rating, setRating] = useState(5);
    const [submittingReview, setSubmittingReview] = useState(false);
    const [inWishlist, setInWishlist] = useState(false);

    // Set default return date to 14 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14);
    const [returnDate, setReturnDate] = useState(defaultDate.toISOString().split('T')[0]);

    useEffect(() => {
        const fetchBookDetails = async () => {
            try {
                setLoading(true);
                const response = await getBook(id);
                setBook(response.data);
                
                if (isAuthenticated) {
                    const profileRes = await axios.get(`${API_URL}/user/profile`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                    const wishlistIds = profileRes.data.data.wishlist.map(b => typeof b === 'object' ? b._id : b);
                    setInWishlist(wishlistIds.includes(response.data._id));
                }
            } catch (error) {
                toast.error('Error fetching book details');
                navigate('/books');
            } finally {
                setLoading(false);
            }
        };

        fetchBookDetails();
    }, [id, navigate]);

    const handleBorrowRequest = () => {
        if (!isAuthenticated) {
            toast.warn('Please login to borrow books');
            navigate('/login');
            return;
        }

        if (user.role !== 'student') {
            toast.info('Only students can borrow books online.');
            return;
        }

        setShowBorrowModal(true);
    };

    const handleConfirmBorrow = async () => {
        try {
            setBorrowing(true);
            const response = await borrowBook(book._id, returnDate);
            toast.success(response.message || 'Request submitted! Waiting for Admin & Librarian approval.');
            setShowBorrowModal(false);

            // Refresh book details to see updated availability
            const updatedBook = await getBook(id);
            setBook(updatedBook.data);

            navigate('/my-books');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to borrow book');
        } finally {
            setBorrowing(false);
        }
    };

    const handleReserve = async () => {
        if (!isAuthenticated) {
            toast.warn('Please login to reserve books');
            navigate('/login');
            return;
        }

        try {
            setBorrowing(true);
            const response = await axios.post(`${API_URL}/borrow/reserve/${book._id}`, {}, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success(response.data.message || 'Added to waitlist!');

            // Re-fetch book to update UI if needed
            const updatedBook = await getBook(id);
            setBook(updatedBook.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Reservation failed');
        } finally {
            setBorrowing(false);
        }
    };

    const handleWishlistToggle = async () => {
        if (!isAuthenticated) {
            toast.warn('Please login to use wishlist');
            return;
        }
        try {
            await axios.post(`${API_URL}/user/wishlist/${book._id}`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setInWishlist(!inWishlist);
            toast.success(inWishlist ? 'Removed from wishlist' : 'Added to wishlist');
        } catch (error) {
            toast.error('Failed to update wishlist');
        }
    };

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!isAuthenticated) {
            toast.warn('Please login to leave a review');
            return;
        }
        try {
            setSubmittingReview(true);
            const response = await axios.post(`${API_URL}/books/${book._id}/reviews`, {
                rating, comment: reviewText
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success('Review added successfully');
            setBook({ ...book, reviews: response.data.data, averageRating: response.data.averageRating });
            setReviewText('');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit review');
        } finally {
            setSubmittingReview(false);
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
                <Spinner animation="border" variant="primary" />
            </div>
        );
    }

    if (!book) return null;

    return (
        <div style={{ padding: '4rem 0', background: 'var(--bg-secondary)', minHeight: 'calc(100vh - 70px)' }}>
            <Container>
                <Link to="/books" className="text-decoration-none d-flex align-items-center gap-2 mb-4 text-muted hover-primary transition-all">
                    <FiArrowLeft /> Back to collection
                </Link>

                <Card className="border-0 shadow-lg overflow-hidden" style={{ borderRadius: 'var(--radius-2xl)' }}>
                    <Row className="g-0">
                        <Col lg={4} className="position-relative">
                            <img
                                src={book.coverImage?.startsWith('http') ? book.coverImage : `${API_URL.replace('/api', '')}${book.coverImage}`}
                                alt={getLocalizedStr(book.title)}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '500px' }}
                            />
                            <Badge
                                bg={book.status === 'Available' ? 'success' : 'danger'}
                                className="position-absolute top-0 end-0 m-4 px-3 py-2"
                                style={{ fontSize: '1rem', borderRadius: 'var(--radius-pill)' }}
                            >
                                {book.status}
                            </Badge>
                        </Col>

                        <Col lg={8}>
                            <Card.Body className="p-5">
                                <Badge bg="primary" className="mb-3 px-3 py-2 fw-medium">
                                    {getLocalizedStr(book.category)}
                                </Badge>
                                <h1 className="display-5 fw-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                                    {getLocalizedStr(book.title)}
                                </h1>
                                <p className="h4 text-muted mb-4 fw-normal">
                                    by {getLocalizedStr(book.author)}
                                </p>

                                <div className="mb-5">
                                    <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                        <FiBook className="text-primary" /> Description
                                    </h5>
                                    <p className="text-secondary leading-relaxed" style={{ fontSize: '1.1rem' }}>
                                        {getLocalizedStr(book.description, 'No description available for this book.')}
                                    </p>
                                </div>

                                <Row className="g-4 mb-5">
                                    <Col md={6}>
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="p-3 bg-light rounded-circle text-primary"><FiHash /></div>
                                            <div>
                                                <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>ISBN</small>
                                                <span className="fw-bold">{book.isbn}</span>
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="p-3 bg-light rounded-circle text-primary"><FiLayers /></div>
                                            <div>
                                                <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>Published By</small>
                                                <span className="fw-bold">{getLocalizedStr(book.publisher)}</span>
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="p-3 bg-light rounded-circle text-primary"><FiCalendar /></div>
                                            <div>
                                                <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>Year</small>
                                                <span className="fw-bold">{book.publishedYear}</span>
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="p-3 bg-light rounded-circle text-primary"><FiBook /></div>
                                            <div>
                                                <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>Pages</small>
                                                <span className="fw-bold">{book.pages}</span>
                                            </div>
                                        </div>
                                    </Col>
                                </Row>

                                <div className="p-4 bg-light rounded-4 d-flex justify-content-between align-items-center">
                                    <div>
                                        <h5 className="fw-bold mb-1">
                                            {book.availableCopies} / {book.totalCopies} copies available
                                        </h5>
                                        <p className="text-muted small mb-0 d-flex align-items-center gap-1">
                                            <FiMapPin /> Located at Shelf: {book.shelfLocation || 'Main Hall'}
                                        </p>
                                    </div>
                                    <Button
                                        variant={book.availableCopies > 0 ? "primary" : "warning"}
                                        size="lg"
                                        className="px-5 py-3 fw-bold shadow-sm d-flex align-items-center gap-2"
                                        style={{ borderRadius: 'var(--radius-lg)' }}
                                        onClick={book.availableCopies > 0 ? handleBorrowRequest : handleReserve}
                                        disabled={borrowing}
                                    >
                                        {borrowing ? <Spinner size="sm" /> : (
                                            book.availableCopies > 0 ? (
                                                <>Request Borrow</>
                                            ) : (
                                                <>Join Waitlist (Reserve)</>
                                            )
                                        )}
                                    </Button>
                                    <Button
                                        variant={inWishlist ? "danger" : "outline-danger"}
                                        size="lg"
                                        className="px-4 py-3 fw-bold shadow-sm ms-2 d-flex align-items-center justify-content-center"
                                        style={{ borderRadius: 'var(--radius-lg)' }}
                                        onClick={handleWishlistToggle}
                                    >
                                        <FiHeart size={24} fill={inWishlist ? "white" : "none"} />
                                    </Button>
                                </div>
                            </Card.Body>
                        </Col>
                    </Row>
                </Card>

                {/* Reviews Section */}
                <Card className="border-0 shadow-lg mt-5 p-4" style={{ borderRadius: 'var(--radius-xl)' }}>
                    <h4 className="fw-bold mb-4 d-flex align-items-center gap-2">
                        <FiStar className="text-warning" /> Reviews & Ratings
                    </h4>
                    
                    <Row>
                        <Col md={8}>
                            {book.reviews && book.reviews.length > 0 ? (
                                <ListGroup variant="flush">
                                    {book.reviews.map((review, index) => (
                                        <ListGroup.Item key={index} className="px-0 py-3 border-bottom border-light">
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <div className="fw-bold">{review.name}</div>
                                                <div className="text-muted small">{new Date(review.date).toLocaleDateString()}</div>
                                            </div>
                                            <div className="text-warning mb-2">
                                                {[...Array(5)].map((_, i) => (
                                                    <FiStar key={i} fill={i < review.rating ? "currentColor" : "none"} />
                                                ))}
                                            </div>
                                            <p className="text-secondary mb-0">{review.comment}</p>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            ) : (
                                <p className="text-muted">No reviews yet. Be the first to review this book!</p>
                            )}
                        </Col>
                        <Col md={4}>
                            <div className="bg-light p-4 rounded-3">
                                <h5 className="fw-bold mb-3">Leave a Review</h5>
                                <Form onSubmit={handleReviewSubmit}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Rating</Form.Label>
                                        <Form.Select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                                            <option value={5}>5 - Excellent</option>
                                            <option value={4}>4 - Very Good</option>
                                            <option value={3}>3 - Average</option>
                                            <option value={2}>2 - Poor</option>
                                            <option value={1}>1 - Terrible</option>
                                        </Form.Select>
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Comment</Form.Label>
                                        <Form.Control 
                                            as="textarea" 
                                            rows={3} 
                                            value={reviewText}
                                            onChange={(e) => setReviewText(e.target.value)}
                                            required
                                        />
                                    </Form.Group>
                                    <Button type="submit" variant="primary" disabled={submittingReview} className="w-100 fw-bold">
                                        {submittingReview ? <Spinner size="sm" /> : 'Submit Review'}
                                    </Button>
                                </Form>
                            </div>
                        </Col>
                    </Row>
                </Card>

                {/* Borrow Modal */}
                <Modal show={showBorrowModal} onHide={() => setShowBorrowModal(false)} centered>
                    <Modal.Header closeButton className="border-0">
                        <Modal.Title className="fw-bold">Confirm Borrowing</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="px-4 pb-4">
                        <div className="text-center mb-4">
                            <div className="d-inline-block p-4 bg-primary bg-opacity-10 rounded-circle text-primary mb-3">
                                <FiClock size={48} />
                            </div>
                            <h5>Set your Return Date</h5>
                            <p className="text-muted small">When do you plan to return <strong>"{getLocalizedStr(book.title)}"</strong>?</p>
                        </div>

                        <Form.Group className="mb-4">
                            <Form.Label className="fw-bold small text-muted">PLANED RETURN DATE</Form.Label>
                            <Form.Control
                                type="date"
                                value={returnDate}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setReturnDate(e.target.value)}
                                style={{ height: '50px', borderRadius: 'var(--radius-md)' }}
                            />
                            <Form.Text className="text-muted d-flex align-items-center gap-1 mt-2">
                                <FiCheckCircle className="text-success" /> Standard limit is 14 days. Fine ₹10/day applies if late.
                            </Form.Text>
                        </Form.Group>

                        <div className="d-flex gap-2">
                            <Button
                                variant="primary"
                                className="w-100 py-2 fw-bold"
                                onClick={handleConfirmBorrow}
                                disabled={borrowing}
                            >
                                {borrowing ? <Spinner size="sm" /> : 'Confirm Borrow'}
                            </Button>
                            <Button
                                variant="light"
                                className="w-100 py-2 fw-bold"
                                onClick={() => setShowBorrowModal(false)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </Modal.Body>
                </Modal>
            </Container>
        </div>
    );
};

export default BookDetails;
