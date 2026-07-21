import React, { useState, useRef, useEffect } from 'react';
import { FaRobot, FaTimes, FaPaperPlane } from 'react-icons/fa';
import axios from 'axios';
import './Chatbot.css'; // We'll add some specific CSS here

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { text: "Hi! I'm your Virtual Librarian. How can I help you today?", isBot: true }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { text: userMessage, isBot: false }]);
        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${process.env.REACT_APP_API_URL || 'https://jvit-backend.onrender.com/api'}/chatbot/query`, {
                message: userMessage
            }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            
            if (response.data.success) {
                setMessages(prev => [...prev, { text: response.data.reply, isBot: true }]);
            } else {
                setMessages(prev => [...prev, { text: "Sorry, I am having trouble connecting to my systems right now.", isBot: true }]);
            }
        } catch (error) {
            console.error("Chatbot Error:", error);
            setMessages(prev => [...prev, { text: "Sorry, something went wrong. Please try again later.", isBot: true }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chatbot-wrapper">
            {/* Chatbot Toggle Button */}
            {!isOpen && (
                <button 
                    className="chatbot-toggle-btn"
                    onClick={() => setIsOpen(true)}
                    aria-label="Open Chat"
                >
                    <FaRobot size={24} />
                </button>
            )}

            {/* Chatbot Window */}
            <div className={`chatbot-window ${isOpen ? 'open' : ''}`}>
                <div className="chatbot-header">
                    <div className="chatbot-title">
                        <FaRobot className="me-2" /> Virtual Librarian
                    </div>
                    <button className="chatbot-close-btn" onClick={() => setIsOpen(false)} aria-label="Close Chat">
                        <FaTimes aria-hidden="true" />
                    </button>
                </div>

                <div className="chatbot-messages">
                    {messages.map((msg, index) => (
                        <div key={index} className={`message-bubble ${msg.isBot ? 'bot' : 'user'}`}>
                            {/* Render text with basic newlines */}
                            {msg.text.split('\n').map((line, i) => (
                                <React.Fragment key={i}>
                                    {line}
                                    <br />
                                </React.Fragment>
                            ))}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="message-bubble bot typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form className="chatbot-input-form" onSubmit={handleSend}>
                    <input
                        type="text"
                        placeholder="Ask me anything..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isLoading}
                        aria-label="Type your message"
                    />
                    <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send message">
                        <FaPaperPlane aria-hidden="true" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Chatbot;
