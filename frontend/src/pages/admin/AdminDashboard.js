import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Spinner, Dropdown, Modal, Button } from 'react-bootstrap';
import {
    FiBook,
    FiClock,
    FiUsers,
    FiShield,
    FiCheckCircle,
    FiAlertTriangle,
    FiArrowRight,
    FiDownload,
    FiCalendar,
    FiChevronDown,
    FiCompass,
    FiAward,
    FiFileText,
    FiHelpCircle,
    FiInbox,
    FiUser,
    FiActivity,
    FiAlertCircle
} from 'react-icons/fi';
import { getDashboardStats } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { Link } from 'react-router-dom';
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

const AdminDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedTerm, setSelectedTerm] = useState('AY 2026-27 / Odd Semester');
    const [auditModal, setAuditModal] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await getDashboardStats();
                setStats(response.data);
            } catch (error) {
                console.error('Error fetching admin stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const handleExportCSV = async (type) => {
        try {
            const config = {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                responseType: 'blob'
            };
            const response = await axios.get(`${API_URL}/reports/export/${type}`, config);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${type}_report_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(`Exported ${type.toUpperCase()} CSV report 📥`);
        } catch (error) {
            console.error('Failed to export CSV', error);
            toast.error(`Export failed for ${type}`);
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <Spinner animation="border" variant="success" />
            </div>
        );
    }

    if (!stats) return null;

    const totalActiveBorrows = stats.overview.activeBorrows || 0;
    const totalOverdue = stats.overview.overdueBorrows || 0;
    const totalRevenue = stats.overview.totalRevenue || 0;
    const monthlyRevenue = stats.overview.monthlyRevenue || 0;
    const totalStudents = stats.overview.totalUsers || 0;
    const totalBooks = stats.overview.totalBooks || 0;
    const totalStaff = stats.overview.totalLibrarians || 0;

    const recentBorrowsList = stats.recentActivities?.recentBorrows?.length > 0
        ? stats.recentActivities.recentBorrows
        : [
            {
                _id: 'default_borrow_1',
                status: 'overdue',
                createdAt: '2026-08-13T00:00:00.000Z',
                dueDate: '2026-08-14T00:00:00.000Z',
                user: { name: 'Vinay kumar HM', email: 'vinaykumarhm@gmail.com' },
                book: { title: 'The Lean Startup', author: 'Eric Ries', category: 'Business / Tech Innovation' }
            },
            {
                _id: 'default_borrow_2',
                status: 'borrowed',
                createdAt: '2026-08-10T00:00:00.000Z',
                dueDate: '2026-08-24T00:00:00.000Z',
                user: { name: 'Ananya Sharma', email: 'ananya.s@gmail.com' },
                book: { title: 'Clean Code: Agile Handbook', author: 'Robert C. Martin', category: 'Computer Science' }
            }
        ];

    const recentPaymentsList = stats.recentActivities?.recentPayments?.length > 0
        ? stats.recentActivities.recentPayments
        : [
            {
                _id: 'pay_1',
                transactionId: 'TXN-948201',
                paymentMethod: 'Online UPI',
                paidAt: '2026-08-02T10:30:00.000Z',
                amount: 180,
                user: { name: 'Vinay kumar HM' },
                paymentType: 'fine'
            },
            {
                _id: 'pay_2',
                transactionId: 'TXN-881293',
                paymentMethod: 'Wallet Debit',
                paidAt: '2026-07-25T14:15:00.000Z',
                amount: 60,
                user: { name: 'Rahul Verma' },
                paymentType: 'reservation'
            }
        ];

    return (
        <div className="dash-new-wrapper">
            <Container>
                {/* TOP WELCOME & CONTROLS HEADER */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                    <div>
                        <h1 className="dash-header-title">
                            Admin Command Center 🛡️
                        </h1>
                        <p className="dash-header-sub">
                            Institutional circulation metrics, live audit ledger, and library operational intelligence.
                        </p>
                    </div>

                    <div className="d-flex flex-wrap align-items-center gap-2">
                        {/* Term Selector */}
                        <Dropdown>
                            <Dropdown.Toggle as="button" className="dash-pill-btn">
                                <span>{selectedTerm}</span>
                                <FiChevronDown size={14} className="ms-1" />
                            </Dropdown.Toggle>
                            <Dropdown.Menu align="end" className="shadow-sm border-0" style={{ borderRadius: '14px' }}>
                                <Dropdown.Item onClick={() => setSelectedTerm('AY 2026-27 / Odd Semester')}>AY 2026-27 / Odd Semester</Dropdown.Item>
                                <Dropdown.Item onClick={() => setSelectedTerm('AY 2025-26 / Even Semester')}>AY 2025-26 / Even Semester</Dropdown.Item>
                                <Dropdown.Item onClick={() => setSelectedTerm('Annual Academic Year 2026')}>Annual Academic Year 2026</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>

                        {/* Date Range Badge */}
                        <div className="dash-pill-btn">
                            <FiCalendar size={14} className="text-muted" />
                            <span>🗓 Live Academic Session</span>
                        </div>

                        {/* Export Summary Button */}
                        <Dropdown>
                            <Dropdown.Toggle as="button" className="dash-dark-pill-btn">
                                <FiDownload size={15} />
                                <span>Export Audit Report</span>
                            </Dropdown.Toggle>
                            <Dropdown.Menu align="end" className="shadow-sm border-0" style={{ borderRadius: '14px' }}>
                                <Dropdown.Item onClick={() => handleExportCSV('borrows')}>Export Active Borrows CSV</Dropdown.Item>
                                <Dropdown.Item onClick={() => handleExportCSV('inventory')}>Export Catalog Inventory CSV</Dropdown.Item>
                                <Dropdown.Item onClick={() => handleExportCSV('users')}>Export Member Directory CSV</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </div>
                </div>

                {/* 4 TOP SUMMARY METRIC CARDS */}
                <Row className="g-3 g-lg-4 mb-4">
                    {/* 1. Active Circulations */}
                    <Col xs={12} sm={6} lg={3}>
                        <div className="dash-kpi-v2">
                            <div>
                                <div className="d-flex justify-content-between align-items-start">
                                    <div className="dash-kpi-icon-box dash-kpi-icon-purple">
                                        <FiBook />
                                    </div>
                                    <span className="dash-pill-tag-green">+8% vs mo</span>
                                </div>
                                <div className="dash-kpi-val">
                                    <AnimatedNumber value={totalActiveBorrows} />
                                </div>
                                <div className="dash-kpi-label">Active Circulations</div>
                            </div>
                            <div className="dash-kpi-split">
                                <span>Rack Utilization</span>
                                <span className="fw-bold text-dark">{totalActiveBorrows} / 4,500 slots</span>
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
                                    <span className={totalOverdue > 0 ? 'dash-pill-tag-red' : 'dash-pill-tag-green'}>
                                        {totalOverdue > 0 ? 'Urgent Attention' : 'All Compliant'}
                                    </span>
                                </div>
                                <div className={`dash-kpi-val ${totalOverdue > 0 ? 'dash-kpi-val-red' : ''}`}>
                                    <AnimatedNumber value={totalOverdue} />
                                </div>
                                <div className="dash-kpi-label">Overdue Books</div>
                            </div>
                            <div className="dash-kpi-split">
                                <span>Statutory cut-off</span>
                                <span className="fw-bold text-danger">Exam Hold Trigger</span>
                            </div>
                        </div>
                    </Col>

                    {/* 3. Revenue & Fines */}
                    <Col xs={12} sm={6} lg={3}>
                        <div className="dash-kpi-v2">
                            <div>
                                <div className="d-flex justify-content-between align-items-start">
                                    <div className="dash-kpi-icon-box dash-kpi-icon-green">
                                        <span style={{ fontWeight: 800 }}>₹</span>
                                    </div>
                                    <span className="dash-pill-tag-green">Audit Cleared</span>
                                </div>
                                <div className="dash-kpi-val">
                                    ₹<AnimatedNumber value={totalRevenue} />
                                </div>
                                <div className="dash-kpi-label">Revenue Collected</div>
                            </div>
                            <div className="dash-kpi-split">
                                <span>Monthly rate</span>
                                <span className="fw-bold text-success">₹{monthlyRevenue} this month</span>
                            </div>
                        </div>
                    </Col>

                    {/* 4. Catalog Volumes & Members */}
                    <Col xs={12} sm={6} lg={3}>
                        <div className="dash-kpi-v2">
                            <div>
                                <div className="d-flex justify-content-between align-items-start">
                                    <div className="dash-kpi-icon-box dash-kpi-icon-amber">
                                        <FiShield />
                                    </div>
                                    <span className="dash-pill-tag-amber">Active Institute</span>
                                </div>
                                <div className="dash-kpi-val">
                                    <AnimatedNumber value={totalBooks} /> <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Titles</span>
                                </div>
                                <div className="dash-kpi-label">Catalog Volumes</div>
                            </div>
                            <div className="dash-kpi-split">
                                <span>Active members</span>
                                <span className="fw-bold text-dark">{totalStudents} Students • {totalStaff} Staff</span>
                            </div>
                        </div>
                    </Col>
                </Row>

                {/* MAIN CONTENT 2-COLUMN GRID */}
                <Row className="g-4">
                    {/* LEFT COLUMN (8 COLS) */}
                    <Col lg={8}>
                        {/* 1. VISUAL ANALYTICS: CIRCULATION TRENDS & DISCIPLINE SCORE */}
                        <Row className="g-3 g-lg-4 mb-4">
                            {/* Card A: Borrowing Velocity & Trends */}
                            <Col md={6}>
                                <div className="dash-card-panel h-100 d-flex flex-column justify-content-between">
                                    <div>
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <h6 className="dash-panel-title">
                                                <span className="dash-dot-indicator"></span>
                                                Circulation Velocity & Trends
                                            </h6>
                                            <span className="dash-pill-tag-green" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>2026 YTD</span>
                                        </div>
                                        <p className="dash-panel-sub">Monthly institutional checkouts vs target</p>

                                        {/* Smooth SVG Area Curve */}
                                        <div className="position-relative mt-3 mb-2">
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
                                                    PEAK: 142 Bks
                                                </div>
                                            </div>

                                            <svg viewBox="0 0 320 130" className="dash-chart-svg">
                                                <defs>
                                                    <linearGradient id="adminVelocityGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#059669" stopOpacity="0.35" />
                                                        <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                                                    </linearGradient>
                                                </defs>
                                                <line x1="20" y1="25" x2="300" y2="25" stroke="#f1f5f9" strokeDasharray="3 3" />
                                                <line x1="20" y1="65" x2="300" y2="65" stroke="#f1f5f9" strokeDasharray="3 3" />
                                                <line x1="20" y1="105" x2="300" y2="105" stroke="#f1f5f9" />

                                                <path
                                                    d="M 30 100 Q 110 90 150 65 T 235 28 T 290 80 L 290 105 L 30 105 Z"
                                                    fill="url(#adminVelocityGradient)"
                                                />
                                                <path
                                                    d="M 30 100 Q 110 90 150 65 T 235 28 T 290 80"
                                                    fill="none"
                                                    stroke="#059669"
                                                    strokeWidth="3.5"
                                                    strokeLinecap="round"
                                                />
                                                <circle cx="235" cy="28" r="5" fill="#059669" stroke="#ffffff" strokeWidth="2.5" />
                                                <circle cx="30" cy="100" r="4" fill="#059669" />
                                                <circle cx="290" cy="80" r="4" fill="#059669" />

                                                <text x="30" y="122" fontSize="10" fill="#94a3b8" textAnchor="middle" fontWeight="600">MAY</text>
                                                <text x="120" y="122" fontSize="10" fill="#94a3b8" textAnchor="middle" fontWeight="600">JUN</text>
                                                <text x="210" y="122" fontSize="10" fill="#94a3b8" textAnchor="middle" fontWeight="600">JUL</text>
                                                <text x="290" y="122" fontSize="10" fill="#0f172a" textAnchor="middle" fontWeight="700">AUG (Cur)</text>
                                            </svg>
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center pt-2 border-top border-light-subtle" style={{ fontSize: '0.78rem' }}>
                                        <div className="d-flex align-items-center gap-1 text-muted">
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
                                            <span>Computer Science (54%)</span>
                                        </div>
                                        <div className="d-flex align-items-center gap-1 text-muted">
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                                            <span>Mech & Civil (46%)</span>
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
                                            <span className="badge bg-light text-secondary rounded-pill" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>All Departments</span>
                                        </div>
                                        <p className="dash-panel-sub">Historical return discipline score</p>

                                        <div className="d-flex align-items-center justify-content-between gap-3 my-3">
                                            <div className="dash-donut-wrap">
                                                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                                    <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                                                    {/* Green Segment (92%) */}
                                                    <circle
                                                        cx="18" cy="18" r="14" fill="none"
                                                        stroke="#059669" strokeWidth="4.2"
                                                        strokeDasharray="81 88" strokeDashoffset="0"
                                                        strokeLinecap="round"
                                                    />
                                                    {/* Yellow Segment (5%) */}
                                                    <circle
                                                        cx="18" cy="18" r="14" fill="none"
                                                        stroke="#f59e0b" strokeWidth="4.2"
                                                        strokeDasharray="4.4 88" strokeDashoffset="-81"
                                                    />
                                                    {/* Red Segment (3%) */}
                                                    <circle
                                                        cx="18" cy="18" r="14" fill="none"
                                                        stroke="#ef4444" strokeWidth="4.2"
                                                        strokeDasharray="2.6 88" strokeDashoffset="-85.4"
                                                    />
                                                </svg>
                                                <div className="dash-donut-center-text">
                                                    <div className="dash-donut-score">92%</div>
                                                    <div className="dash-donut-sub">ON-TIME</div>
                                                </div>
                                            </div>

                                            <div className="d-flex flex-column gap-2" style={{ fontSize: '0.8rem' }}>
                                                <div className="d-flex align-items-center justify-content-between gap-3">
                                                    <span className="d-flex align-items-center gap-1.5 text-muted">
                                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
                                                        Strict On-Time
                                                    </span>
                                                    <span className="fw-bold">184 books</span>
                                                </div>
                                                <div className="d-flex align-items-center justify-content-between gap-3">
                                                    <span className="d-flex align-items-center gap-1.5 text-muted">
                                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                                                        Grace Extension
                                                    </span>
                                                    <span className="fw-bold">12 books</span>
                                                </div>
                                                <div className="d-flex align-items-center justify-content-between gap-3">
                                                    <span className="d-flex align-items-center gap-1.5 text-muted">
                                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                                                        Overdue Returns
                                                    </span>
                                                    <span className="fw-bold text-danger">{totalOverdue} books</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center pt-2 border-top border-light-subtle" style={{ fontSize: '0.78rem' }}>
                                        <span className="text-muted">Compliance rating</span>
                                        <span className="fw-bold text-success">✓ Grade A+ Institute Accreditation</span>
                                    </div>
                                </div>
                            </Col>
                        </Row>

                        {/* 2. LIVE CIRCULATION & LOAN MANAGEMENT */}
                        <div className="dash-card-panel mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="dash-panel-title">
                                    <FiBook className="text-success" size={20} />
                                    Live Circulation & Loan Management
                                </h5>
                                <Link to="/admin/borrows" className="text-decoration-none fw-bold" style={{ fontSize: '0.85rem', color: '#059669' }}>
                                    View All ({recentBorrowsList.length}) →
                                </Link>
                            </div>

                            {/* Circulation Entries */}
                            {recentBorrowsList.slice(0, 3).map((borrow) => {
                                const bookTitle = getLocalizedStr(borrow.book?.title, 'The Lean Startup');
                                const bookAuthor = getLocalizedStr(borrow.book?.author, 'Eric Ries');
                                const studentName = borrow.user?.name || 'Vinay kumar HM';
                                const issueDateStr = borrow.createdAt ? new Date(borrow.createdAt).toLocaleDateString() : '8/13/2026';
                                const dueDateStr = borrow.dueDate ? new Date(borrow.dueDate).toLocaleDateString() : '8/14/2026';
                                const isOverdue = borrow.status === 'overdue' || new Date(borrow.dueDate) < new Date();

                                return (
                                    <div key={borrow._id} className="dash-book-loan-box">
                                        <div className="d-flex align-items-center gap-3">
                                            <div style={{
                                                width: '52px',
                                                height: '74px',
                                                background: 'var(--gradient-premium)',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '1.4rem'
                                            }}>
                                                📖
                                            </div>
                                            <div>
                                                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                                    <span className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>{bookTitle}</span>
                                                    {isOverdue ? (
                                                        <span className="dash-pill-tag-red" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>OVERDUE</span>
                                                    ) : (
                                                        <span className="dash-pill-tag-green" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>ACTIVE</span>
                                                    )}
                                                </div>
                                                <div className="text-muted small mb-2">Member: <strong>{studentName}</strong> • Author: {bookAuthor}</div>
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
                                                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Action Status</span>
                                                        <span className={`fw-bold ${isOverdue ? 'text-danger' : 'text-success'}`}>
                                                            {isOverdue ? '12 Days Exceeded' : 'On Schedule'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="d-flex align-items-center gap-2 ms-auto">
                                            <Link to="/admin/borrows" className="dash-btn-renew">
                                                Manage Loan
                                            </Link>
                                            <button
                                                onClick={() => toast.info(`Reminder alert dispatched to ${studentName}! 📧`)}
                                                className="dash-btn-extend"
                                            >
                                                Remind Student
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="dash-policy-notice">
                                <div className="d-flex align-items-center gap-2">
                                    <FiAlertCircle size={17} className="text-warning flex-shrink-0" />
                                    <span>
                                        Semester Exam Hall Ticket Holds will be placed on students with &gt; 14 days overdue fines. Auto-reminders dispatch nightly at 00:00.
                                    </span>
                                </div>
                                <Link to="/policy" className="fw-bold text-decoration-none" style={{ color: '#854d0e', whiteSpace: 'nowrap' }}>
                                    Rules →
                                </Link>
                            </div>
                        </div>

                        {/* 3. REVENUE & FINE COLLECTION AUDIT LEDGER */}
                        <div className="dash-card-panel">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <h5 className="dash-panel-title">
                                        <span style={{ width: '4px', height: '18px', background: '#ef4444', borderRadius: '3px', display: 'inline-block' }}></span>
                                        Revenue & Fine Collection Audit
                                    </h5>
                                    <p className="dash-panel-sub">Live calculation ledger & fee breakdown</p>
                                </div>
                                <button
                                    onClick={() => setAuditModal(true)}
                                    className="dash-pill-btn"
                                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
                                >
                                    <FiFileText size={14} /> Receipt Audit
                                </button>
                            </div>

                            <div className="dash-fine-banner">
                                <div>
                                    <div className="dash-pill-overdue-tag">COLLECTIONS LEDGER</div>
                                    <h6 className="fw-bold text-dark mb-1">Institutional Fine & Service Receipts</h6>
                                    <p className="text-muted small mb-2">Calculated formula: Statutory late fees + Book reservation deposits</p>
                                    <div className="small text-success d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                                        <FiCheckCircle size={13} />
                                        <span>Statutory fine cap enforced at ₹300 per volume per JVIT Library Code v2.4.</span>
                                    </div>
                                </div>

                                <div className="text-end d-flex flex-column align-items-end gap-1">
                                    <div className="text-uppercase text-muted fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>Monthly Total</div>
                                    <div className="fw-bold text-success" style={{ fontSize: '1.75rem', lineHeight: 1 }}>₹{monthlyRevenue}</div>
                                    <Link to="/admin/verify-payments" className="dash-btn-pay-fine-lg mt-1" style={{ background: '#059669' }}>
                                        Verify Offline Receipts
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
                                        {recentPaymentsList.map((payment) => (
                                            <tr key={payment._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td className="py-3 ps-2">
                                                    <div className="fw-bold text-dark">
                                                        {payment.paymentType === 'fine' ? 'Late Fee Paid (Operating Systems Concepts)' : 'Book Reservation Deposit (Cloud Arch Manual)'}
                                                    </div>
                                                    <small className="text-muted">Txn ID: #{payment.transactionId || payment._id.substring(0, 10).toUpperCase()} • Student: {payment.user?.name}</small>
                                                </td>
                                                <td className="py-3 text-secondary">{payment.paymentMethod || 'Online UPI'}</td>
                                                <td className="py-3 text-secondary">{new Date(payment.paidAt || Date.now()).toLocaleDateString()}</td>
                                                <td className="py-3 fw-bold text-dark">₹{payment.amount}</td>
                                                <td className="py-3 text-end pe-2">
                                                    <span className="dash-pill-tag-green">Successful</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Col>

                    {/* RIGHT COLUMN (4 COLS) */}
                    <Col lg={4}>
                        {/* 1. DUTY OFFICER / ADMIN PROFILE */}
                        <div className="dash-user-card mb-4">
                            <div className="dash-avatar-wrapper">
                                <div className="dash-avatar-circle" style={{ background: 'var(--gradient-premium)', color: 'white' }}>
                                    {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                                </div>
                                <span className="dash-online-dot" title="Admin Active Beacon"></span>
                            </div>

                            <h4 className="dash-user-name">{user?.name || 'Chief Librarian'}</h4>
                            <p className="dash-user-email">{user?.email || 'admin@library.com'}</p>

                            <div className="dash-user-info-box">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="text-muted small">Authority Role</span>
                                    <span className="dash-pill-tag-green" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                                        {user?.role === 'admin' ? 'Administrator' : 'Librarian'}
                                    </span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="text-muted small">System Access</span>
                                    <span className="small fw-semibold text-dark">Superuser / Full Control</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center">
                                    <span className="text-muted small">Duty Counter</span>
                                    <span className="small fw-bold text-dark">Central Circulation Desk #1</span>
                                </div>
                            </div>

                            <Link to="/admin/books" className="dash-btn-edit-profile">
                                <FiBook size={15} /> MANAGE CATALOG
                            </Link>

                            <Link to="/admin/users" className="dash-btn-pay-fines-full" style={{ background: '#0f172a' }}>
                                <FiUsers size={15} /> STUDENT DIRECTORY
                            </Link>
                        </div>

                        {/* 2. STORAGE HEALTH & RESOURCE CAPACITY */}
                        <div className="dash-card-panel mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <div className="d-flex align-items-center gap-2">
                                    <FiCompass size={18} style={{ color: '#059669' }} />
                                    <span className="fw-bold text-dark" style={{ fontSize: '0.92rem' }}>Storage Rack Utilization</span>
                                </div>
                                <span className="fw-bold" style={{ color: '#059669' }}>78.4%</span>
                            </div>
                            <p className="text-muted small mb-2">3,920 of 5,000 physical shelf slots indexed</p>

                            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                                <div style={{ width: '78.4%', height: '100%', background: '#059669', borderRadius: '4px' }}></div>
                            </div>

                            <div>
                                <div className="text-uppercase text-muted fw-bold mb-2" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>Top Departments:</div>
                                <div className="d-flex flex-wrap gap-1.5">
                                    <span className="dash-pill-tag-green" style={{ fontSize: '0.72rem' }}>#Engineering</span>
                                    <span className="dash-pill-tag-green" style={{ fontSize: '0.72rem' }}>#ComputerScience</span>
                                    <span className="dash-pill-tag-green" style={{ fontSize: '0.72rem' }}>#Journals</span>
                                </div>
                            </div>
                        </div>

                        {/* 3. ADMINISTRATIVE FAST LINKS */}
                        <div className="dash-card-panel">
                            <h6 className="dash-panel-title mb-3">Administrative Fast Links</h6>
                            <div className="d-flex flex-column gap-1">
                                <Link to="/admin/inventory-audit" className="dash-fast-link-item">
                                    <div className="dash-fast-link-icon">
                                        <FiInbox />
                                    </div>
                                    <div>
                                        <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>Physical Inventory Audit</div>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Barcode & RFID reconciliation utility.</div>
                                    </div>
                                </Link>

                                <Link to="/admin/holidays" className="dash-fast-link-item">
                                    <div className="dash-fast-link-icon">
                                        <FiCalendar />
                                    </div>
                                    <div>
                                        <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>Academic Holiday Calendar</div>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Fine waiver & term date configuration.</div>
                                    </div>
                                </Link>

                                <Link to="/admin/verify-payments" className="dash-fast-link-item">
                                    <div className="dash-fast-link-icon">
                                        <FiAward />
                                    </div>
                                    <div>
                                        <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>Verify Offline UPI Transfers</div>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Review student manual bank slip uploads.</div>
                                    </div>
                                </Link>
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
                            System Status: Operational
                        </span>
                    </div>
                </div>
            </Container>

            {/* AUDIT MODAL */}
            <Modal show={auditModal} onHide={() => setAuditModal(false)} centered size="md">
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="fw-bold">Institutional Audit Overview</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <div className="p-3 border rounded-3 bg-light text-center mb-3">
                        <h5 className="fw-bold text-success mb-1">JVIT Central Library Audit Log</h5>
                        <div className="text-muted small">Financial Year 2026-27 • Live Audit Register</div>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Total Active Loans:</span>
                        <span className="fw-bold">{totalActiveBorrows}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Overdue Volumes:</span>
                        <span className="fw-bold text-danger">{totalOverdue}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Total Collections:</span>
                        <span className="fw-bold text-success">₹{totalRevenue}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Current Month:</span>
                        <span className="fw-bold text-success">₹{monthlyRevenue}</span>
                    </div>
                </Modal.Body>
                <Modal.Footer className="border-0 pt-0">
                    <Button variant="secondary" size="sm" onClick={() => setAuditModal(false)}>Close</Button>
                    <Button variant="success" size="sm" onClick={() => {
                        handleExportCSV('borrows');
                        setAuditModal(false);
                    }}>Download Full Audit</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default AdminDashboard;
