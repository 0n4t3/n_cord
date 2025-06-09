// Profile utilities and cache management
class ProfileUtils {
    constructor() {
        // Don't create our own cache initially - wait for initialization
        this.profilesCache = new Map();
    }

    // Update cache reference if main app's cache becomes available
    initializeCache() {
        if (window.profilesCache) {
            console.log("ProfileUtils: Switching to main app's profile cache");
            // Migrate any existing data to the main cache
            this.profilesCache.forEach((profile, pubkey) => {
                if (!window.profilesCache.has(pubkey)) {
                    window.profilesCache.set(pubkey, profile);
                }
            });
            // Use the main cache going forward
            this.profilesCache = window.profilesCache;
            console.log("ProfileUtils: Now using shared cache with", this.profilesCache.size, "profiles");
        } else {
            console.warn("ProfileUtils: Main app's profilesCache not yet available");
        }
    }

    // Get formatted profile data
    getProfile(pubkey) {
        // Try to use main app's cache first, fall back to our own
        const cache = window.profilesCache || this.profilesCache;
        const profile = cache.get(pubkey);
        
        if (profile) {
            const pictureUrl = profile.picture;
            // More robust URL validation
            const isValidUrl = pictureUrl && 
                             pictureUrl.trim() !== '' && 
                             typeof pictureUrl === 'string' &&
                             (pictureUrl.startsWith('http://') || pictureUrl.startsWith('https://')) &&
                             !pictureUrl.includes(' ') && // URLs shouldn't have spaces
                             pictureUrl.length > 10; // Basic length check
            
            const displayName = profile.name || profile.display_name || this.shortenPubKey(pubkey);
            
            return { 
                name: displayName, 
                picture: isValidUrl ? pictureUrl : null,
                hasValidPicture: isValidUrl,
                about: profile.about,
                nip05: profile.nip05,
                lud16: profile.lud16,
                created_at: profile.created_at,
                fetchedAt: profile.fetchedAt
            };
        } else {
            return { 
                name: this.shortenPubKey(pubkey), 
                picture: null,
                hasValidPicture: false,
                about: null,
                nip05: null,
                lud16: null,
                created_at: null,
                fetchedAt: null
            };
        }
    }

    // Set profile data in cache
    setProfile(pubkey, profileData) {
        this.profilesCache.set(pubkey, {
            ...profileData,
            fetchedAt: Date.now()
        });
    }

    // Set profile in cache directly (for synchronization)
    setProfileInCache(pubkey, profileData) {
        this.profilesCache.set(pubkey, profileData);
    }

