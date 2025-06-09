// Authentication and Login Management
class AuthManager {
    constructor() {
        this.publicKey = null;
        this.userPrivateKey = null;
        this.loginMethod = null; // 'extension' or 'privateKey'
        this.profile = null;
        this.follows = new Set();
        this.posts = new Set();
        this.isLoggedIn = false;
        
        // Callback for state changes
        this.onStateChange = null;

        // Storage keys for login persistence
        this.STORAGE_KEY_LOGIN_STATE = 'nostrLoginState';
        this.STORAGE_KEY_PERSIST_PRIVATE_KEY = 'nostrPersistPrivateKey';

        // Bind methods to maintain 'this' context
        this.checkLoginStatus = this.checkLoginStatus.bind(this);
        this.loginWithExtension = this.loginWithExtension.bind(this);
        this.loginWithPrivateKey = this.loginWithPrivateKey.bind(this);
        this.logout = this.logout.bind(this);
        this.signEvent = this.signEvent.bind(this);
        this.loadPersistedLoginState = this.loadPersistedLoginState.bind(this);
        this.saveLoginState = this.saveLoginState.bind(this);
        this.clearLoginState = this.clearLoginState.bind(this);
    }

    // Load persisted login state from localStorage
    loadPersistedLoginState() {
        try {
            const storedLoginState = localStorage.getItem(this.STORAGE_KEY_LOGIN_STATE);
            if (!storedLoginState) {
                return false;
            }

            const loginState = JSON.parse(storedLoginState);
            
            // Validate stored state
            if (!loginState.publicKey || !loginState.loginMethod) {
                this.clearLoginState();
                return false;
            }

            // For extension logins, restore state but still need to verify extension is available
            if (loginState.loginMethod === 'extension') {
                if (typeof window.nostr !== 'undefined') {
                    console.log('Restoring extension login state...');
                    this.handleLoginSuccess(loginState.publicKey, 'extension');
                    return true;
                } else {
                    console.log('Extension login state found but extension not available');
                    this.clearLoginState();
                    return false;
                }
            }

            // For private key logins, restore only if user opted to persist
            if (loginState.loginMethod === 'privateKey') {
                const persistPrivateKey = localStorage.getItem(this.STORAGE_KEY_PERSIST_PRIVATE_KEY);
                if (persistPrivateKey && loginState.privateKeyHex) {
                    console.log('Restoring private key login state...');
                    this.userPrivateKey = loginState.privateKeyHex;
                    this.handleLoginSuccess(loginState.publicKey, 'privateKey');
                    return true;
                } else {
                    console.log('Private key login state found but persistence not enabled');
                    this.clearLoginState();
                    return false;
                }
            }

        } catch (error) {
            console.warn('Failed to load persisted login state:', error);
            this.clearLoginState();
        }
        return false;
    }

    // Save login state to localStorage
    saveLoginState() {
        if (!this.isLoggedIn || !this.publicKey || !this.loginMethod) {
            return;
        }

        try {
            const loginState = {
                publicKey: this.publicKey,
                loginMethod: this.loginMethod,
                timestamp: Date.now()
            };

            // For private key logins, only save the key if user opted to persist
            if (this.loginMethod === 'privateKey') {
                const persistPrivateKey = localStorage.getItem(this.STORAGE_KEY_PERSIST_PRIVATE_KEY);
                if (persistPrivateKey && this.userPrivateKey) {
                    loginState.privateKeyHex = this.userPrivateKey;
                }
            }

            localStorage.setItem(this.STORAGE_KEY_LOGIN_STATE, JSON.stringify(loginState));
            console.log(`Login state saved for ${this.loginMethod} login`);
        } catch (error) {
            console.warn('Failed to save login state:', error);
        }
    }

    // Clear persisted login state
    clearLoginState() {
        try {
            localStorage.removeItem(this.STORAGE_KEY_LOGIN_STATE);
            localStorage.removeItem(this.STORAGE_KEY_PERSIST_PRIVATE_KEY);
            console.log('Login state cleared');
        } catch (error) {
            console.warn('Failed to clear login state:', error);
        }
    }

