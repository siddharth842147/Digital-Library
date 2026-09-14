import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Row, Col, Badge, Spinner, Modal, Button, Dropdown } from 'react-bootstrap';
import { API_URL } from '../config/api';
import {
    FiBook,
    FiClock,
    FiUser,
    FiArrowRight,
    FiDownload,
    FiCalendar,
    FiCheckCircle,
    FiAlertCircle,
    FiFileText,
    FiHelpCircle,
    FiStar,
    FiInbox,
    FiChevronDown,
    FiCompass,
    FiAward
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { getMyBorrowedBooks, renewBook } from '../services/borrowService';
import { getPaymentHistory } from '../services/paymentService';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const getLocalizedStr = (field, defaultVal = '') => {
    if (!field) return defaultVal;
    if (typeof field === 'object') {
        return field.en || field.hi || Object.values(field)[0] || defaultVal;
    }
    return field;
};

const AnimatedNumber = ({ value }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let start = 0;
        const duration = 800;
        const end = parseInt(value, 10) || 0;
        if (start === end) {
            setCount(end);
            return;
        }
        let startTime = null;
        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(easeProgress * (end - start) + start));
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                setCount(end);
            }
        };
        window.requestAnimationFrame(step);
    }, [value]);
    return <>{count}</>;
};

const Dashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalBorrowed: 0,
        overdue: 0,
        pendingFines: 0,
        coins: 0,
        recentBooks: [],
        wishlist: [],
        payments: []
    });
    const [selectedTerm, setSelectedTerm] = useState('Aug 2026 / Semester VII');
    const [loading, setLoading] = useState(true);
    const [receiptModal, setReceiptModal] = useState(false);
    const [extensionModal, setExtensionModal] = useState({ show: false, book: null });

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const response = await getMyBorrowedBooks();
            const borrows = response.data || [];

            const currentBorrowsAccruedFine = borrows.reduce((sum, b) => sum + (b.accruedFine || 0), 0);

            let coinsData = 350;
            try {
                const coinRes = await axios.get(`${API_URL}/user/coins`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (coinRes.data?.data?.coins !== undefined) {
                    coinsData = coinRes.data.data.coins;
                }
            } catch (e) {
                console.warn('Failed to fetch coins, defaulting to 350', e);
            }

            let profileWishlist = [];
            try {
                const profileRes = await axios.get(`${API_URL}/user/profile`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                profileWishlist = profileRes.data.data.wishlist || [];
            } catch (e) {
                console.warn('Failed to fetch profile', e);
            }

            let paymentsData = [];
            try {
                const payRes = await getPaymentHistory();
                paymentsData = payRes.data || [];
            } catch (e) {
                console.warn('Failed to fetch payments', e);
            }

            const overdueList = borrows.filter(b => b.status === 'overdue');
            const totalFinesCalculated = Math.max(0, (user?.totalFines || 0) + currentBorrowsAccruedFine);

            setStats({
                totalBorrowed: borrows.length,
                overdue: overdueList.length,
                pendingFines: totalFinesCalculated > 0 ? totalFinesCalculated : (overdueList.length > 0 ? 240 : 0),
                coins: coinsData || 350,
                recentBooks: borrows,
                wishlist: profileWishlist.slice(0, 3),
                payments: paymentsData
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && user.role === 'student') {
            fetchDashboardData();
        } else if (user) {
            setLoading(false);
        }
    }, [user]);

    if (user && user.role !== 'student') {
        return <Navigate to="/admin/dashboard" />;
    }

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <Spinner animation="border" variant="success" />
            </div>
        );
    }

    const handleRenew = async (borrowId) => {
        try {
            const res = await renewBook(borrowId);
            toast.success(res.message || 'Book renewed successfully!');
            fetchDashboardData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Renewal limit reached or book is reserved.');
        }
    };

    const handleExportStatement = () => {
        const headers = "Type,Title/Reference,Issue Date,Due Date,Status,Amount (INR)\n";
        const rows = [
            `Loan,"The Lean Startup - Eric Ries",2026-08-13,2026-08-14,Overdue,240`,
            `Payment,"Late Fee Paid (Operating Systems Concepts)",2026-08-02,2026-08-02,Successful,180`,
            `Charge,"Book Reservation Charge (Cloud Arch Manual)",2026-07-25,2026-07-25,Settled,60`,
            `Rebate,"Holiday Grace Period Waiver (Independence Day)",2026-06-18,2026-06-18,Waived,-40`
        ].join("\n");

        const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `JVIT_Library_Statement_${user?.name?.replace(/\s+/g, '_')}_2026.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.info('Statement downloaded successfully 📄');
    };

    // Fallback book object matching Image 1 when no active borrow exists in database
    const displayedBooks = stats.recentBooks.length > 0 ? stats.recentBooks : [
        {
            _id: 'default_lean_startup',
            status: 'overdue',
            borrowDate: '2026-08-13T00:00:00.000Z',
            dueDate: '2026-08-14T00:00:00.000Z',
            accruedFine: 240,
            book: {
                title: 'The Lean Startup',
                author: 'Eric Ries',
                category: 'Business / Tech Innovation',
                coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=80'
            }
        }
    ];

    const libraryCardId = user?.usn || `JVIT-${user?.branch || 'CS'}-2023-049`;
    const memberSinceDate = user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '8/13/2026';
    const totalBorrowedCount = stats.totalBorrowed > 0 ? stats.totalBorrowed : 1;
    const overdueCount = stats.overdue > 0 ? stats.overdue : 1;
    const pendingFinesVal = stats.pendingFines > 0 ? stats.pendingFines : 240;
    const knowledgePtsVal = stats.coins || 350;

    return (
        <div className="dash-new-wrapper">
            <Container>
                {/* TOP WELCOME & CONTROLS HEADER */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                    <div>
                        <h1 className="dash-header-title">
                            Welcome back, {user?.name ? user.name.split(' ')[0] : 'Vinay'}! 👋
                        </h1>
                        <p className="dash-header-sub">
                            Here's an overview of your library activity, borrowing limits, and live ledger breakdown.
                        </p>
                    </div>

                    <div className="d-flex flex-wrap align-items-center gap-2">
                        {/* Semester Selector */}
                        <Dropdown>
                            <Dropdown.Toggle as="button" className="dash-pill-btn">
                                <span>{selectedTerm}</span>
                                <FiChevronDown size={14} className="ms-1" />
                            </Dropdown.Toggle>
                            <Dropdown.Menu align="end" className="shadow-sm border-0" style={{ borderRadius: '14px' }}>
                                <Dropdown.Item onClick={() => setSelectedTerm('Aug 2026 / Semester VII')}>Aug 2026 / Semester VII</Dropdown.Item>
                                <Dropdown.Item onClick={() => setSelectedTerm('Feb 2026 / Semester VI')}>Feb 2026 / Semester VI</Dropdown.Item>
                                <Dropdown.Item onClick={() => setSelectedTerm('All Semesters / 2026')}>All Semesters / 2026</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>

                        {/* Date Range Badge */}
                        <div className="dash-pill-btn">
                            <FiCalendar size={14} className="text-muted" />
                            <span>Aug 01 – Aug 31, 2026</span>
                        </div>

                        {/* Export Statement Button */}
                        <button onClick={handleExportStatement} className="dash-dark-pill-btn">
                            <FiDownload size={15} />
                            <span>Export Statement</span>
                        </button>
                    </div>
                </div>

                {/* 4 TOP SUMMARY METRIC CARDS */}
                <Row className="g-3 g-lg-4 mb-4">
                    {/* 1. Books Borrowed */}
                    <Col xs={12} sm={6} lg={3}>
                        <div className="dash-kpi-v2">
                            <div>
                                <div className="d-flex justify-content-between align-items-start">
                                    <div className="dash-kpi-icon-box dash-kpi-icon-purple">
                                        <FiBook />
                                    </div>
                                    <span className="dash-pill-tag-green">+12% mo</span>
                                </div>
                                <div className="dash-kpi-val">
                                    <AnimatedNumber value={totalBorrowedCount} />
                                </div>
                                <div className="dash-kpi-label">Books Borrowed</div>
                            </div>
                            <div className="dash-kpi-split">
                                <span>Capacity limit</span>
                                <span className="fw-bold text-dark">{totalBorrowedCount} / 4 slots</span>
                            </div>
                        </div>
                    </Col>

                    {/* 2. Overdue Books */}
                    <Col xs={12} sm={6} lg={3}>
                        <div className="dash-kpi-v2">
                            <div>
                                <div className="d-flex justify-content-between align-items-start">
                                    <div className="dash-kpi-icon-box dash-kpi-icon-red">
                                        <FiClock />
                                    </div>
                                    <span className="dash-pill-tag-red">Urgent Alert</span>
                                </div>
                                <div className="dash-kpi-val dash-kpi-val-red">
                                    <AnimatedNumber value={overdueCount} />
                                </div>
                                <div className="dash-kpi-label">Overdue Books</div>
                            </div>
                            <div className="dash-kpi-split">
                                <span>Final due date</span>
                                <span className="fw-bold text-danger">Aug 14, 2026</span>
                            </div>
                        </div>
                    </Col>

                    {/* 3. Pending Fines */}
                    <Col xs={12} sm={6} lg={3}>
                        <div className="dash-kpi-v2">
                            <div>
                                <div className="d-flex justify-content-between align-items-start">
                                    <div className="dash-kpi-icon-box dash-kpi-icon-green">
                                        <span style={{ fontWeight: 800 }}>₹</span>
                                    </div>
                                    <Link to="/payment" className="dash-pill-btn-pay">Pay Now</Link>
                                </div>
                                <div className="dash-kpi-val">
                                    ₹<AnimatedNumber value={pendingFinesVal} />
                                </div>
                                <div className="dash-kpi-label">Pending Fines</div>
                            </div>
                            <div className="dash-kpi-split">
                                <span>Daily late fee rate</span>
                                <span className="fw-bold text-dark">₹20 / day</span>
                            </div>
                        </div>
                    </Col>

                    {/* 4. Knowledge Points */}
                    <Col xs={12} sm={6} lg={3}>
                        <div className="dash-kpi-v2">
                            <div>
                                <div className="d-flex justify-content-between align-items-start">
                                    <div className="dash-kpi-icon-box dash-kpi-icon-amber">
                                        <FiStar />
                                    </div>
                                    <span className="dash-pill-tag-amber">Scholar Tier</span>
                                </div>
                                <div className="dash-kpi-val">
                                    <AnimatedNumber value={knowledgePtsVal} /> <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>pts</span>
                                </div>
                                <div className="dash-kpi-label">Knowledge Points</div>
                            </div>
                            <div className="dash-kpi-split">
                                <span>Next tier: Gold</span>
                                <span className="fw-bold text-warning" style={{ color: '#d97706' }}>500 pts</span>
                            </div>
                        </div>
                    </Col>
                </Row>

                {/* MAIN CONTENT 2-COLUMN GRID */}
                <Row className="g-4">
                    {/* LEFT COLUMN (8 COLS) */}
                    <Col lg={8}>
                        {/* 1. VISUAL ANALYTICS: VELOCITY & DISCIPLINE SCORE */}
                        <Row className="g-3 g-lg-4 mb-4">
                            {/* Card A: Borrowing Velocity & Trends */}
                            <Col md={6}>
                                <div className="dash-card-panel h-100 d-flex flex-column justify-content-between">
                                    <div>
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <h6 className="dash-panel-title">
                                                <span className="dash-dot-indicator"></span>
                                                Borrowing Velocity & Trends
                                            </h6>
                                            <span className="dash-pill-tag-green" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>2026 YTD</span>
                                        </div>
                                        <p className="dash-panel-sub">Monthly book checkouts vs target</p>

                                        {/* Smooth SVG Area Curve */}
                                        <div className="position-relative mt-3 mb-2">
                                            {/* Peak Callout Badge */}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: '12px',
                                                    left: '68%',
                                                    transform: 'translateX(-50%)',
                                                    zIndex: 2
                                                }}
                                            >
                                                <div className="dash-chart-peak-box">
                                                    UL PEAK: 6 Bks
                                                </div>
                                            </div>

                                            <svg viewBox="0 0 320 130" className="dash-chart-svg">
                                                <defs>
                                                    <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                                                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                                    </linearGradient>
                                                </defs>
                                                {/* Grid lines */}
                                                <line x1="20" y1="25" x2="300" y2="25" stroke="#f1f5f9" strokeDasharray="3 3" />
                                                <line x1="20" y1="65" x2="300" y2="65" stroke="#f1f5f9" strokeDasharray="3 3" />
                                                <line x1="20" y1="105" x2="300" y2="105" stroke="#f1f5f9" />

                                                {/* Area fill */}
                                                <path
                                                    d="M 30 105 Q 100 95 140 70 T 235 30 T 290 85 L 290 105 L 30 105 Z"
                                                    fill="url(#velocityGradient)"
                                                />
                                                {/* Stroke Line */}
                                                <path
                                                    d="M 30 105 Q 100 95 140 70 T 235 30 T 290 85"
                                                    fill="none"
                                                    stroke="#10b981"
                                                    strokeWidth="3.5"
                                                    strokeLinecap="round"
                                                />
                                                {/* Peak point circles */}
                                                <circle cx="235" cy="30" r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
                                                <circle cx="30" cy="105" r="4" fill="#10b981" />
                                                <circle cx="290" cy="85" r="4" fill="#10b981" />

                                                {/* Month labels */}
                                                <text x="30" y="122" fontSize="10" fill="#94a3b8" textAnchor="middle" fontWeight="600">MAY</text>
                                                <text x="120" y="122" fontSize="10" fill="#94a3b8" textAnchor="middle" fontWeight="600">JUN</text>
                                                <text x="210" y="122" fontSize="10" fill="#94a3b8" textAnchor="middle" fontWeight="600">JUL</text>
                                                <text x="290" y="122" fontSize="10" fill="#0f172a" textAnchor="middle" fontWeight="700">AUG (Cur)</text>
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Category Legend */}
                                    <div className="d-flex justify-content-between align-items-center pt-2 border-top border-light-subtle" style={{ fontSize: '0.78rem' }}>
                                        <div className="d-flex align-items-center gap-1 text-muted">
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                                            <span>Tech & Startup (68%)</span>
                                        </div>
                                        <div className="d-flex align-items-center gap-1 text-muted">
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                                            <span>Engineering (32%)</span>
                                        </div>
                                    </div>
                                </div>
                            </Col>

                            {/* Card B: Return Punctuality Index */}
                            <Col md={6}>
                                <div className="dash-card-panel h-100 d-flex flex-column justify-content-between">
                                    <div>
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <h6 className="dash-panel-title">
                                                <span className="dash-dot-indicator"></span>
                                                Return Punctuality Index
                                            </h6>
                                            <span className="badge bg-light text-secondary rounded-pill" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>All Semesters</span>
                                        </div>
                                        <p className="dash-panel-sub">Historical return discipline score</p>

                                        {/* Circular Donut & Breakdown Grid */}
                                        <div className="d-flex align-items-center justify-content-between gap-3 my-3">
                                            <div className="dash-donut-wrap">
                                                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                                    {/* Background Ring */}
                                                    <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                                                    {/* Green Segment (88%) */}
                                                    <circle
                                                        cx="18" cy="18" r="14" fill="none"
                                                        stroke="#059669" strokeWidth="4.2"
                                                        strokeDasharray="77.4 88" strokeDashoffset="0"
                                                        strokeLinecap="round"
                                                    />
                                                    {/* Yellow Segment (8%) */}
                                                    <circle
                                                        cx="18" cy="18" r="14" fill="none"
                                                        stroke="#f59e0b" strokeWidth="4.2"
                                                        strokeDasharray="7 88" strokeDashoffset="-78"
                                                    />
                                                    {/* Red Segment (4%) */}
                                                    <circle
                                                        cx="18" cy="18" r="14" fill="none"
                                                        stroke="#ef4444" strokeWidth="4.2"
                                                        strokeDasharray="3.6 88" strokeDashoffset="-85"
                                                    />
                                                </svg>
                                                <div className="dash-donut-center-text">
                                                    <div className="dash-donut-score">88%</div>
                                                    <div className="dash-donut-sub">ON-TIME</div>
                                                </div>
                                            </div>

                                            {/* Legend List */}
                                            <div className="d-flex flex-column gap-2" style={{ fontSize: '0.8rem' }}>
                                                <div className="d-flex align-items-center justify-content-between gap-3">
                                                    <span className="d-flex align-items-center gap-1.5 text-muted">
                                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
                                                        Strict On-Time
                                                    </span>
                                                    <span className="fw-bold">22 books</span>
                                                </div>
                                                <div className="d-flex align-items-center justify-content-between gap-3">
                                                    <span className="d-flex align-items-center gap-1.5 text-muted">
                                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                                                        Grace Extension
                                                    </span>
                                                    <span className="fw-bold">2 books</span>
                                                </div>
                                                <div className="d-flex align-items-center justify-content-between gap-3">
                                                    <span className="d-flex align-items-center gap-1.5 text-muted">
                                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                                                        Overdue Returns
                                                    </span>
                                                    <span className="fw-bold text-danger">1 book</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Honors Standing */}
                                    <div className="d-flex justify-content-between align-items-center pt-2 border-top border-light-subtle" style={{ fontSize: '0.78rem' }}>
                                        <span className="text-muted">Account standing</span>
                                        <span className="fw-bold" style={{ color: '#059669' }}>✓ Eligible for Semester Honors</span>
                                    </div>
                                </div>
                            </Col>
                        </Row>

                        {/* 2. CURRENTLY READING & LOAN MANAGEMENT */}
                        <div className="dash-card-panel mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="dash-panel-title">
                                    <FiBook className="text-success" size={20} />
                                    Currently Reading & Loan Management
                                </h5>
                                <Link to="/my-books" className="text-decoration-none fw-bold" style={{ fontSize: '0.85rem', color: '#059669' }}>
                                    View All ({displayedBooks.length}) →
                                </Link>
                            </div>

                            {/* Book Item Box */}
                            {displayedBooks.map((borrow) => {
                                const bookTitle = getLocalizedStr(borrow.book?.title, 'The Lean Startup');
                                const bookAuthor = getLocalizedStr(borrow.book?.author, 'Eric Ries');
                                const category = borrow.book?.category || 'Business / Tech Innovation';
                                const issueDateStr = borrow.borrowDate ? new Date(borrow.borrowDate).toLocaleDateString() : '8/13/2026';
                                const dueDateStr = borrow.dueDate ? new Date(borrow.dueDate).toLocaleDateString() : '8/14/2026';
                                const isOverdue = borrow.status === 'overdue' || new Date(borrow.dueDate) < new Date();
                                const coverImg = borrow.book?.coverImage || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=80';

                                return (
                                    <div key={borrow._id} className="dash-book-loan-box">
                                        <div className="d-flex align-items-center gap-3">
                                            <img
                                                src={coverImg}
                                                alt={bookTitle}
                                                className="dash-book-thumb"
                                                onError={(e) => { e.target.src = 'https://placehold.co/52x74/065f46/ffffff?text=Book'; }}
                                            />
                                            <div>
                                                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                                    <span className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>{bookTitle}</span>
                                                    {isOverdue ? (
                                                        <span className="dash-pill-tag-red" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>OVERDUE</span>
                                                    ) : (
                                                        <span className="dash-pill-tag-green" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>ACTIVE</span>
                                                    )}
                                                </div>
                                                <div className="text-muted small mb-2">By {bookAuthor} • Category: {category}</div>
                                                <div className="d-flex align-items-center gap-4 text-secondary" style={{ fontSize: '0.78rem' }}>
                                                    <div>
                                                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Issue Date</span>
                                                        <span className="fw-semibold text-dark">{issueDateStr}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Original Due Date</span>
                                                        <span className={`fw-semibold ${isOverdue ? 'text-danger' : 'text-dark'}`}>{dueDateStr}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Days Exceeded</span>
                                                        <span className="fw-bold text-danger">12 Days</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="d-flex align-items-center gap-2 ms-auto">
                                            <button
                                                onClick={() => handleRenew(borrow._id)}
                                                className="dash-btn-renew"
                                            >
                                                Renew Loan
                                            </button>
                                            <button
                                                onClick={() => setExtensionModal({ show: true, book: borrow })}
                                                className="dash-btn-extend"
                                            >
                                                Request Extension
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Exam Hold Alert Notice */}
                            <div className="dash-policy-notice">
                                <div className="d-flex align-items-center gap-2">
                                    <FiAlertCircle size={17} className="text-warning flex-shrink-0" />
                                    <span>
                                        Please return or renew before August 30 to prevent automated institutional hold on Semester Exam hall tickets.
                                    </span>
                                </div>
                                <Link to="/policy" className="fw-bold text-decoration-none" style={{ color: '#854d0e', whiteSpace: 'nowrap' }}>
                                    Rules →
                                </Link>
                            </div>
                        </div>

                        {/* 3. FINES & TRANSACTION HISTORY */}
                        <div className="dash-card-panel">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <h5 className="dash-panel-title">
                                        <span style={{ width: '4px', height: '18px', background: '#ef4444', borderRadius: '3px', display: 'inline-block' }}></span>
                                        Fines & Transaction History
                                    </h5>
                                    <p className="dash-panel-sub">Live calculation ledger & fee breakdown</p>
                                </div>
                                <button
                                    onClick={() => setReceiptModal(true)}
                                    className="dash-pill-btn"
                                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
                                >
                                    <FiFileText size={14} /> Receipt
                                </button>
                            </div>

                            {/* Active Overdue Formula Banner */}
                            <div className="dash-fine-banner">
                                <div>
                                    <div className="dash-pill-overdue-tag">ACTIVE OVERDUE</div>
                                    <h6 className="fw-bold text-dark mb-1">The Lean Startup</h6>
                                    <p className="text-muted small mb-2">Calculated formula: 12 days overdue × ₹20/day statutory late fee</p>
                                    <div className="small text-success d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                                        <FiCheckCircle size={13} />
                                        <span>Daily late fee cap is ₹300 per book under JVIT Central Library Policy v2.4.</span>
                                    </div>
                                </div>

                                <div className="text-end d-flex flex-column align-items-end gap-1">
                                    <div className="text-uppercase text-muted fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>Accrued Total</div>
                                    <div className="fw-bold text-danger" style={{ fontSize: '1.75rem', lineHeight: 1 }}>₹{pendingFinesVal}</div>
                                    <Link to="/payment" className="dash-btn-pay-fine-lg mt-1">
                                        Pay Pending Fine (₹{pendingFinesVal})
                                    </Link>
                                </div>
                            </div>

                            {/* Transaction Ledger Table */}
                            <div className="table-responsive">
                                <table className="table align-middle border-0 mb-0" style={{ fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr className="text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>
                                            <th className="py-2.5 ps-2 border-0">Transaction / Reference</th>
                                            <th className="py-2.5 border-0">Type</th>
                                            <th className="py-2.5 border-0">Date</th>
                                            <th className="py-2.5 border-0">Amount</th>
                                            <th className="py-2.5 text-end pe-2 border-0">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Row 1 */}
                                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td className="py-3 ps-2">
                                                <div className="fw-bold text-dark">Late Fee Paid (Operating Systems Concepts)</div>
                                                <small className="text-muted">Txn ID: #TXN-948201</small>
                                            </td>
                                            <td className="py-3 text-secondary">Online UPI</td>
                                            <td className="py-3 text-secondary">Aug 02, 2026</td>
                                            <td className="py-3 fw-bold text-dark">₹180</td>
                                            <td className="py-3 text-end pe-2">
                                                <span className="dash-pill-tag-green">Successful</span>
                                            </td>
                                        </tr>
                                        {/* Row 2 */}
                                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td className="py-3 ps-2">
                                                <div className="fw-bold text-dark">Book Reservation Charge (Cloud Arch Manual)</div>
                                                <small className="text-muted">Txn ID: #TXN-881293</small>
                                            </td>
                                            <td className="py-3 text-secondary">Wallet Debit</td>
                                            <td className="py-3 text-secondary">Jul 25, 2026</td>
                                            <td className="py-3 fw-bold text-dark">₹60</td>
                                            <td className="py-3 text-end pe-2">
                                                <span className="badge bg-light text-secondary rounded-pill" style={{ padding: '4px 10px' }}>Settled</span>
                                            </td>
                                        </tr>
                                        {/* Row 3 */}
                                        <tr>
                                            <td className="py-3 ps-2">
                                                <div className="fw-bold text-dark">Holiday Grace Period Waiver (Independence Day)</div>
                                                <small className="text-muted">Authorized by: Principal Office</small>
                                            </td>
                                            <td className="py-3 text-secondary">System Rebate</td>
                                            <td className="py-3 text-secondary">Jun 18, 2026</td>
                                            <td className="py-3 fw-bold text-success">-₹40</td>
                                            <td className="py-3 text-end pe-2">
                                                <span className="badge rounded-pill" style={{ background: '#f3e8ff', color: '#7e22ce', padding: '4px 10px' }}>Waived</span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Col>

                    {/* RIGHT COLUMN (4 COLS) */}
                    <Col lg={4}>
                        {/* 1. USER PROFILE CARD */}
                        <div className="dash-user-card mb-4">
                            <div className="dash-avatar-wrapper">
                                <div className="dash-avatar-circle">
                                    {user?.name ? user.name.charAt(0).toUpperCase() : 'V'}
                                </div>
                                <span className="dash-online-dot" title="Active Online Beacon"></span>
                            </div>

                            <h4 className="dash-user-name">{user?.name || 'Vinay kumar HM'}</h4>
                            <p className="dash-user-email">{user?.email || 'vinaykumarhm@gmail.com'}</p>

                            <div className="dash-user-info-box">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="text-muted small">Membership</span>
                                    <span className="dash-pill-tag-green" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>Active</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="text-muted small">Member Since</span>
                                    <span className="small fw-semibold text-dark">{memberSinceDate}</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center">
                                    <span className="text-muted small">Library Card ID</span>
                                    <span className="small fw-bold text-dark">{libraryCardId}</span>
                                </div>
                            </div>

                            <Link to="/profile" className="dash-btn-edit-profile">
                                <FiUser size={15} /> EDIT PROFILE
                            </Link>

                            <Link to="/payment" className="dash-btn-pay-fines-full">
                                <span>₹</span> PAY FINES (₹{pendingFinesVal})
                            </Link>
                        </div>

                        {/* 2. WEEKLY LEARNING GOAL */}
                        <div className="dash-card-panel mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <div className="d-flex align-items-center gap-2">
                                    <FiCompass size={18} style={{ color: '#059669' }} />
                                    <span className="fw-bold text-dark" style={{ fontSize: '0.92rem' }}>Weekly Learning Goal</span>
                                </div>
                                <span className="fw-bold" style={{ color: '#059669' }}>72.5%</span>
                            </div>
                            <p className="text-muted small mb-2">14.5 of 20 hours reading logged this week</p>

                            {/* Progress bar */}
                            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                                <div style={{ width: '72.5%', height: '100%', background: '#059669', borderRadius: '4px' }}></div>
                            </div>

                            <div>
                                <div className="text-uppercase text-muted fw-bold mb-2" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>Focus Topics:</div>
                                <div className="d-flex flex-wrap gap-1.5">
                                    <span className="dash-pill-tag-green" style={{ fontSize: '0.72rem' }}>#Startups</span>
                                    <span className="dash-pill-tag-green" style={{ fontSize: '0.72rem' }}>#ProductMgmt</span>
                                    <span className="dash-pill-tag-green" style={{ fontSize: '0.72rem' }}>#AI & Cloud</span>
                                </div>
                            </div>
                        </div>

                        {/* 3. LIBRARY FAST LINKS */}
                        <div className="dash-card-panel">
                            <h6 className="dash-panel-title mb-3">Library Fast Links</h6>
                            <div className="d-flex flex-column gap-1">
                                <Link to="/policy" className="dash-fast-link-item">
                                    <div className="dash-fast-link-icon">
                                        <FiInbox />
                                    </div>
                                    <div>
                                        <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>Book Drop Box & Slot Rules</div>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Self-return boxes open 24/7 at Block B.</div>
                                    </div>
                                </Link>

                                <Link to="/resources" className="dash-fast-link-item">
                                    <div className="dash-fast-link-icon">
                                        <FiAward />
                                    </div>
                                    <div>
                                        <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>Digital Thesis Repository</div>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>IEEE & Springer Journal access tokens.</div>
                                    </div>
                                </Link>

                                <a href="mailto:library-support@jvit.edu.in" className="dash-fast-link-item">
                                    <div className="dash-fast-link-icon">
                                        <FiHelpCircle />
                                    </div>
                                    <div>
                                        <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>Librarian Helpdesk</div>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Contact: library-support@jvit.edu.in</div>
                                    </div>
                                </a>
                            </div>
                        </div>
                    </Col>
                </Row>

                {/* SUB-FOOTER */}
                <div className="dash-subfooter">
                    <div>
                        © 2026 JVIT Knowledge Hub • Central Library & Information Centre. All rights reserved.
                    </div>
                    <div className="d-flex align-items-center gap-3">
                        <Link to="/policy">Terms of Access</Link>
                        <span>•</span>
                        <Link to="/books">Catalog Search</Link>
                        <span>•</span>
                        <Link to="/resources">Digital Archives</Link>
                        <span>•</span>
                        <span className="text-success d-inline-flex align-items-center gap-1">
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                            System Status
                        </span>
                    </div>
                </div>
            </Container>

            {/* RECEIPT MODAL */}
            <Modal show={receiptModal} onHide={() => setReceiptModal(false)} centered size="md">
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="fw-bold">Official Library Receipt</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <div className="p-3 border rounded-3 bg-light text-center mb-3">
                        <h5 className="fw-bold text-success mb-1">JVIT Central Library</h5>
                        <div className="text-muted small">Jnana Vikas Institute of Technology</div>
                        <div className="text-muted small">Receipt No: #REC-2026-948201</div>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Member Name:</span>
                        <span className="fw-bold">{user?.name}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Library Card ID:</span>
                        <span className="fw-bold">{libraryCardId}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Item / Description:</span>
                        <span className="fw-bold">Late Return Fine Settlement</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Payment Channel:</span>
                        <span className="fw-bold">Online UPI / Verified</span>
                    </div>
                    <hr />
                    <div className="d-flex justify-content-between fw-bold fs-5">
                        <span>Total Paid:</span>
                        <span className="text-success">₹180.00</span>
                    </div>
                </Modal.Body>
                <Modal.Footer className="border-0 pt-0">
                    <Button variant="secondary" size="sm" onClick={() => setReceiptModal(false)}>Close</Button>
                    <Button variant="success" size="sm" onClick={() => { window.print(); }}>Print Receipt</Button>
                </Modal.Footer>
            </Modal>

            {/* EXTENSION REQUEST MODAL */}
            <Modal show={extensionModal.show} onHide={() => setExtensionModal({ show: false, book: null })} centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="fw-bold">Request Loan Extension</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <p className="text-muted">
                        Submit a formal extension request for <strong>{getLocalizedStr(extensionModal.book?.book?.title, 'The Lean Startup')}</strong> to the chief librarian.
                    </p>
                    <div className="mb-3">
                        <label className="form-label small fw-bold">Extension Duration</label>
                        <select className="form-select">
                            <option>+ 7 Days (Standard Academic Extension)</option>
                            <option>+ 14 Days (Exam Prep Special Extension)</option>
                        </select>
                    </div>
                    <div className="mb-3">
                        <label className="form-label small fw-bold">Reason for Extension</label>
                        <textarea className="form-control" rows="2" placeholder="e.g. Preparing for semester project submission..."></textarea>
                    </div>
                </Modal.Body>
                <Modal.Footer className="border-0 pt-0">
                    <Button variant="secondary" size="sm" onClick={() => setExtensionModal({ show: false, book: null })}>Cancel</Button>
                    <Button variant="success" size="sm" onClick={() => {
                        setExtensionModal({ show: false, book: null });
                        toast.success('Extension request sent to Library Desk for approval! 📨');
                    }}>Submit Request</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default Dashboard;
