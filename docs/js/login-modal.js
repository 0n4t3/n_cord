// Login Modal Management
class LoginModal {
    constructor() {
        this.modal = null;
        this.initialized = false;
        // Initialize immediately
        this.init();
    }

    init() {
        if (this.initialized) return;
        
        // Ensure DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initModal());
        } else {
            this.initModal();
        }
    }
    
    initModal() {
        // Create the login modal HTML
        this.createModal();
        
        // Set up event listeners
        this.setupEventListeners();
        
        this.initialized = true;
    }

    createModal() {
        // Create the modal HTML
        const modalHTML = `
            <div id="loginModal" class="fixed inset-0 z-50 flex items-center justify-center modal hidden">
                <div class="modal-content p-6 rounded-lg shadow-xl w-full max-w-md">
                    <h2 class="text-2xl font-bold mb-6 text-white text-center">Choose Login Method</h2>
                    
                    <div class="space-y-4">
                        <!-- Extension Login Option -->
                        <button id="loginWithExtensionBtn" class="w-full btn-primary font-bold py-3 px-6 rounded-lg shadow text-base flex items-center justify-center space-x-2">
                            <span>🔐</span>
                            <span>Login with Browser Extension</span>
                        </button>
                        
                        <div class="text-center text-gray-400 text-sm">
                            Recommended: Use Alby, nos2x, or similar extensions
                        </div>
                        
                        <div class="border-t border-gray-600 pt-4">
                            <button id="loginWithKeyBtn" class="w-full btn-secondary font-bold py-3 px-6 rounded-lg shadow text-base flex items-center justify-center space-x-2">
                                <span>🔑</span>
                                <span>Login with Private Key</span>
                            </button>
                            
                            <div class="text-center text-gray-400 text-xs mt-2">
                                Less secure: Use with caution.
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-center mt-6">
                        <button id="cancelLoginBtn" class="btn-secondary py-2 px-4 rounded-lg">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        // Insert modal into document
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('loginModal');
    }

    setupEventListeners() {
        if (!this.modal) return;
        
        const loginWithExtensionBtn = document.getElementById('loginWithExtensionBtn');
        const loginWithKeyBtn = document.getElementById('loginWithKeyBtn');
        const cancelLoginBtn = document.getElementById('cancelLoginBtn');
        
        // Extension login
        if (loginWithExtensionBtn) {
            loginWithExtensionBtn.addEventListener('click', () => {
                this.close();
                // Use window reference to ensure global function access
                if (typeof window.loginWithExtension === 'function') {
                    window.loginWithExtension();
                } else if (typeof loginWithExtension === 'function') {
                    loginWithExtension();
                }
            });
        }
        
        // Private key login
        if (loginWithKeyBtn) {
            loginWithKeyBtn.addEventListener('click', () => {
                this.close();
                // Use window reference to ensure global function access
                if (typeof window.showPrivateKeyModal === 'function') {
                    window.showPrivateKeyModal();
                } else if (typeof showPrivateKeyModal === 'function') {
                    showPrivateKeyModal();
                }
            });
        }
        
        // Cancel button
        if (cancelLoginBtn) {
            cancelLoginBtn.addEventListener('click', () => {
                this.close();
            });
        }
        
        // Close modal when clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
    }

    open() {
        if (this.modal) {
            this.modal.classList.remove('hidden');
        } else {
            // Fallback: try to reinitialize if modal wasn't created properly
            this.initialized = false;
            this.init();
            if (this.modal) {
                this.modal.classList.remove('hidden');
            }
        }
    }

    close() {
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
    }
}

// Create global instance
const loginModal = new LoginModal();

// Global function to open login modal
function openLoginModal() {
    // Ensure modal is initialized before trying to open it
    if (!loginModal.initialized) {
        loginModal.init();
    }
    loginModal.open();
}

// Make it globally accessible
window.loginModal = loginModal;
window.openLoginModal = openLoginModal;