    // Check if user is already logged in via extension or persisted state
    async checkLoginStatus() {
        console.log('AuthManager: Checking login status...');
        
        // First try to load persisted login state
        if (this.loadPersistedLoginState()) {
            console.log('AuthManager: Login restored from persisted state');
            return;
        }

        // If no persisted state, try extension login
        if (typeof window.nostr !== 'undefined') {
            try {
                const pubkey = await window.nostr.getPublicKey();
                if (pubkey) {
                    console.log('AuthManager: Extension login successful');
                    this.handleLoginSuccess(pubkey, 'extension');
                }
            } catch (error) {
                console.info("AuthManager: Nostr extension check - Not logged in or permission denied initially.");
            }
        } else {
            console.log('AuthManager: No Nostr extension found and no persisted login state');
        }
    }

    // Login with browser extension (Alby, nos2x, etc.)
    async loginWithExtension() {
        if (typeof window.nostr === 'undefined') {
            showError("Nostr extension (like Alby, nos2x) not found. Install one or use private key login.");
            return;
        }
        
        try {
            const pubkey = await window.nostr.getPublicKey();
            if (pubkey) {
                this.handleLoginSuccess(pubkey, 'extension');
            } else {
                showError("Login failed: Could not get public key from extension.");
            }
        } catch (error) {
            showError(`Extension login failed: ${error.message || error}`);
        }
    }

    // Login with private key (nsec)
    loginWithPrivateKey() {
        const nsec = privateKeyInput.value.trim();
        if (!nsec) {
            showError("Please enter your private key (nsec).");
            return;
        }
        
        if (!nsec.startsWith('nsec')) {
            showError("Invalid format. Private key should start with 'nsec'.");
            return;
        }
        
        if (typeof window.NostrTools === 'undefined' || 
            typeof window.NostrTools.nip19 === 'undefined' || 
            typeof window.NostrTools.getPublicKey === 'undefined') {
            showError("Login failed: Required Nostr library functions are missing.");
            return;
        }
        
        try {
            const { type, data: privateKeyHex } = window.NostrTools.nip19.decode(nsec);
            if (type !== 'nsec' || !privateKeyHex) {
                throw new Error("Failed to decode nsec key.");
            }
            
            // Check if user wants to persist the session
            const persistCheckbox = document.getElementById('persistPrivateKeyCheckbox');
            if (persistCheckbox && persistCheckbox.checked) {
                localStorage.setItem(this.STORAGE_KEY_PERSIST_PRIVATE_KEY, 'true');
                console.log('Private key persistence enabled by user');
            } else {
                localStorage.removeItem(this.STORAGE_KEY_PERSIST_PRIVATE_KEY);
            }
            
            const pubkey = window.NostrTools.getPublicKey(privateKeyHex);
            this.userPrivateKey = privateKeyHex; // Store the hex key
            this.handleLoginSuccess(pubkey, 'privateKey');
            this.hidePrivateKeyModal();
        } catch (error) {
            console.error("Private key login error:", error);
            showError(`Login failed: ${error.message || "Invalid private key."}`);
            this.userPrivateKey = null;
        }
    }

    // Handle successful login
    handleLoginSuccess(pubkey, method) {
        this.publicKey = pubkey;
        this.loginMethod = method;
        this.isLoggedIn = true;
        console.log(`Logged in via ${method} with pubkey:`, this.publicKey);

        // Update UI
        loginOptions.classList.add('hidden');
        userInfo.classList.remove('hidden');
        messageInput.disabled = false;
        sendBtn.disabled = false;
        followingFilterBtn.classList.remove('hidden');
        notificationsContainer.classList.remove('hidden');

        userName.textContent = shortenPubKey(this.publicKey);
        userAvatar.style.display = 'none';

        // Add a small indicator if this was a restored session
        const isRestoredSession = arguments[2]; // third parameter indicates restored session
        if (isRestoredSession && method === 'extension') {
            userName.title = 'Logged in via browser extension (session restored)';
        } else if (isRestoredSession && method === 'privateKey') {
            userName.title = 'Logged in via private key (session restored)';
        } else if (method === 'extension') {
            userName.title = 'Logged in via browser extension';
        } else if (method === 'privateKey') {
            userName.title = 'Logged in via private key';
        }

        // Fetch user data and ensure UI gets updated
        this.fetchUserProfile();
        this.fetchFollowList();
        subscribeToNotifications();
        this.fetchUserPosts();
        
        // Trigger resubscription
        if (typeof subscribeToCurrentChannel === 'function') {
            subscribeToCurrentChannel();
        }

        // Notify state change
        this.triggerStateChange();

        // Save login state
        this.saveLoginState();
    }

