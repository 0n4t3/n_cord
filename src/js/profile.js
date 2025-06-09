// Profile Management
class ProfileManager {
    constructor(authManager) {
        this.authManager = authManager;
        this.profilesCache = new Map();
        this.currentProfilePubkey = null;
        
        // Bind methods
        this.openProfile = this.openProfile.bind(this);
        this.openOwnProfile = this.openOwnProfile.bind(this);
        this.closeProfile = this.closeProfile.bind(this);
        this.followUser = this.followUser.bind(this);
        this.unfollowUser = this.unfollowUser.bind(this);
        this.blockUser = this.blockUser.bind(this);
        this.unblockUser = this.unblockUser.bind(this);
        this.saveProfileChanges = this.saveProfileChanges.bind(this);
        this.copyPubkey = this.copyPubkey.bind(this);
    }

    // Open profile modal for a specific user
    async openProfile(pubkey) {
        if (!pubkey) return;
        
        this.currentProfilePubkey = pubkey;
        profileModal.classList.remove('hidden');
        
        // Reset modal content
        profileDisplayName.textContent = 'Loading...';
        profileNpub.textContent = `npub${pubkey.substring(0, 8)}...`;
        profileBio.innerHTML = '';
        
        // Convert pubkey to npub for display
        try {
            if (typeof window.NostrTools?.nip19?.npubEncode === 'function') {
                const npub = window.NostrTools.nip19.npubEncode(pubkey);
                profileNpub.textContent = npub;
            }
        } catch (error) {
            console.warn('Failed to encode npub:', error);
        }
        
        // Set default avatar
        profileAvatarLarge.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${pubkey}`;
        profileAvatarLarge.onerror = () => {
            profileAvatarLarge.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iMjAiIGZpbGw9IiM2MzY2RjEiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDEyQzE0LjQ4NTMgMTIgMTYuNSA5Ljk4NTI4IDE2LjUgNy41QzE2LjUgNS4wMTQ3MiAxNC40ODUzIDMgMTIgM0M5LjUxNDcyIDMgNy41IDUuMDE0NzIgNy41IDcuNUM3LjUgOS45ODUyOCA5LjUxNDcyIDEyIDEyIDEyWiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTEyIDEzLjVDNi43NSAxMy41IDIuMjUgMTUuNzUgMi4yNSAyMS43NUM2LjUgMjEuNzUgMTcuNSAyMS43NSAyMS43NSAyMS43NUMyMS43NSAxNS43NSAxNy4yNSAxMy41IDEyIDEzLjVaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+';
        };
        
        // Load profile data
        await this.loadProfileData(pubkey);
        
        // Update UI based on current user
        this.updateProfileUI(pubkey);
    }

    // Open current user's own profile
    openOwnProfile() {
        if (!this.authManager.isLoggedIn) return;
        this.openProfile(this.authManager.publicKey);
    }

    // Close profile modal
    closeProfile() {
        profileModal.classList.add('hidden');
        this.currentProfilePubkey = null;
        // Hide edit form if open
        editProfileForm.classList.add('hidden');
        editProfileBtn.textContent = 'Edit Profile';
    }

    // Load profile data from cache or fetch from relays
    async loadProfileData(pubkey) {
        // Check cache first
        if (this.profilesCache.has(pubkey)) {
            const cachedProfile = this.profilesCache.get(pubkey);
            this.displayProfileData(cachedProfile);
            // Update action buttons for cached profile too
            this.updateProfileUI(pubkey);
            return;
        }

        // Fetch from relays
        const profileFilter = {
            authors: [pubkey],
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

        // Set up temporary listener
        const tempHandler = (event) => {
            if (event.detail?.subscriptionId === subscriptionId && event.detail?.event?.kind === 0) {
                try {
                    const profileData = JSON.parse(event.detail.event.content);
                    profileData.created_at = event.detail.event.created_at;
                    this.profilesCache.set(pubkey, profileData);
                    
                    // Also update shared profile utils cache
                    if (window.profileUtils) {
                        window.profileUtils.setProfile(pubkey, profileData);
                    }
                    
                    this.displayProfileData(profileData);
                    // Update action buttons after displaying profile data
                    this.updateProfileUI(pubkey);
                } catch (error) {
                    console.error('Failed to parse profile data:', error);
                }
            }
        };

        document.addEventListener('nostrEvent', tempHandler);

        // Clean up after 8 seconds to allow more time for profile loading
        setTimeout(() => {
            const closeMessage = ["CLOSE", subscriptionId];
            window.connectedRelays.forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(closeMessage));
                }
            });
            document.removeEventListener('nostrEvent', tempHandler);
            
            // If no profile data was received, show a fallback
            if (!this.profilesCache.has(pubkey)) {
                const fallbackProfile = {
                    name: 'Anonymous User',
                    picture: null,
                    about: null,
                    nip05: null
                };
                this.profilesCache.set(pubkey, fallbackProfile);
                
                // Also update shared profile utils cache
                if (window.profileUtils) {
                    window.profileUtils.setProfile(pubkey, fallbackProfile);
                }
                
                this.displayProfileData(fallbackProfile);
                // Update action buttons for fallback profile too
                this.updateProfileUI(pubkey);
            }
        }, 8000);
    }

    // Display profile data in modal
    displayProfileData(profileData) {
        profileDisplayName.textContent = profileData.name || profileData.display_name || 'Anonymous';
        
        if (profileData.picture) {
            profileAvatarLarge.src = profileData.picture;
        }
        
        if (profileData.about) {
            profileBio.innerHTML = this.formatBio(profileData.about);
        } else {
            profileBio.innerHTML = '<p class="text-gray-500 italic">No bio available</p>';
        }
        
        if (profileData.nip05) {
            profileNip05.textContent = profileData.nip05;
            profileNip05.classList.remove('hidden');
        } else {
            profileNip05.classList.add('hidden');
        }

        // Update user's own profile in auth manager
        if (this.currentProfilePubkey === this.authManager.publicKey) {
            this.authManager.profile = profileData;
            
            // Update header avatar and name
            if (profileData.picture) {
                userAvatar.src = profileData.picture;
                userAvatar.style.display = 'block';
            }
            if (profileData.name || profileData.display_name) {
                userName.textContent = profileData.name || profileData.display_name;
            }
        }
    }

    // Format bio text (simple markdown-like formatting)
    formatBio(bio) {
        if (!bio) return '';
        
        // Escape HTML
        const escaped = bio.replace(/[&<>"']/g, function(match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
        
        // Convert URLs to links
        const withLinks = escaped.replace(
            /https?:\/\/[^\s<>"']+/gi,
            '<a href="$&" target="_blank" rel="noopener noreferrer" class="text-purple-400 hover:text-purple-300 underline">$&</a>'
        );
        
        // Convert line breaks
        return withLinks.replace(/\n/g, '<br>');
    }

    // Update profile UI buttons based on current user
    updateProfileUI(pubkey) {
        // Hide all buttons first
        editProfileBtn.classList.add('hidden');
        followBtn.classList.add('hidden');
        unfollowBtn.classList.add('hidden');
        blockBtn.classList.add('hidden');
        unblockBtn.classList.add('hidden');

        if (!this.authManager.isLoggedIn) {
            // Not logged in - only show copy button
            return;
        }

        if (pubkey === this.authManager.publicKey) {
            // Own profile - show edit button
            editProfileBtn.classList.remove('hidden');
        } else {
            // Other user's profile - show follow/unfollow and block/unblock
            if (this.authManager.follows.has(pubkey)) {
                unfollowBtn.classList.remove('hidden');
            } else {
                followBtn.classList.remove('hidden');
            }

            if (this.authManager.isUserBlocked(pubkey)) {
                unblockBtn.classList.remove('hidden');
            } else {
                blockBtn.classList.remove('hidden');
            }
        }
    }

    // Follow a user
    async followUser(pubkey) {
        if (!this.authManager.isLoggedIn) {
            showError("Please log in to follow users.");
            return;
        }

        try {
            // Add to follows set
            this.authManager.follows.add(pubkey);
            
            // Create follow list event
            const followTags = Array.from(this.authManager.follows).map(pk => ['p', pk]);
            
            const followEvent = {
                kind: 3,
                content: '',
                tags: followTags
            };

            const signedEvent = await this.authManager.signEvent(followEvent);
            
            // Publish to relays
            const publishMessage = ["EVENT", signedEvent];
            let publishedCount = 0;
            
            window.connectedRelays.forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(publishMessage));
                    publishedCount++;
                }
            });

            if (publishedCount > 0) {
                showSuccess(`Now following user`);
                // Update UI
                followBtn.classList.add('hidden');
                unfollowBtn.classList.remove('hidden');
            } else {
                throw new Error("No connected relays to publish to");
            }
        } catch (error) {
            console.error('Follow error:', error);
            showError(`Failed to follow user: ${error.message}`);
            // Revert the change
            this.authManager.follows.delete(pubkey);
        }
    }

    // Unfollow a user
    async unfollowUser(pubkey) {
        if (!this.authManager.isLoggedIn) {
            showError("Please log in to unfollow users.");
            return;
        }

        try {
            // Remove from follows set
            this.authManager.follows.delete(pubkey);
            
            // Create follow list event
            const followTags = Array.from(this.authManager.follows).map(pk => ['p', pk]);
            
            const followEvent = {
                kind: 3,
                content: '',
                tags: followTags
            };

            const signedEvent = await this.authManager.signEvent(followEvent);
            
            // Publish to relays
            const publishMessage = ["EVENT", signedEvent];
            let publishedCount = 0;
            
            window.connectedRelays.forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(publishMessage));
                    publishedCount++;
                }
            });

            if (publishedCount > 0) {
                showSuccess(`Unfollowed user`);
                // Update UI
                unfollowBtn.classList.add('hidden');
                followBtn.classList.remove('hidden');
            } else {
                throw new Error("No connected relays to publish to");
            }
        } catch (error) {
            console.error('Unfollow error:', error);
            showError(`Failed to unfollow user: ${error.message}`);
            // Revert the change
            this.authManager.follows.add(pubkey);
        }
    }

    // Block a user
    async blockUser(pubkey) {
        if (!pubkey || !this.authManager.isLoggedIn) return;
        
        this.authManager.blockUser(pubkey);
        this.updateActionButtons();
        
        // Close the profile modal since we blocked this user
        if (profileModal && !profileModal.classList.contains('hidden')) {
            profileModal.classList.add('hidden');
        }
    }

    // Unblock a user
    async unblockUser(pubkey) {
        if (!pubkey || !this.authManager.isLoggedIn) return;
        
        this.authManager.unblockUser(pubkey);
        this.updateActionButtons();
    }

    // Update action buttons based on current state
    updateActionButtons() {
        if (!this.currentProfilePubkey) return;
        this.updateProfileUI(this.currentProfilePubkey);
    }

    // Copy user's public key
    copyPubkey() {
        if (!this.currentProfilePubkey) return;
        
        navigator.clipboard.writeText(this.currentProfilePubkey).then(() => {
            showSuccess('Public key copied to clipboard');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = this.currentProfilePubkey;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showSuccess('Public key copied to clipboard');
        });
    }

    // Toggle edit profile form
    toggleEditProfile() {
        const isEditing = !editProfileForm.classList.contains('hidden');
        
        if (isEditing) {
            // Cancel editing
            editProfileForm.classList.add('hidden');
            editProfileBtn.textContent = 'Edit Profile';
        } else {
            // Start editing
            this.populateEditForm();
            editProfileForm.classList.remove('hidden');
            editProfileBtn.textContent = 'Cancel Edit';
        }
    }

    // Populate edit form with current profile data
    populateEditForm() {
        const profile = this.authManager.profile || {};
        
        if (editDisplayName) editDisplayName.value = profile.name || profile.display_name || '';
        if (editBio) editBio.value = profile.about || '';
        if (editPicture) editPicture.value = profile.picture || '';
        if (editNip05) editNip05.value = profile.nip05 || '';
    }

    // Save profile changes
    async saveProfileChanges() {
        if (!this.authManager.isLoggedIn) {
            showError("Please log in to edit your profile.");
            return;
        }

        const profileData = {
            name: editDisplayName ? editDisplayName.value.trim() : '',
            about: editBio ? editBio.value.trim() : '',
            picture: editPicture ? editPicture.value.trim() : '',
            nip05: editNip05 ? editNip05.value.trim() : ''
        };

        // Remove empty fields
        Object.keys(profileData).forEach(key => {
            if (!profileData[key]) delete profileData[key];
        });

        try {
            const event = {
                kind: 0,
                content: JSON.stringify(profileData),
                tags: []
            };

            const signedEvent = await this.authManager.signEvent(event);
            
            // Publish to relays
            const publishMessage = ["EVENT", signedEvent];
            let publishedCount = 0;
            
            connectedRelays.forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(publishMessage));
                    publishedCount++;
                }
            });

            if (publishedCount > 0) {
                showSuccess('Profile updated successfully');
                
                // Update cache and display
                this.profilesCache.set(this.authManager.publicKey, profileData);
                
                // Also update shared profile utils cache
                if (window.profileUtils) {
                    window.profileUtils.setProfile(this.authManager.publicKey, profileData);
                }
                
                this.displayProfileData(profileData);
                
                // Hide edit form
                editProfileForm.classList.add('hidden');
                editProfileBtn.textContent = 'Edit Profile';
            } else {
                throw new Error("No connected relays to publish to");
            }
        } catch (error) {
            console.error('Profile update error:', error);
            showError(`Failed to update profile: ${error.message}`);
        }
    }

    // Get profile from cache (formatted)
    getProfile(pubkey) {
        // Use the shared profile utils for consistent formatting
        if (window.profileUtils) {
            return window.profileUtils.getProfile(pubkey);
        }
        
        // Fallback to raw cache data
        const profile = this.profilesCache.get(pubkey);
        if (profile) {
            const pictureUrl = profile.picture;
            const isValidUrl = pictureUrl && pictureUrl.trim() !== '' && (pictureUrl.startsWith('http://') || pictureUrl.startsWith('https://'));
            return { 
                name: profile.name || profile.display_name || pubkey.substring(0, 8) + '...', 
                picture: isValidUrl ? pictureUrl : null,
                hasValidPicture: isValidUrl,
                about: profile.about,
                nip05: profile.nip05
            };
        }
        
        return { 
            name: pubkey.substring(0, 8) + '...', 
            picture: null,
            hasValidPicture: false,
            about: null,
            nip05: null
        };
    }

    // Set profile in cache
    setProfile(pubkey, profileData) {
        this.profilesCache.set(pubkey, profileData);
        
        // Also update shared profile utils cache
        if (window.profileUtils) {
            window.profileUtils.setProfile(pubkey, profileData);
        }
    }

    // Clear profile cache
    clearCache() {
        this.profilesCache.clear();
    }

    // Blocked Users Management
    openBlockedUsersModal() {
        this.updateBlockedUsersListUI();
        if (blockedUsersModal) {
            blockedUsersModal.classList.remove('hidden');
        }
    }

    closeBlockedUsersModal() {
        if (blockedUsersModal) {
            blockedUsersModal.classList.add('hidden');
        }
    }

    updateBlockedUsersListUI() {
        if (!blockedUsersList) return;

        blockedUsersList.innerHTML = '';

        const blockedUsers = this.authManager.getBlockedUsers();
        if (blockedUsers.size === 0) {
            blockedUsersList.innerHTML = '<p class="text-gray-500 text-sm">No blocked users.</p>';
            return;
        }

        blockedUsers.forEach(pubkey => {
            const profile = this.getProfile(pubkey);
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between p-3 bg-[#231b2e] rounded border border-gray-600';
            
            // Create avatar HTML
            const avatarHTML = profile.hasValidPicture && profile.picture ?
                `<img src="${profile.picture}" alt="${profile.name}" class="w-8 h-8 rounded-full object-cover" onerror="this.style.display='none';">` :
                `<div class="w-8 h-8 rounded-full bg-[#9147ff] flex items-center justify-center text-white font-bold text-xs">${pubkey.substring(0, 2).toUpperCase()}</div>`;
            
            // Convert to npub for display
            let npub = pubkey;
            try {
                if (typeof window.NostrTools?.nip19?.npubEncode === 'function') {
                    npub = window.NostrTools.nip19.npubEncode(pubkey);
                }
            } catch (error) {
                console.warn('Failed to encode npub:', error);
            }
            
            div.innerHTML = `
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                    ${avatarHTML}
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold text-white truncate">${profile.name}</div>
                        <div class="text-xs text-gray-400 truncate">${npub}</div>
                    </div>
                </div>
                <button class="btn-unblock px-3 py-1 text-sm rounded-md">
                    Unblock
                </button>
            `;
            
            // Add click handler for unblock button
            const unblockBtn = div.querySelector('.btn-unblock');
            unblockBtn.addEventListener('click', () => {
                this.unblockUserFromList(pubkey);
            });
            
            blockedUsersList.appendChild(div);
        });
    }

    unblockUserFromList(pubkey) {
        this.authManager.unblockUser(pubkey);
        this.updateBlockedUsersListUI();
        
        // Update profile action buttons if this user's profile is currently open
        if (this.currentProfilePubkey === pubkey) {
            this.updateActionButtons();
        }
        
        // Show success message
        if (typeof showSuccess === 'function') {
            showSuccess("User unblocked!");
        }
        
        console.log("Unblocked user:", pubkey.substring(0, 8) + '...');
        
        // Note: AuthManager.unblockUser now handles the global blockedUsers Set synchronization
    }
}

// Global profile manager instance
const profileManager = new ProfileManager(authManager);
