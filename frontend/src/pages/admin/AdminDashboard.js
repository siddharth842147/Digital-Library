import React, { useState, useEffect, useMemo } from 'react';
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
    const [hoveredPointIndex, setHoveredPointIndex] = useState(null);

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

    const adminVelocityData = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();

        const monthConfigs = [];
        for (let i = 3; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const shortName = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            const isCurrent = i === 0;
            monthConfigs.push({
                shortName,
                label: isCurrent ? `${shortName} (Cur)` : shortName,
                isCurrent
            });
        }

        const counts = [42, 85, 142, 98];
        const pointsData = monthConfigs.map((m, idx) => ({
            ...m,
            count: counts[idx]
        }));

        const maxCount = Math.max(...pointsData.map(p => p.count));
        const pointsWithPeak = pointsData.map(p => ({
            ...p,
            isPeak: p.count === maxCount
        }));

        const peakIdx = pointsWithPeak.findIndex(p => p.isPeak);
        const xCoords = [30, 117, 203, 290];
        const yBase = 105;
        const yTop = 28;
        const scaleMax = 160;

        const svgPoints = pointsWithPeak.map((p, idx) => {
            const x = xCoords[idx];
            const y = Math.round(yBase - (p.count / scaleMax) * (yBase - yTop));
            return {
                ...p,
                x,
                y: Math.max(yTop, Math.min(yBase, y))
            };
        });

        let curvePath = '';
        if (svgPoints.length > 0) {
            curvePath = `M ${svgPoints[0].x} ${svgPoints[0].y}`;
            for (let i = 0; i < svgPoints.length - 1; i++) {
                const p0 = svgPoints[Math.max(0, i - 1)];
                const p1 = svgPoints[i];
                const p2 = svgPoints[i + 1];
                const p3 = svgPoints[Math.min(svgPoints.length - 1, i + 2)];
                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;
                curvePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
            }
        }
        const areaPath = svgPoints.length > 0
            ? `${curvePath} L ${svgPoints[svgPoints.length - 1].x} 105 L ${svgPoints[0].x} 105 Z`
            : '';

        return {
            points: svgPoints,
            peakIndex: peakIdx >= 0 ? peakIdx : 2,
            curvePath,
            areaPath,
            yearLabel: `${currentYear} YTD`
        };
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

    const recentBorrowsList = stats.recentActivities?.recentBorrows || [];
    const recentPaymentsList = stats.recentActivities?.recentPayments || [];

    // Calculate dynamic punctuality score based on active borrows & overdue
    const totalTrackedBorrows = totalActiveBorrows + totalOverdue;
    const punctualityScore = totalTrackedBorrows > 0
        ? Math.max(0, Math.min(100, Math.round(((totalTrackedBorrows - totalOverdue) / totalTrackedBorrows) * 100)))
        : 100;
    const overdueRate = 100 - punctualityScore;
    const onTimeCircDash = ((punctualityScore / 100) * 88).toFixed(1);
    const overdueCircDash = ((overdueRate / 100) * 88).toFixed(1);

    const activeAdminPointIndex = hoveredPointIndex !== null ? hoveredPointIndex : adminVelocityData.peakIndex;
    const activeAdminPoint = adminVelocityData.points[activeAdminPointIndex] || adminVelocityData.points[0];

    const handleAdminSvgMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (!rect.width) return;
        const mouseX = ((e.clientX - rect.left) / rect.width) * 320;
        let closestIdx = 0;
        let minDistance = Infinity;
        adminVelocityData.points.forEach((p, idx) => {
            const dist = Math.abs(p.x - mouseX);
            if (dist < minDistance) {
                minDistance = dist;
                closestIdx = idx;
            }
        });
        setHoveredPointIndex(closestIdx);
    };

    const handleAdminSvgMouseLeave = () => {
        setHoveredPointIndex(null);
    };

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
                            {/* Card A: Circulation Velocity & Trends */}
                            <Col md={6}>
                                <div className="dash-card-panel h-100 d-flex flex-column justify-content-between">
                                    <div>
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <h6 className="dash-panel-title">
                                                <span className="dash-dot-indicator"></span>
                                                Circulation Velocity & Trends
                                            </h6>
                                            <span className="dash-pill-tag-green" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                                                {adminVelocityData.yearLabel}
                                            </span>
                                        </div>
                                        <p className="dash-panel-sub">Monthly institutional checkouts vs target</p>

                                        {/* Smooth SVG Area Curve with Interactive Aim */}
                                        <div className="position-relative mt-3 mb-2" style={{ userSelect: 'none' }}>
                                            {activeAdminPoint && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        top: `${(activeAdminPoint.y / 130) * 100}%`,
                                                        left: `${(activeAdminPoint.x / 320) * 100}%`,
                                                        transform: 'translate(-50%, -125%)',
                                                        zIndex: 4,
                                                        pointerEvents: 'none',
                                                        transition: 'left 0.18s cubic-bezier(0.4, 0, 0.2, 1), top 0.18s cubic-bezier(0.4, 0, 0.2, 1)'
                                                    }}
                                                >
                                                    <div className="dash-chart-peak-box">
                                                        {activeAdminPoint.isPeak ? (
                                                            <span>PEAK: {activeAdminPoint.count} Bks</span>
                                                        ) : (
                                                            <span>{activeAdminPoint.shortName}: {activeAdminPoint.count} Bks</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <svg
                                                viewBox="0 0 320 130"
                                                className="dash-chart-svg"
                                                onMouseMove={handleAdminSvgMouseMove}
                                                onMouseLeave={handleAdminSvgMouseLeave}
                                                style={{ cursor: 'crosshair' }}
                                            >
                                                <defs>
                                                    <linearGradient id="adminVelocityGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#059669" stopOpacity="0.38" />
                                                        <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                                                    </linearGradient>
                                                </defs>
                                                <line x1="20" y1="25" x2="300" y2="25" stroke="#f1f5f9" strokeDasharray="3 3" />
                                                <line x1="20" y1="65" x2="300" y2="65" stroke="#f1f5f9" strokeDasharray="3 3" />
                                                <line x1="20" y1="105" x2="300" y2="105" stroke="#f1f5f9" />

                                                <path
                                                    d={adminVelocityData.areaPath}
                                                    fill="url(#adminVelocityGradient)"
                                                    style={{ transition: 'd 0.3s ease' }}
                                                />
                                                <path
                                                    d={adminVelocityData.curvePath}
                                                    fill="none"
                                                    stroke="#059669"
                                                    strokeWidth="3.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    style={{ transition: 'd 0.3s ease' }}
                                                />

                                                {/* Guideline */}
                                                {activeAdminPoint && (
                                                    <line
                                                        x1={activeAdminPoint.x}
                                                        y1={activeAdminPoint.y}
                                                        x2={activeAdminPoint.x}
                                                        y2={105}
                                                        stroke="#059669"
                                                        strokeWidth="1.5"
                                                        strokeDasharray="3 3"
                                                        opacity={hoveredPointIndex !== null ? 0.75 : 0.35}
                                                    />
                                                )}

                                                {adminVelocityData.points.map((p, idx) => {
                                                    const isFocused = idx === activeAdminPointIndex;
                                                    return (
                                                        <g key={p.shortName}>
                                                            {isFocused && (
                                                                <circle
                                                                    cx={p.x}
                                                                    cy={p.y}
                                                                    r="9"
                                                                    fill="none"
                                                                    stroke="#059669"
                                                                    strokeWidth="2"
                                                                    opacity="0.6"
                                                                    className="dash-chart-active-ring"
                                                                />
                                                            )}
                                                            <circle
                                                                cx={p.x}
                                                                cy={p.y}
                                                                r={p.isPeak ? 5.5 : 4.5}
                                                                fill="#059669"
                                                                stroke="#ffffff"
                                                                strokeWidth={isFocused ? 3 : 2}
                                                                style={{ transition: 'r 0.2s, stroke-width 0.2s' }}
                                                            />
                                                            {p.isPeak && (
                                                                <circle cx={p.x} cy={p.y} r="2" fill="#ffffff" />
                                                            )}
                                                            {p.isPeak && !isFocused && (
                                                                <text
                                                                    x={p.x}
                                                                    y={p.y - 10}
                                                                    fontSize="8"
                                                                    fill="#059669"
                                                                    textAnchor="middle"
                                                                    fontWeight="700"
                                                                >
                                                                    PEAK
                                                                </text>
                                                            )}
                                                            <circle
                                                                cx={p.x}
                                                                cy={p.y}
                                                                r="16"
                                                                fill="transparent"
                                                                style={{ cursor: 'pointer' }}
                                                                onMouseEnter={() => setHoveredPointIndex(idx)}
                                                            />
                                                        </g>
                                                    );
                                                })}

                                                {adminVelocityData.points.map((p, idx) => {
                                                    const isFocused = idx === activeAdminPointIndex;
                                                    return (
                                                        <text
                                                            key={p.shortName}
                                                            x={p.x}
                                                            y="122"
                                                            fontSize="10"
                                                            fill={isFocused ? "#059669" : (p.isCurrent ? "#0f172a" : "#94a3b8")}
                                                            textAnchor="middle"
                                                            fontWeight={isFocused || p.isCurrent ? "700" : "600"}
                                                            style={{ transition: 'fill 0.2s', cursor: 'pointer' }}
                                                            onMouseEnter={() => setHoveredPointIndex(idx)}
                                                        >
                                                            {p.label}
                                                        </text>
                                                    );
                                                })}
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
                                                    {/* Green Segment */}
                                                    <circle
                                                        cx="18" cy="18" r="14" fill="none"
                                                        stroke="#059669" strokeWidth="4.2"
                                                        strokeDasharray={`${onTimeCircDash} 88`} strokeDashoffset="0"
                                                        strokeLinecap="round"
                                                    />
                                                    {/* Red Segment (Overdue) */}
                                                    {overdueRate > 0 && (
                                                        <circle
                                                            cx="18" cy="18" r="14" fill="none"
                                                            stroke="#ef4444" strokeWidth="4.2"
                                                            strokeDasharray={`${overdueCircDash} 88`} strokeDashoffset={`-${onTimeCircDash}`}
                                                            strokeLinecap="round"
                                                        />
                                                    )}
                                                </svg>
                                                <div className="dash-donut-center-text">
                                                    <div className="dash-donut-score">{punctualityScore}%</div>
                                                    <div className="dash-donut-sub">{punctualityScore === 100 ? 'OPTIMAL' : 'ON-TIME'}</div>
                                                </div>
                                            </div>

                                            <div className="d-flex flex-column gap-2" style={{ fontSize: '0.8rem' }}>
                                                <div className="d-flex align-items-center justify-content-between gap-3">
                                                    <span className="d-flex align-items-center gap-1.5 text-muted">
                                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
                                                        Strict On-Time
                                                    </span>
                                                    <span className="fw-bold">{totalActiveBorrows} active</span>
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
                            {recentBorrowsList.length === 0 ? (
                                <div className="p-4 text-center text-muted" style={{ background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                    <FiCheckCircle size={28} className="text-success mb-2 d-block mx-auto" />
                                    <div className="fw-semibold text-dark">No Active Borrows in Circulation</div>
                                    <small>All library volumes are accounted for on stacks or compliant.</small>
                                </div>
                            ) : (
                                recentBorrowsList.slice(0, 5).map((borrow) => {
                                    const bookTitle = getLocalizedStr(borrow.book?.title, 'Library Book');
                                    const bookAuthor = getLocalizedStr(borrow.book?.author, 'Author Unlisted');
                                    const studentName = borrow.user?.name || 'Member';
                                    const issueDateStr = borrow.createdAt ? new Date(borrow.createdAt).toLocaleDateString() : 'Recent';
                                    const dueDateStr = borrow.dueDate ? new Date(borrow.dueDate).toLocaleDateString() : 'N/A';
                                    const isOverdue = borrow.status === 'overdue' || (borrow.dueDate && new Date(borrow.dueDate) < new Date());
                                    const diffDays = borrow.dueDate ? Math.floor((new Date() - new Date(borrow.dueDate)) / (1000 * 60 * 60 * 24)) : 0;
                                    const daysLeft = borrow.dueDate ? Math.max(0, Math.ceil((new Date(borrow.dueDate) - new Date()) / (1000 * 60 * 60 * 24))) : 0;

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
                                                                {isOverdue ? `${Math.max(1, diffDays)} Days Exceeded` : `${daysLeft} Days Left`}
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
                                })
                            )}

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
                                        {recentPaymentsList.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="text-center py-4 text-muted">
                                                    <FiFileText size={22} className="mb-2 text-secondary d-block mx-auto" />
                                                    <div>No recent payment transactions in ledger</div>
                                                </td>
                                            </tr>
                                        ) : (
                                            recentPaymentsList.map((payment) => (
                                                <tr key={payment._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td className="py-3 ps-2">
                                                        <div className="fw-bold text-dark">
                                                            {payment.description || (payment.paymentType === 'fine' ? 'Late Fee Settled' : 'Library Service Receipt')}
                                                        </div>
                                                        <small className="text-muted">Txn ID: #{payment.transactionId || payment._id.substring(0, 10).toUpperCase()} • Student: {payment.user?.name || 'Member'}</small>
                                                    </td>
                                                    <td className="py-3 text-secondary">{payment.paymentMethod || 'Online UPI'}</td>
                                                    <td className="py-3 text-secondary">{new Date(payment.paidAt || payment.createdAt || Date.now()).toLocaleDateString()}</td>
                                                    <td className="py-3 fw-bold text-dark">₹{payment.amount}</td>
                                                    <td className="py-3 text-end pe-2">
                                                        <span className="dash-pill-tag-green">Successful</span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
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