    // Logout user
    logout() {
        this.publicKey = null;
        this.userPrivateKey = null;
        this.loginMethod = null;
        this.profile = null;
        this.follows.clear();
        this.posts.clear();
        this.isLoggedIn = false;

        // Update UI
        loginOptions.classList.remove('hidden');
        userInfo.classList.add('hidden');
        messageInput.disabled = true;
        sendBtn.disabled = true;
        followingFilterBtn.classList.add('hidden');
        notificationsContainer.classList.add('hidden');

        userName.textContent = 'Not Logged In';
        userAvatar.style.display = 'none';

        // Close any open modals
        if (profileModal && !profileModal.classList.contains('hidden')) {
            profileModal.classList.add('hidden');
        }

        // Clear notifications
        if (typeof clearNotifications === 'function') {
            clearNotifications();
        }

        // Resubscribe to current channel
        if (typeof subscribeToCurrentChannel === 'function') {
            subscribeToCurrentChannel();
        }

        // Clear login state
        this.clearLoginState();

        // Notify state change
        this.triggerStateChange();
    }

    // Sign an event (either with extension or private key)
    async signEvent(event) {
        if (!this.publicKey) {
            throw new Error("Not logged in.");
        }

        delete event.id;
        delete event.sig;
        event.pubkey = this.publicKey;
        event.created_at = Math.floor(Date.now() / 1000);

        if (this.loginMethod === 'extension') {
            if (typeof window.nostr === 'undefined') {
                throw new Error("Nostr extension not available.");
            }
            try {
                return await window.nostr.signEvent(event);
            } catch (error) {
                throw new Error(`Extension failed to sign: ${error.message || error}`);
            }
        } else if (this.loginMethod === 'privateKey') {
            if (!this.userPrivateKey || typeof window.NostrTools === 'undefined') {
                throw new Error("Private key/nostr-tools missing.");
            }
            try {
                event.id = window.NostrTools.getEventHash(event);
                event.sig = window.NostrTools.signEvent(event, this.userPrivateKey);
                return event;
            } catch (error) {
                throw new Error(`Failed to sign with key: ${error.message || error}`);
            }
        } else {
            throw new Error("Unknown login method.");
        }
    }

