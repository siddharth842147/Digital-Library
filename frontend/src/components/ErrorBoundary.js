import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("ErrorBoundary caught an error", error, errorInfo);
        this.setState({ errorInfo: errorInfo });
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <div style={{ padding: '2rem', textAlign: 'center', minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <h1 style={{ color: '#dc3545' }}>Oops! Something went wrong.</h1>
                    <p>We're sorry, but an unexpected error occurred.</p>
                    <button 
                        className="btn btn-primary mt-3"
                        onClick={() => window.location.reload()}
                    >
                        Refresh Page
                    </button>
                    {process.env.NODE_ENV === 'development' && (
                        <details style={{ whiteSpace: 'pre-wrap', marginTop: '20px', textAlign: 'left', background: '#f8d7da', padding: '15px', borderRadius: '5px' }}>
                            {this.state.errorInfo?.componentStack}
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children; 
    }
}

export default ErrorBoundary;