    // Process metadata event and update cache
    processMetadataEvent(event) {
        const shortPubkey = this.shortenPubKey(event.pubkey);
        console.log("ProfileUtils: Processing metadata event for", shortPubkey, "at timestamp", event.created_at);
        try {
            const metadata = JSON.parse(event.content);
            const pubkey = event.pubkey;
            
            // Use main app's cache if available, fall back to our own
            const cache = window.profilesCache || this.profilesCache;
            const existingProfile = cache.get(pubkey);
            
            console.log("ProfileUtils: Raw metadata content:", event.content.substring(0, 200) + "...");
            console.log("ProfileUtils: Parsed metadata for", shortPubkey, ":", { 
                name: metadata.name, 
                display_name: metadata.display_name, 
                picture: metadata.picture ? metadata.picture.substring(0, 50) + "..." : null,
                about: metadata.about ? metadata.about.substring(0, 50) + "..." : null,
                nip05: metadata.nip05
            });
            
            if (existingProfile) {
                console.log("ProfileUtils: Existing profile found for", shortPubkey, "- created_at:", existingProfile.created_at, "vs new:", event.created_at);
            } else {
                console.log("ProfileUtils: No existing profile found for", shortPubkey);
            }
            
            if (!existingProfile || event.created_at > (existingProfile.created_at || 0)) {
                const profileData = {
                    name: metadata.name || metadata.display_name,
                    picture: metadata.picture, 
                    about: metadata.about, 
                    lud16: metadata.lud16 || metadata.lud06,
                    nip05: metadata.nip05, 
                    fetchedAt: Date.now(), 
                    created_at: event.created_at
                };
                
                console.log("ProfileUtils: Creating new profile data for", shortPubkey, ":", {
                    name: profileData.name,
                    picture: profileData.picture ? "URL present (" + profileData.picture.length + " chars)" : "No picture",
                    hasAbout: !!profileData.about,
                    hasNip05: !!profileData.nip05,
                    hasLud16: !!profileData.lud16,
                    fetchedAt: new Date(profileData.fetchedAt).toISOString()
                });
                
                // Update both caches
                this.profilesCache.set(pubkey, profileData);
                if (window.profilesCache) {
                    window.profilesCache.set(pubkey, profileData);
                    console.log("ProfileUtils: Updated main app cache for", shortPubkey);
                } else {
                    console.log("ProfileUtils: Main app cache not available, updated local cache only for", shortPubkey);
                }
                
                console.log(`ProfileUtils: Successfully updated profile cache for ${shortPubkey}:`, profileData.name);
                
                // Update main app's profile cache
                if (window.profilesCache) {
                    window.profilesCache.set(pubkey, this.profilesCache.get(pubkey));
                }
                
                // Update user profile UI if this is the current user
                if (window.authManager && pubkey === window.authManager.publicKey) { 
                    console.log("ProfileUtils: Updating UI for current user profile");
                    const userProfile = this.profilesCache.get(pubkey); 
                    window.userProfile = userProfile;
                    
                    // Update AuthManager's profile
                    window.authManager.profile = userProfile;
                    
                    // Update UI using both ProfileUtils and AuthManager methods
                    this.updateUserProfileUI(userProfile);
                    if (window.authManager.updateUserProfileUI) {
                        window.authManager.updateUserProfileUI(userProfile);
                    }
                }
                
                // Update any displayed messages from this user
                console.log("ProfileUtils: Updating messages from pubkey", shortPubkey);
                this.updateMessagesFromPubKey(pubkey);
                
                // Also update ProfileManager cache to keep them in sync
                if (window.profileManager) {
                    console.log("ProfileUtils: Syncing with ProfileManager cache for", shortPubkey);
                    window.profileManager.setProfile(pubkey, this.profilesCache.get(pubkey));
                } else {
                    console.log("ProfileUtils: ProfileManager not available for sync");
                }
                
                console.log("ProfileUtils: Finished processing metadata event for", shortPubkey);
            } else {
                console.log("ProfileUtils: Skipping update for", shortPubkey, "- older or same timestamp");
            }
        } catch (error) { 
            console.error(`ProfileUtils: Failed to parse metadata for event ${event.id} from ${this.shortenPubKey(event.pubkey)}:`, error);
            console.error("ProfileUtils: Raw event content:", event.content);
            console.error("ProfileUtils: Event structure:", {
                id: event.id,
                pubkey: event.pubkey,
                created_at: event.created_at,
                kind: event.kind,
                tags: event.tags,
                contentLength: event.content ? event.content.length : 0
            });
        }
    }

    // Fetch profiles for given pubkeys
    fetchProfiles(pubkeys) {
        console.log("ProfileUtils.fetchProfiles called with:", pubkeys);
        
        // Use main app's cache if available, fall back to our own
        const cache = window.profilesCache || this.profilesCache;
        
        const pubkeysToFetch = pubkeys.filter(pk => {
            const p = cache.get(pk); 
            // Only fetch if we don't have profile or it's older than 6 hours
            return !p || (Date.now() - p.fetchedAt > 6 * 3600 * 1000);
        });
        
        console.log("Pubkeys to fetch after filtering:", pubkeysToFetch);
        
        if (pubkeysToFetch.length === 0) {
            console.log("No profiles need fetching");
            return;
        }

        console.log("Fetching profiles for:", pubkeysToFetch.map(pk => this.shortenPubKey(pk)));
        const subId = `profiles-${this.generateSubId()}`;
        const filters = [{ kinds: [0], authors: pubkeysToFetch }];

        // Use broadcast directly for temporary subscription
        if (window.broadcast) {
            console.log("Broadcasting profile request with subId:", subId);
            window.broadcast(["REQ", subId, ...filters]);
            // Auto-close after a delay - increased timeout for better profile loading
            setTimeout(() => window.broadcast(["CLOSE", subId]), 10000);
        } else {
            console.error("window.broadcast is not available!");
        }
    }