    // Fetch user's own profile and ensure UI gets updated
    async fetchUserProfile() {
        if (!this.publicKey) return;

        console.log("Fetching user's own profile...");
        
        // Use ProfileUtils to fetch the profile
        if (window.profileUtils) {
            window.profileUtils.fetchProfiles([this.publicKey]);
        } else {
            // Fallback: direct fetch if ProfileUtils not available
            const profileFilter = {
                authors: [this.publicKey],
                kinds: [0],
                limit: 1
            };

            const subscriptionId = window.generateSubId();
            const message = ["REQ", subscriptionId, profileFilter];

            window.connectedRelays.forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(message));
                }
            });

            // Set up temporary listener for own profile
            const tempHandler = (event) => {
                if (event.detail?.subscriptionId === subscriptionId && event.detail?.event?.kind === 0) {
                    this.processOwnProfileEvent(event.detail.event);
                }
            };

            document.addEventListener('nostrEvent', tempHandler);

            // Clean up after 5 seconds
            setTimeout(() => {
                const closeMessage = ["CLOSE", subscriptionId];
                window.connectedRelays.forEach((ws) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify(closeMessage));
                    }
                });
                document.removeEventListener('nostrEvent', tempHandler);
            }, 5000);
        }
    }

    // Process user's own profile event
    processOwnProfileEvent(event) {
        try {
            const profileData = JSON.parse(event.content);
            profileData.created_at = event.created_at;
            profileData.fetchedAt = Date.now();
            
            // Update auth manager profile
            this.profile = profileData;
            
            // Update caches
            if (window.profilesCache) {
                window.profilesCache.set(this.publicKey, profileData);
            }
            if (window.profileUtils && typeof window.profileUtils.setProfile === 'function') {
                window.profileUtils.setProfile(this.publicKey, profileData);
            }
            
            // Update UI
            this.updateUserProfileUI(profileData);
            
            console.log("Successfully updated user's own profile:", profileData.name || profileData.display_name);
        } catch (error) {
            console.error('Failed to parse user profile data:', error);
        }
    }

    // Update user profile UI in header
    updateUserProfileUI(profileData) {
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        
        if (userName && profileData) {
            userName.textContent = profileData.name || profileData.display_name || shortenPubKey(this.publicKey);
        }
        
        if (userAvatar && profileData) {
            const pictureUrl = profileData.picture;
            if (pictureUrl && pictureUrl.trim() !== '' && (pictureUrl.startsWith('http://') || pictureUrl.startsWith('https://'))) {
                userAvatar.src = pictureUrl;
                userAvatar.style.display = 'block';
                userAvatar.onerror = () => { 
                    userAvatar.style.display = 'none';
                };
            } else {
                userAvatar.style.display = 'none';
            }
        }
    }

    // Fetch user's follow list (Kind 3 event)
    async fetchFollowList() {
        if (!this.publicKey) return;

        // Check if any relays are connected
        const connectedCount = Array.from(window.connectedRelays.values()).filter(ws => ws.readyState === WebSocket.OPEN).length;
        if (connectedCount === 0) {
            // Retry after 2 seconds if no relays are connected
            setTimeout(() => this.fetchFollowList(), 2000);
            return;
        }

        const followListFilter = {
            authors: [this.publicKey],
            kinds: [3],
            limit: 1
        };

        const subscriptionId = `follows-${window.generateSubId()}`;
        const message = ["REQ", subscriptionId, followListFilter];

        window.connectedRelays.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        });

        // The follow list will be processed through the existing handleTemporarySubscriptionEvent 
        // which calls processFollowListEvent in index.html, which then syncs with authManager.follows

        // Auto-close subscription after 5 seconds
        setTimeout(() => {
            const closeMessage = ["CLOSE", subscriptionId];
            window.connectedRelays.forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(closeMessage));
                }
            });
        }, 5000);
    }

    // Process follow list from Kind 3 event
    processFollowList(event) {
        this.follows.clear();
        
        if (event.tags) {
            event.tags.forEach(tag => {
                if (tag[0] === 'p' && tag[1]) {
                    this.follows.add(tag[1]);
                }
            });
        }
        
        console.log(`Loaded ${this.follows.size} follows`);
        
        // Fetch profiles of followed users
        if (this.follows.size > 0) {
            const followedPubkeys = Array.from(this.follows).slice(0, 100); // Limit for performance
            if (typeof fetchProfiles === 'function') {
                fetchProfiles(followedPubkeys);
            } else if (window.profileUtils) {
                window.profileUtils.fetchProfiles(followedPubkeys);
            }
        }
    }

    // Fetch user's own posts for reply notifications
    async fetchUserPosts() {
        if (!this.publicKey) return;

        const userPostsFilter = {
            authors: [this.publicKey],
            kinds: [1],
            limit: 50
        };

        const subscriptionId = window.generateSubId();
        const message = ["REQ", subscriptionId, userPostsFilter];

        window.connectedRelays.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        });

        // Set up temporary listener for user posts
        const tempHandler = (event) => {
            if (event.detail?.subscriptionId === subscriptionId && event.detail?.event?.kind === 1) {
                this.posts.add(event.detail.event.id);
            }
        };

        document.addEventListener('nostrEvent', tempHandler);

        // Clean up after 5 seconds
        setTimeout(() => {
            const closeMessage = ["CLOSE", subscriptionId];
            window.connectedRelays.forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(closeMessage));
                }
            });
            document.removeEventListener('nostrEvent', tempHandler);
        }, 5000);
    }

    // Modal management methods
    showPrivateKeyModal() {
        if (typeof window.NostrTools === 'undefined') {
            showError("Cannot login with key: nostr-tools library not loaded.");
            return;
        }
        privateKeyInput.value = '';
        
        // Reset persistence checkbox
        const persistCheckbox = document.getElementById('persistPrivateKeyCheckbox');
        if (persistCheckbox) {
            persistCheckbox.checked = false;
        }
        
        privateKeyModal.classList.remove('hidden');
        privateKeyInput.focus();
    }

    hidePrivateKeyModal() {
        privateKeyModal.classList.add('hidden');
    }

    // Blocked Users Management
    getBlockedUsers() {
        const STORAGE_KEY_BLOCKED_USERS = 'nostrBlockedUsers';
        const OLD_STORAGE_KEY_BLOCKED_USERS = 'ncord_blocked_users';
        
        try {
            let stored = localStorage.getItem(STORAGE_KEY_BLOCKED_USERS);
            
            // If new key doesn't exist, try to migrate from old key
            if (!stored) {
                const oldStored = localStorage.getItem(OLD_STORAGE_KEY_BLOCKED_USERS);
                if (oldStored) {
                    console.log('Migrating blocked users from old storage key to new key');
                    localStorage.setItem(STORAGE_KEY_BLOCKED_USERS, oldStored);
                    localStorage.removeItem(OLD_STORAGE_KEY_BLOCKED_USERS);
                    stored = oldStored;
                }
            }
            
            if (stored) {
                return new Set(JSON.parse(stored));
            }
        } catch (error) {
            console.warn('Failed to load blocked users from localStorage:', error);
        }
        return new Set();
    }

    blockUser(pubkey) {
        if (!pubkey) return;
        
        const blockedUsers = this.getBlockedUsers();
        blockedUsers.add(pubkey);
        
        // Save to localStorage
        const STORAGE_KEY_BLOCKED_USERS = 'nostrBlockedUsers';
        try {
            localStorage.setItem(STORAGE_KEY_BLOCKED_USERS, JSON.stringify(Array.from(blockedUsers)));
        } catch (error) {
            console.warn('Failed to save blocked users to localStorage:', error);
        }
        
        // Update global blocked users set for immediate filtering
        if (window.blockedUsers) {
            window.blockedUsers.add(pubkey);
        }
        
        // Remove existing messages from this user in the current feed
        this.removeMessagesFromBlockedUser(pubkey);
        
        // Show success message
        if (typeof showSuccess === 'function') {
            showSuccess("User blocked!");
        }
        
        console.log("Blocked user:", pubkey.substring(0, 8) + '...');
        
        // Trigger state update
        this.triggerStateChange();
    }

    unblockUser(pubkey) {
        if (!pubkey) return;
        
        const blockedUsers = this.getBlockedUsers();
        if (!blockedUsers.has(pubkey)) return;
        
        blockedUsers.delete(pubkey);
        
        // Save to localStorage
        const STORAGE_KEY_BLOCKED_USERS = 'nostrBlockedUsers';
        try {
            localStorage.setItem(STORAGE_KEY_BLOCKED_USERS, JSON.stringify(Array.from(blockedUsers)));
        } catch (error) {
            console.warn('Failed to save blocked users to localStorage:', error);
        }
        
        // Update global blocked users set for immediate filtering
        if (window.blockedUsers) {
            window.blockedUsers.delete(pubkey);
        }
        
        // Show success message
        if (typeof showSuccess === 'function') {
            showSuccess("User unblocked!");
        }
        
        console.log("Unblocked user:", pubkey.substring(0, 8) + '...');
        
        // Trigger state update
        this.triggerStateChange();
        
        // Note: We don't automatically refresh the feed to show messages from unblocked users
        // since that would cause a full feed reload. Users can manually refresh if needed.
    }

    isUserBlocked(pubkey) {
        return this.getBlockedUsers().has(pubkey);
    }
    
    // Remove existing messages from a blocked user in the current feed
    removeMessagesFromBlockedUser(pubkey) {
        if (!pubkey || typeof document === 'undefined') return;
        
        // Find and remove all messages from this user in the current feed
        const messageContainer = document.getElementById('messageContainer');
        if (!messageContainer) return;
        
        const messagesToRemove = messageContainer.querySelectorAll(`[data-pubkey="${pubkey}"]`);
        console.log(`Removing ${messagesToRemove.length} existing messages from blocked user:`, pubkey.substring(0, 8) + '...');
        
        messagesToRemove.forEach(message => {
            message.remove();
        });
    }

    // Helper method to trigger state change callback
    triggerStateChange() {
        if (typeof this.onStateChange === 'function') {
            this.onStateChange();
        }
    }
}

// Global auth manager instance
const authManager = new AuthManager();
