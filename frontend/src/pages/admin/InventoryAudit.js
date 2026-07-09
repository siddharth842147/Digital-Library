import React, { useState, useEffect } from 'react';
import { Container, Card, Table, Badge, Spinner } from 'react-bootstrap';
import { getBooks } from '../../services/bookService';
import { FiAlertTriangle } from 'react-icons/fi';

const InventoryAudit = () => {
    const [lowStockBooks, setLowStockBooks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAuditData = async () => {
            try {
                setLoading(true);
                const res = await getBooks({ limit: 1000 });
                const books = res.data;
                // Filter books with low stock (< 20% available)
                const lowStock = books.filter(b => b.availableCopies / b.totalCopies <= 0.2 || b.availableCopies === 0);
                setLowStockBooks(lowStock);
            } catch (error) {
                console.error('Audit fetch error', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAuditData();
    }, []);

    if (loading) return <div className="text-center mt-5"><Spinner animation="border" /></div>;

    return (
        <Container className="py-5">
            <h2 className="fw-bold mb-4 d-flex align-items-center gap-2"><FiAlertTriangle className="text-warning"/> Inventory Audit</h2>
            <Card className="border-0 shadow-sm">
                <Card.Body>
                    <h5 className="mb-4">Low Stock Alerts</h5>
                    <Table hover responsive>
                        <thead className="bg-light">
                            <tr>
                                <th>Book</th>
                                <th>ISBN</th>
                                <th>Category</th>
                                <th>Available / Total</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lowStockBooks.map(book => (
                                <tr key={book._id}>
                                    <td>
                                        <div className="fw-bold">{book.title}</div>
                                        <small className="text-muted">{book.author}</small>
                                    </td>
                                    <td>{book.isbn}</td>
                                    <td>{book.category}</td>
                                    <td>{book.availableCopies} / {book.totalCopies}</td>
                                    <td>
                                        <Badge bg={book.availableCopies === 0 ? "danger" : "warning"}>
                                            {book.availableCopies === 0 ? "Out of Stock" : "Low Stock"}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                            {lowStockBooks.length === 0 && (
                                <tr><td colSpan="5" className="text-center text-muted py-4">No low stock items found! Inventory looks good.</td></tr>
                            )}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>
        </Container>
    );
};

export default InventoryAudit;
