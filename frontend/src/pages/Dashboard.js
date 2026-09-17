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

            const activeBorrows = borrows.filter(b => ['borrowed', 'overdue', 'return_pending'].includes(b.status));
            const overdueList = borrows.filter(b => b.status === 'overdue' || (new Date(b.dueDate) < new Date() && !b.returnDate));
            const totalFinesCalculated = Math.max(0, (user?.totalFines || 0) + currentBorrowsAccruedFine);

            setStats({
                totalBorrowed: activeBorrows.length,
                overdue: overdueList.length,
                pendingFines: totalFinesCalculated,
                coins: coinsData || 0,
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
        const borrowRows = (stats?.borrows || []).map(b => {
            const title = `"${(b.book?.title || 'Book').replace(/"/g, '""')} - ${(b.book?.author || '').replace(/"/g, '""')}"`;
            const issue = b.createdAt ? new Date(b.createdAt).toISOString().split('T')[0] : '';
            const due = b.dueDate ? new Date(b.dueDate).toISOString().split('T')[0] : '';
            const status = b.status || 'Active';
            const fine = b.fine || 0;
            return `Loan,${title},${issue},${due},${status},${fine}`;
        });

        const paymentRows = (stats?.payments || []).map(p => {
            const desc = `"${(p.description || (p.paymentType === 'fine' ? 'Late Fee Paid' : 'Library Fee')).replace(/"/g, '""')}"`;
            const date = p.paidAt || p.createdAt ? new Date(p.paidAt || p.createdAt).toISOString().split('T')[0] : '';
            return `Payment,${desc},${date},${date},Successful,${p.amount || 0}`;
        });

        const allRows = [...borrowRows, ...paymentRows];
        const content = headers + (allRows.length > 0 ? allRows.join("\n") : "Notice,\"No loans or transactions recorded for this account\",,,Compliant,0");

        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `JVIT_Library_Statement_${user?.name ? user.name.replace(/\s+/g, '_') : 'Member'}_2026.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.info('Statement downloaded successfully 📄');
    };

    const libraryCardId = user?.usn || `JVIT-${user?.branch || 'CS'}-2023-049`;
    const memberSinceDate = user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '8/13/2026';
    const totalBorrowedCount = stats.totalBorrowed;
    const overdueCount = stats.overdue;
    const pendingFinesVal = stats.pendingFines;
    const knowledgePtsVal = stats.coins || 0;

    const allUserLoans = stats.recentBooks || [];
    const overdueBorrows = allUserLoans.filter(b => b.status === 'overdue' || (new Date(b.dueDate) < new Date() && !b.returnDate));
    const earliestDueDate = overdueBorrows.length > 0
        ? new Date(Math.min(...overdueBorrows.map(b => new Date(b.dueDate))))
        : null;
    const earliestDueStr = earliestDueDate
        ? earliestDueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    const firstOverdue = overdueBorrows[0];
    const primaryOverdueTitle = firstOverdue
        ? getLocalizedStr(firstOverdue.book?.title, 'Overdue Book')
        : 'Outstanding Account Late Fees';
    const firstOverdueDays = firstOverdue?.dueDate
        ? Math.max(1, Math.floor((new Date() - new Date(firstOverdue.dueDate)) / (1000 * 60 * 60 * 24)))
        : null;
    const fineFormulaDesc = firstOverdueDays
        ? `Calculated formula: ${firstOverdueDays} days overdue × ₹10/day statutory late fee${overdueBorrows.length > 1 ? ` (+ ${overdueBorrows.length - 1} other item${overdueBorrows.length > 2 ? 's' : ''})` : ''}`
        : 'Accumulated overdue fine balance from previous loans or return settlements';

    const latestCompletedPayment = stats.payments?.find(p => p.status === 'completed') || stats.payments?.[0];

    const onTimeCount = Math.max(0, allUserLoans.length - overdueCount);
    const punctualityScore = allUserLoans.length === 0 ? 100 : Math.max(0, Math.round((onTimeCount / allUserLoans.length) * 100));
    const strokeGreen = Math.round((punctualityScore / 100) * 88);
    const strokeRed = Math.max(0, 88 - strokeGreen);

    return (
        <div className="dash-new-wrapper">
            <Container>
                {/* TOP WELCOME & CONTROLS HEADER */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                    <div>
                        <h1 className="dash-header-title">
                            Welcome back, {user?.name ? user.name.split(' ')[0] : 'Student'}! 👋
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
                                    <span className={totalBorrowedCount >= 3 ? 'dash-pill-tag-amber' : 'dash-pill-tag-green'}>
                                        {totalBorrowedCount >= 3 ? 'Quota Limit' : (totalBorrowedCount > 0 ? 'Active Loans' : 'Slots Available')}
                                    </span>
                                </div>
                                <div className="dash-kpi-val">
                                    <AnimatedNumber value={totalBorrowedCount} />
                                </div>
                                <div className="dash-kpi-label">Books Borrowed</div>
                            </div>
                            <div className="dash-kpi-split">
                                <span>Capacity limit</span>
                                <span className="fw-bold text-dark">{totalBorrowedCount} / 3 slots</span>
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
                                    <span className={overdueCount > 0 ? 'dash-pill-tag-red' : 'dash-pill-tag-green'}>
                                        {overdueCount > 0 ? 'Urgent Alert' : 'All Compliant'}
                                    </span>
                                </div>
                                <div className={`dash-kpi-val ${overdueCount > 0 ? 'dash-kpi-val-red' : ''}`}>
                                    <AnimatedNumber value={overdueCount} />
                                </div>
                                <div className="dash-kpi-label">Overdue Books</div>
                            </div>
                            <div className="dash-kpi-split">
                                {overdueCount > 0 ? (
                                    <>
                                        <span>Earliest due date</span>
                                        <span className="fw-bold text-danger">{earliestDueStr || 'Overdue'}</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Loan status</span>
                                        <span className="fw-bold text-success">No Overdue Books</span>
                                    </>
                                )}
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
                                    {pendingFinesVal > 0 ? (
                                        <Link to="/payment" className="dash-pill-btn-pay">Pay Now</Link>
                                    ) : (
                                        <span className="dash-pill-tag-green">All Clear</span>
                                    )}
                                </div>
                                <div className={`dash-kpi-val ${pendingFinesVal > 0 ? 'dash-kpi-val-red' : ''}`}>
                                    ₹<AnimatedNumber value={pendingFinesVal} />
                                </div>
                                <div className="dash-kpi-label">Pending Fines</div>
                            </div>
                            <div className="dash-kpi-split">
                                {pendingFinesVal > 0 ? (
                                    <>
                                        <span>Daily late fee rate</span>
                                        <span className="fw-bold text-dark">₹10 / day</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Account standing</span>
                                        <span className="fw-bold text-success">Zero Penalties</span>
                                    </>
                                )}
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
                                                    {/* Green Segment (On-time ratio) */}
                                                    <circle
                                                        cx="18" cy="18" r="14" fill="none"
                                                        stroke="#059669" strokeWidth="4.2"
                                                        strokeDasharray={`${strokeGreen} 88`} strokeDashoffset="0"
                                                        strokeLinecap="round"
                                                    />
                                                    {/* Red Segment (Overdue ratio) */}
                                                    {strokeRed > 0 && (
                                                        <circle
                                                            cx="18" cy="18" r="14" fill="none"
                                                            stroke="#ef4444" strokeWidth="4.2"
                                                            strokeDasharray={`${strokeRed} 88`} strokeDashoffset={`-${strokeGreen}`}
                                                        />
                                                    )}
                                                </svg>
                                                <div className="dash-donut-center-text">
                                                    <div className="dash-donut-score">{punctualityScore}%</div>
                                                    <div className="dash-donut-sub">ON-TIME</div>
                                                </div>
                                            </div>

                                            {/* Legend List */}
                                            <div className="d-flex flex-column gap-2" style={{ fontSize: '0.8rem' }}>
                                                <div className="d-flex align-items-center justify-content-between gap-3">
                                                    <span className="d-flex align-items-center gap-1.5 text-muted">
                                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
                                                        On-Time / Active
                                                    </span>
                                                    <span className="fw-bold">{onTimeCount} book{onTimeCount !== 1 ? 's' : ''}</span>
                                                </div>
                                                <div className="d-flex align-items-center justify-content-between gap-3">
                                                    <span className="d-flex align-items-center gap-1.5 text-muted">
                                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                                                        Overdue Items
                                                    </span>
                                                    <span className={`fw-bold ${overdueCount > 0 ? 'text-danger' : ''}`}>{overdueCount} book{overdueCount !== 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Honors Standing */}
                                    <div className="d-flex justify-content-between align-items-center pt-2 border-top border-light-subtle" style={{ fontSize: '0.78rem' }}>
                                        <span className="text-muted">Account standing</span>
                                        <span className="fw-bold" style={{ color: punctualityScore >= 80 ? '#059669' : '#d97706' }}>
                                            {punctualityScore >= 80 ? '✓ Eligible for Semester Honors' : 'Standard Good Standing'}
                                        </span>
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
                                    View All ({allUserLoans.length}) →
                                </Link>
                            </div>

                            {/* Book Item Box or Empty State */}
                            {allUserLoans.length === 0 ? (
                                <div className="text-center py-5 px-3">
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '50%',
                                        background: 'rgba(5, 150, 105, 0.1)',
                                        color: '#059669',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.75rem',
                                        marginBottom: '1rem'
                                    }}>
                                        <FiBook />
                                    </div>
                                    <h6 className="fw-bold text-dark mb-1">No Active Book Loans</h6>
                                    <p className="text-muted small mb-3" style={{ maxWidth: '400px', margin: '0 auto' }}>
                                        You don't have any borrowed books at the moment. Browse our catalog to request and borrow books.
                                    </p>
                                    <Link to="/books" className="btn btn-sm btn-success rounded-pill px-4 fw-semibold">
                                        Browse Catalog →
                                    </Link>
                                </div>
                            ) : (
                                allUserLoans.map((borrow) => {
                                    const bookTitle = getLocalizedStr(borrow.book?.title, 'Untitled Book');
                                    const bookAuthor = getLocalizedStr(borrow.book?.author, 'Unknown Author');
                                    const category = borrow.book?.category || 'General Collection';
                                    const issueDate = borrow.borrowDate || borrow.createdAt;
                                    const issueDateStr = issueDate ? new Date(issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                                    const dueDateStr = borrow.dueDate ? new Date(borrow.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

                                    const now = new Date();
                                    const due = borrow.dueDate ? new Date(borrow.dueDate) : null;
                                    const diffDays = due ? Math.floor((now - due) / (1000 * 60 * 60 * 24)) : 0;
                                    const isOverdue = borrow.status === 'overdue' || (due && due < now && !borrow.returnDate);

                                    const coverImg = borrow.book?.coverImage?.startsWith('http')
                                        ? borrow.book.coverImage
                                        : (borrow.book?.coverImage ? `${API_URL.replace('/api', '')}${borrow.book.coverImage}` : 'https://placehold.co/400x600/065f46/ffffff?text=Book');

                                    let statusTag = <span className="dash-pill-tag-green" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>ACTIVE</span>;
                                    if (borrow.status === 'pending') {
                                        statusTag = <span className="dash-pill-tag-amber" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>APPROVAL PENDING</span>;
                                    } else if (borrow.status === 'return_pending') {
                                        statusTag = <span className="dash-pill-tag-amber" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>RETURN VERIFICATION</span>;
                                    } else if (isOverdue) {
                                        statusTag = <span className="dash-pill-tag-red" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>OVERDUE</span>;
                                    }

                                    return (
                                        <div key={borrow._id} className="dash-book-loan-box">
                                            <div className="d-flex align-items-center gap-3">
                                                <img
                                                    src={coverImg}
                                                    alt={bookTitle}
                                                    className="dash-book-thumb"
                                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/52x74/065f46/ffffff?text=Book'; }}
                                                />
                                                <div>
                                                    <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                                        <span className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>{bookTitle}</span>
                                                        {statusTag}
                                                        {borrow.accruedFine > 0 && (
                                                            <span className="badge bg-danger-subtle text-danger rounded-pill px-2 py-0.5" style={{ fontSize: '0.68rem' }}>
                                                                Fine: ₹{borrow.accruedFine}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-muted small mb-2">By {bookAuthor} • Category: {category}</div>
                                                    <div className="d-flex align-items-center gap-4 text-secondary" style={{ fontSize: '0.78rem' }}>
                                                        <div>
                                                            <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Issue Date</span>
                                                            <span className="fw-semibold text-dark">{issueDateStr}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Due Date</span>
                                                            <span className={`fw-semibold ${isOverdue ? 'text-danger' : 'text-dark'}`}>{dueDateStr}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                                                                {isOverdue ? 'Days Exceeded' : 'Remaining Time'}
                                                            </span>
                                                            <span className={`fw-bold ${isOverdue ? 'text-danger' : 'text-success'}`}>
                                                                {isOverdue ? `${Math.max(1, diffDays)} Days Overdue` : `${Math.max(0, -diffDays)} Days Left`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="d-flex align-items-center gap-2 ms-auto">
                                                {borrow.status === 'borrowed' || borrow.status === 'overdue' ? (
                                                    <>
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
                                                    </>
                                                ) : (
                                                    <span className="text-muted small">Awaiting Staff Action</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* Policy Notice */}
                            <div className="dash-policy-notice">
                                <div className="d-flex align-items-center gap-2">
                                    <FiAlertCircle size={17} className="text-warning flex-shrink-0" />
                                    <span>
                                        Books returned after the due date incur a statutory fee of ₹10/day (excluding Sundays & designated holidays).
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

                            {/* Active Overdue Formula Banner or All Clear Banner */}
                            {pendingFinesVal === 0 ? (
                                <div className="dash-fine-banner" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.03) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    <div>
                                        <div className="dash-pill-tag-green mb-2" style={{ width: 'fit-content' }}>ZERO PENDING DUES</div>
                                        <h6 className="fw-bold text-dark mb-1">Account in Good Standing</h6>
                                        <p className="text-muted small mb-2">You have no overdue books or pending fines. Keep up the punctuality!</p>
                                        <div className="small text-success d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                                            <FiCheckCircle size={13} />
                                            <span>Standard borrow window is 14 days with ₹10/day grace late fee policy.</span>
                                        </div>
                                    </div>

                                    <div className="text-end d-flex flex-column align-items-end gap-1">
                                        <div className="text-uppercase text-muted fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>Accrued Total</div>
                                        <div className="fw-bold text-success" style={{ fontSize: '1.75rem', lineHeight: 1 }}>₹0</div>
                                        <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill mt-1" style={{ padding: '4px 12px' }}>Compliant</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="dash-fine-banner">
                                    <div>
                                        <div className="dash-pill-overdue-tag">ACTIVE OVERDUE</div>
                                        <h6 className="fw-bold text-dark mb-1">{primaryOverdueTitle}</h6>
                                        <p className="text-muted small mb-2">{fineFormulaDesc}</p>
                                        <div className="small text-success d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                                            <FiCheckCircle size={13} />
                                            <span>Daily late fee rate is ₹10 per day under JVIT Central Library Policy.</span>
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
                            )}

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
                                        {stats.payments && stats.payments.length > 0 ? (
                                            stats.payments.slice(0, 5).map((pay) => (
                                                <tr key={pay._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td className="py-3 ps-2">
                                                        <div className="fw-bold text-dark">
                                                            {pay.description || (pay.paymentType === 'fine' ? 'Late Fee Settlement' : 'Library Payment')}
                                                        </div>
                                                        <small className="text-muted">Txn ID: #{pay.transactionId || pay._id.slice(-8).toUpperCase()}</small>
                                                    </td>
                                                    <td className="py-3 text-secondary text-capitalize">{pay.paymentMethod || 'Online'}</td>
                                                    <td className="py-3 text-secondary">
                                                        {new Date(pay.paidAt || pay.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </td>
                                                    <td className="py-3 fw-bold text-dark">₹{pay.amount}</td>
                                                    <td className="py-3 text-end pe-2">
                                                        <span className={pay.status === 'completed' ? 'dash-pill-tag-green' : (pay.status === 'failed' ? 'dash-pill-tag-red' : 'dash-pill-tag-amber')}>
                                                            {pay.status === 'completed' ? 'Successful' : (pay.status === 'failed' ? 'Failed' : 'Pending')}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="5" className="text-center py-4 text-muted small">
                                                    No transaction records found yet. Settled fine payments and receipts will appear here.
                                                </td>
                                            </tr>
                                        )}
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

                            <h4 className="dash-user-name">{user?.name || 'Student Member'}</h4>
                            <p className="dash-user-email">{user?.email || 'student@jvit.edu.in'}</p>

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

                            {pendingFinesVal > 0 ? (
                                <Link to="/payment" className="dash-btn-pay-fines-full">
                                    <span>₹</span> PAY FINES (₹{pendingFinesVal})
                                </Link>
                            ) : (
                                <div className="dash-btn-pay-fines-full" style={{ background: '#059669', opacity: 0.9, cursor: 'default' }}>
                                    <FiCheckCircle size={15} /> NO PENDING FINES (₹0)
                                </div>
                            )}
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
                    {latestCompletedPayment ? (
                        <>
                            <div className="p-3 border rounded-3 bg-light text-center mb-3">
                                <h5 className="fw-bold text-success mb-1">JVIT Central Library</h5>
                                <div className="text-muted small">Jnana Vikas Institute of Technology</div>
                                <div className="text-muted small">
                                    Receipt No: #REC-{latestCompletedPayment.transactionId || latestCompletedPayment._id.slice(-8).toUpperCase()}
                                </div>
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
                                <span className="fw-bold">{latestCompletedPayment.description || 'Library Fine Payment'}</span>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                                <span className="text-muted">Payment Channel:</span>
                                <span className="fw-bold text-capitalize">{latestCompletedPayment.paymentMethod || 'Online'} / Verified</span>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                                <span className="text-muted">Payment Date:</span>
                                <span className="fw-semibold">
                                    {new Date(latestCompletedPayment.paidAt || latestCompletedPayment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                            </div>
                            <hr />
                            <div className="d-flex justify-content-between fw-bold fs-5">
                                <span>Total Paid:</span>
                                <span className="text-success">₹{latestCompletedPayment.amount}.00</span>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-4 text-muted">
                            <FiFileText size={36} className="mb-2 text-secondary opacity-50" />
                            <p className="mb-0">No completed payment records found to generate a receipt.</p>
                            <small>Completed fine settlements will be printable here.</small>
                        </div>
                    )}
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
                        Submit a formal extension request for <strong>{getLocalizedStr(extensionModal.book?.book?.title, 'Selected Book')}</strong> to the chief librarian.
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