    // Update user profile UI in header
    updateUserProfileUI(userProfile) {
        if (userProfile && window.authManager && window.authManager.isLoggedIn) {
            const userName = document.getElementById('userName');
            const userAvatar = document.getElementById('userAvatar');
            
            if (userName) {
                userName.textContent = userProfile.name || userProfile.display_name || this.shortenPubKey(window.authManager.publicKey);
            }
            
            if (userAvatar) {
                // Check if we have a valid picture URL before setting it
                const pictureUrl = userProfile.picture;
                if (pictureUrl && pictureUrl.trim() !== '' && (pictureUrl.startsWith('http://') || pictureUrl.startsWith('https://'))) {
                    userAvatar.src = pictureUrl;
                    userAvatar.style.display = 'block';
                    userAvatar.onerror = () => { 
                        userAvatar.style.display = 'none';
                    };
                } else {
                    // Hide avatar entirely if no valid picture URL
                    userAvatar.style.display = 'none';
                }
            }
        }
    }

    // Update messages displayed for a specific pubkey
    updateMessagesFromPubKey(pubkey) {
        const profile = this.getProfile(pubkey);
        const messageContainer = document.getElementById('messageContainer');
        
        if (messageContainer) {
            const messages = messageContainer.querySelectorAll(`.message[data-pubkey="${pubkey}"]`);
            messages.forEach(msgElement => {
                const avatarContainer = msgElement.querySelector('.flex-shrink-0');
                const nameElement = msgElement.querySelector('.author-name');
                
                if (avatarContainer && profile) {
                    // Regenerate avatar HTML based on current profile
                    let avatarHTML;
                    if (profile.hasValidPicture && profile.picture) {
                        avatarHTML = `<img src="${profile.picture}" alt="${profile.name.substring(0, 1)}" class="avatar-img w-10 h-10 rounded-full object-cover avatar cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all" onerror="this.style.display='none';" onclick="profileManager.openProfile('${pubkey}')" title="View ${profile.name}'s profile">`;
                    } else {
                        avatarHTML = `<div class="avatar-placeholder w-10 h-10 rounded-full bg-[#9147ff] flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all" onclick="profileManager.openProfile('${pubkey}')" title="View ${profile.name}'s profile">${pubkey.substring(0, 2).toUpperCase()}</div>`;
                    }
                    avatarContainer.innerHTML = avatarHTML;
                }
                
                if (nameElement) { 
                    nameElement.textContent = profile.name; 
                    nameElement.title = `View ${profile.name}'s profile`;
                }
            });
        }
    }

    // Clear profile cache
    clearCache() {
        this.profilesCache.clear();
    }

    // Generate subscription ID
    generateSubId() {
        return Math.random().toString(36).substring(2, 15);
    }

    // Shorten public key for display
    shortenPubKey(pubkey) {
        if (!pubkey || typeof pubkey !== 'string') return 'Unknown';
        return pubkey.length > 8 ? `${pubkey.substring(0, 8)}...` : pubkey;
    }
}

// Global profile utils instance
const profileUtils = new ProfileUtils();

// Expose global functions for backward compatibility
function getProfile(pubkey) {
    return profileUtils.getProfile(pubkey);
}

function processMetadataEvent(event) {
    return profileUtils.processMetadataEvent(event);
}

function fetchProfiles(pubkeys) {
    return profileUtils.fetchProfiles(pubkeys);
}

function updateUserProfileUI() {
    if (window.authManager && window.authManager.publicKey) {
        const userProfile = profileUtils.profilesCache.get(window.authManager.publicKey);
        return profileUtils.updateUserProfileUI(userProfile);
    }
}

function updateMessagesFromPubKey(pubkey) {
    return profileUtils.updateMessagesFromPubKey(pubkey);
}

// Sync with ProfileManager cache
function syncProfileCaches() {
    if (window.profileManager && window.profileManager.profilesCache) {
        // Copy profiles from ProfileManager to ProfileUtils
        window.profileManager.profilesCache.forEach((profile, pubkey) => {
            profileUtils.setProfile(pubkey, profile);
        });
        
        // Copy profiles from ProfileUtils to ProfileManager
        profileUtils.profilesCache.forEach((profile, pubkey) => {
            window.profileManager.setProfile(pubkey, profile);
        });
    }
}

// Expose ProfileUtils globally
window.ProfileUtils = ProfileUtils;
window.profileUtils = profileUtils;
