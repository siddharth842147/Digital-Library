import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const SessionExpiryModal = ({ show, onHide }) => {
    const navigate = useNavigate();

    const handleLoginClick = () => {
        onHide();
        navigate('/login');
    };

    return (
        <Modal show={show} onHide={onHide} backdrop="static" keyboard={false} centered>
            <Modal.Header>
                <Modal.Title className="text-danger">Session Expired</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                Your session has expired due to inactivity or for security reasons. Please log in again to continue.
            </Modal.Body>
            <Modal.Footer>
                <Button variant="primary" onClick={handleLoginClick} className="w-100 fw-bold">
                    Go to Login
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default SessionExpiryModal;
