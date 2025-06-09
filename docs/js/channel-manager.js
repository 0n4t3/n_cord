// Channel Management functionality
// Handles hashtag channels, subscriptions, and UI updates

// Channel management functions
function saveHashtags() {
    localStorage.setItem(STORAGE_KEY_HASHTAGS, JSON.stringify(subscribedHashtags));
}

function updateHashtagListUI() {
    if (!channelList) return;
    // Clear existing hashtags, keep global feed item
    channelList.querySelectorAll('.hashtag-channel').forEach(el => el.remove());

    subscribedHashtags.forEach(tag => {
        const channelId = `channel-#${tag}`;
        const div = document.createElement('div');
        div.id = channelId;
        div.className = 'channel-item hashtag-channel flex justify-between items-center group'; // Added group class for hover effect
        div.onclick = () => selectChannel(`#${tag}`);
        div.innerHTML = `
            <div class="flex items-center gap-2 overflow-hidden">
                <span class="text-xl">𓅦</span>
                <span class="truncate">${tag}</span>
            </div>
            <button class="text-gray-500 hover:text-red-400 p-1 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation(); removeHashtag('${tag}');" title="Remove #${tag}">
                🗑️
            </button>
        `;
        channelList.appendChild(div);
    });
    updateActiveChannelHighlight(); // Ensure correct item is highlighted
}

function addHashtag() {
    let tagName = addHashtagInput.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''); // Sanitize tag
    if (!tagName) return;
    if (subscribedHashtags.includes(tagName)) {
        showError(`Hashtag #${tagName} already added.`);
        return;
    }
    subscribedHashtags.push(tagName);
    subscribedHashtags.sort(); // Keep sorted
    saveHashtags();
    updateHashtagListUI();
    addHashtagInput.value = '';
    selectChannel(`#${tagName}`); // Switch to the new channel
}

function removeHashtag(tagToRemove) {
    subscribedHashtags = subscribedHashtags.filter(tag => tag !== tagToRemove);
    saveHashtags();
    updateHashtagListUI();
    // If the removed channel was active, switch back to global
    if (currentChannel === `#${tagToRemove}`) {
        selectChannel('global');
    }
}

function selectChannel(channelId) {
    if (channelId === currentChannel) return;
    console.log("Selecting channel:", channelId);
    currentChannel = channelId;
    updateActiveChannelHighlight();
    updateChannelHeader();
    subscribeToFeed(); // Resubscribe for the new channel/feed
}

function updateActiveChannelHighlight() {
    document.querySelectorAll('.channel-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItemId = `channel-${currentChannel.startsWith('#') ? currentChannel : 'global'}`;
    const activeItem = document.getElementById(activeItemId);
    if (activeItem) {
        activeItem.classList.add('active');
    }
}

function updateChannelHeader() {
    if (currentChannel === 'global') {
        channelIcon.innerHTML = '<span class="text-xl">𓅦</span>';
        channelTitle.textContent = ' Global Feed';
    } else {
        channelIcon.innerHTML = '<span class="text-xl">𓅦</span>';
        channelTitle.textContent = currentChannel; // Display #hashtag
    }
}

// Filter mode management functions
function setFilterMode(mode) {
    if (mode === currentFilterMode) return; // No change

    if (mode === 'following' && !authManager.isLoggedIn) {
        showError("Please log in to view messages from people you follow.");
        return;
    }

    console.log("Setting filter mode to:", mode);
    currentFilterMode = mode;
    updateFilterButtonLabel();
    subscribeToFeed(); // Resubscribe with the new filter
}

function updateFilterButtonLabel() {
    switch (currentFilterMode) {
        case 'following': 
            filterLabel.textContent = "Following Only"; 
            break;
        // Add cases for 'followers', 'both' if implemented
        case 'global':
        default: 
            filterLabel.textContent = "Global Messages"; 
            break;
    }
}
