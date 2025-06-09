// Initialization and backward compatibility
// This file bridges the gap between the refactored code and the existing HTML

// Backward compatibility functions - these maintain the original function names 
// that might be called from the HTML or other parts of the code

function checkLoginStatus() {
    return authManager.checkLoginStatus();
}

function loginWithExtension() {
    return authManager.loginWithExtension();
}

function loginWithPrivateKey() {
    return authManager.loginWithPrivateKey();
}

function showPrivateKeyModal() {
    return authManager.showPrivateKeyModal();
}

function hidePrivateKeyModal() {
    return authManager.hidePrivateKeyModal();
}

// Make these functions globally accessible
window.loginWithExtension = loginWithExtension;
window.loginWithPrivateKey = loginWithPrivateKey;
window.showPrivateKeyModal = showPrivateKeyModal;
window.hidePrivateKeyModal = hidePrivateKeyModal;

function logout() {
    return authManager.logout();
}

function signEvent(event) {
    return authManager.signEvent(event);
}

function openProfile(pubkey) {
    return profileManager.openProfile(pubkey);
}

function openOwnProfile() {
    return profileManager.openOwnProfile();
}

function closeProfile() {
    return profileManager.closeProfile();
}

function toggleFollow(follow) {
    if (!profileManager.currentProfilePubkey) return;
    
    if (follow) {
        return profileManager.followUser(profileManager.currentProfilePubkey);
    } else {
        return profileManager.unfollowUser(profileManager.currentProfilePubkey);
    }
}

function toggleBlock(block) {
    if (!profileManager.currentProfilePubkey) return;
    
    if (block) {
        return profileManager.blockUser(profileManager.currentProfilePubkey);
    } else {
        return profileManager.unblockUser(profileManager.currentProfilePubkey);
    }
}

function copyCurrentProfilePubkey() {
    return profileManager.copyPubkey();
}

function toggleEditProfile(show) {
    if (show !== undefined) {
        if (show) {
            profileManager.toggleEditProfile();
        } else {
            profileManager.closeProfile();
        }
    } else {
        profileManager.toggleEditProfile();
    }
}

function saveProfileChanges() {
    return profileManager.saveProfileChanges();
}

// Expose getter functions for global state access
function getUserPubKey() {
    return authManager.publicKey;
}

function getUserPrivateKey() {
    return authManager.userPrivateKey;
}

function getLoginMethod() {
    return authManager.loginMethod;
}

function getUserProfile() {
    return authManager.profile;
}

function getUserFollows() {
    return authManager.follows;
}

function getUserPosts() {
    return authManager.posts;
}

function isLoggedIn() {
    return authManager.isLoggedIn;
}

// Expose profile cache functions
function getProfileFromCache(pubkey) {
    return profileManager.getProfile(pubkey);
}

function setProfileInCache(pubkey, profileData) {
    return profileManager.setProfile(pubkey, profileData);
}

// Update the global variables for backward compatibility
function updateGlobalState() {
    // Update global variables that other parts of the code might reference
    window.userPubKey = authManager.publicKey;
    window.userPrivateKey = authManager.userPrivateKey;
    window.loginMethod = authManager.loginMethod;
    window.userProfile = authManager.profile;
    window.userFollows = authManager.follows;
    window.userPosts = authManager.posts;
    window.currentProfilePubkey = profileManager.currentProfilePubkey;
    window.profilesCache = profileManager.profilesCache;
    window.blockedUsers = authManager.getBlockedUsers();
}

// Set up event listeners for the auth manager to update global state
authManager.onStateChange = updateGlobalState;

// Initialize global state
updateGlobalState();

// Auto-check login status
checkLoginStatus();

// Profile modal event listeners setup function - called from main DOMContentLoaded
function setupProfileEventListeners() {
    // Profile modal event listeners
    const closeProfileModal = document.getElementById('closeProfileModal');
    const editProfileBtn = document.getElementById('editProfileBtn');
    const followBtn = document.getElementById('followBtn');
    const unfollowBtn = document.getElementById('unfollowBtn');
    const blockBtn = document.getElementById('blockBtn');
    const unblockBtn = document.getElementById('unblockBtn');
    const copyPubkeyBtn = document.getElementById('copyPubkeyBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const profileModal = document.getElementById('profileModal');
    const blockedUsersBtn = document.getElementById('blockedUsersBtn');
    
    if (closeProfileModal) {
        closeProfileModal.addEventListener('click', closeProfile);
    }
    
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => profileManager.toggleEditProfile());
    }
    
    if (followBtn) {
        followBtn.addEventListener('click', () => toggleFollow(true));
    }
    
    if (unfollowBtn) {
        unfollowBtn.addEventListener('click', () => toggleFollow(false));
    }
    
    if (blockBtn) {
        blockBtn.addEventListener('click', () => toggleBlock(true));
    }
    
    if (unblockBtn) {
        unblockBtn.addEventListener('click', () => toggleBlock(false));
    }
    
    if (copyPubkeyBtn) {
        copyPubkeyBtn.addEventListener('click', copyCurrentProfilePubkey);
    }
    
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', saveProfileChanges);
    }
    
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => profileManager.toggleEditProfile());
    }
    
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                closeProfile();
            }
        });
    }

    // Blocked Users Management event listeners
    if (blockedUsersBtn) {
        blockedUsersBtn.addEventListener('click', openBlockedUsersModal);
    }
    
    const closeBlockedUsersModalBtn = document.getElementById('closeBlockedUsersBtn');
    if (closeBlockedUsersModalBtn) {
        closeBlockedUsersModalBtn.addEventListener('click', closeBlockedUsersModal);
    }
}

// Blocked users modal functions
function openBlockedUsersModal() {
    profileManager.openBlockedUsersModal();
}

function closeBlockedUsersModal() {
    profileManager.closeBlockedUsersModal();
}

// Make authManager and profileManager globally accessible for backward compatibility
// These assignments happen after the instances are created in their respective files
window.authManager = authManager;
window.profileManager = profileManager;
