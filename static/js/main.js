document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const retryBtn = document.getElementById('retry-btn');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const filterPillsContainer = document.getElementById('filter-pills-container');
    const lastUpdatedText = document.getElementById('last-updated-text');
    const notesFeed = document.getElementById('notes-feed');
    
    // States
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const emptyState = document.getElementById('empty-state');
    
    // Composer Elements
    const composerEmpty = document.getElementById('composer-empty');
    const composerActive = document.getElementById('composer-active');
    const previewTypeBadge = document.getElementById('preview-type-badge');
    const previewDate = document.getElementById('preview-date');
    const previewSnippet = document.getElementById('preview-snippet');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCount = document.getElementById('char-count');
    const progressRingCircle = document.getElementById('progress-ring-circle');
    const copyBtn = document.getElementById('copy-btn');
    const tweetBtn = document.getElementById('tweet-btn');
    const tagButtons = document.querySelectorAll('.tag-btn');
    
    // Application Data State
    let allUpdates = []; // Parsed individual updates
    let activeFilter = 'all';
    let searchQuery = '';
    let selectedUpdateId = null;
    
    // Progress Ring Calculations
    const radius = progressRingCircle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    progressRingCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    progressRingCircle.style.strokeDashoffset = circumference;

    // Fetch and Initialize Data
    async function loadReleaseNotes(force = false) {
        setLoading(true);
        try {
            const response = await fetch(`/api/release-notes${force ? '?force=true' : ''}`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch release notes');
            }
            
            // Set update timestamp
            lastUpdatedText.textContent = `Synced: ${data.last_fetched}`;
            
            // Process the XML feed entries into split structured updates
            allUpdates = processEntries(data.entries);
            
            // Render
            applyFiltersAndRender();
            setLoading(false);
        } catch (error) {
            console.error('Error loading release notes:', error);
            errorMessage.textContent = error.message || 'Unable to connect to server.';
            setError(true);
        }
    }

    // Parse CDATA html and split into individual update objects
    function processEntries(entries) {
        const processed = [];
        const domParser = new DOMParser();
        
        entries.forEach(entry => {
            const entryDate = entry.title; // e.g. "June 15, 2026"
            const entryLink = entry.link;
            const doc = domParser.parseFromString(entry.raw_html, 'text/html');
            
            // Collect elements to group them by H3 headings
            const children = Array.from(doc.body.children);
            let currentType = 'Feature'; // Default fallback
            let currentNodes = [];
            let itemIndex = 0;
            
            function pushCurrentItem() {
                if (currentNodes.length > 0) {
                    // Create wrapper
                    const div = document.createElement('div');
                    currentNodes.forEach(node => div.appendChild(node.cloneNode(true)));
                    
                    const htmlContent = div.innerHTML;
                    const textContent = div.textContent || div.innerText || '';
                    const cleanText = textContent.trim().replace(/\s+/g, ' ');
                    
                    const updateId = `${entry.id}_item_${itemIndex++}`;
                    
                    processed.push({
                        id: updateId,
                        date: entryDate,
                        link: entryLink,
                        type: currentType.toLowerCase().trim(),
                        typeName: currentType,
                        html: htmlContent,
                        text: cleanText
                    });
                    
                    currentNodes = [];
                }
            }
            
            children.forEach(child => {
                if (child.tagName === 'H3') {
                    // Push the previous item if it exists
                    pushCurrentItem();
                    currentType = child.textContent.trim();
                } else {
                    currentNodes.push(child);
                }
            });
            
            // Push the final item
            pushCurrentItem();
        });
        
        return processed;
    }

    // Apply Filter & Search and Render to feed
    function applyFiltersAndRender() {
        const filtered = allUpdates.filter(update => {
            // Apply category filter
            const matchesType = activeFilter === 'all' || update.type === activeFilter;
            
            // Apply search filter
            const query = searchQuery.toLowerCase();
            const matchesSearch = !query || 
                update.date.toLowerCase().includes(query) || 
                update.typeName.toLowerCase().includes(query) || 
                update.text.toLowerCase().includes(query);
                
            return matchesType && matchesSearch;
        });
        
        if (filtered.length === 0) {
            notesFeed.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }
        
        emptyState.style.display = 'none';
        notesFeed.style.display = 'block';
        notesFeed.innerHTML = '';
        
        // Group filtered updates by Date
        const grouped = {};
        filtered.forEach(update => {
            if (!grouped[update.date]) {
                grouped[update.date] = [];
            }
            grouped[update.date].push(update);
        });
        
        // Render groups
        for (const date in grouped) {
            const dateGroup = document.createElement('div');
            dateGroup.className = 'date-group';
            
            const groupHeader = document.createElement('div');
            groupHeader.className = 'date-group-header';
            groupHeader.textContent = date;
            dateGroup.appendChild(groupHeader);
            
            const groupContent = document.createElement('div');
            groupContent.className = 'date-group-content';
            
            grouped[date].forEach(update => {
                const card = document.createElement('div');
                card.className = `note-card ${selectedUpdateId === update.id ? 'selected' : ''}`;
                card.setAttribute('data-id', update.id);
                card.setAttribute('data-item-type', update.type);
                
                // Truncate badge display string if too long
                const displayType = update.typeName.charAt(0).toUpperCase() + update.typeName.slice(1);
                
                card.innerHTML = `
                    <div class="card-header">
                        <span class="type-badge badge-${update.type}">${displayType}</span>
                        <div class="card-action">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                                <polyline points="16 6 12 2 8 6"></polyline>
                                <line x1="12" y1="2" x2="12" y2="15"></line>
                            </svg>
                        </div>
                    </div>
                    <div class="card-body">
                        ${update.html}
                    </div>
                `;
                
                card.addEventListener('click', () => selectUpdate(update));
                groupContent.appendChild(card);
            });
            
            dateGroup.appendChild(groupContent);
            notesFeed.appendChild(dateGroup);
        }
    }

    // Set UI States
    function setLoading(isLoading) {
        if (isLoading) {
            loadingState.style.display = 'flex';
            notesFeed.style.display = 'none';
            errorState.style.display = 'none';
            emptyState.style.display = 'none';
            refreshBtn.classList.add('spinning');
            refreshBtn.disabled = true;
        } else {
            loadingState.style.display = 'none';
            refreshBtn.classList.remove('spinning');
            refreshBtn.disabled = false;
        }
    }

    function setError(isError) {
        if (isError) {
            errorState.style.display = 'flex';
            loadingState.style.display = 'none';
            notesFeed.style.display = 'none';
            emptyState.style.display = 'none';
            refreshBtn.classList.remove('spinning');
            refreshBtn.disabled = false;
        } else {
            errorState.style.display = 'none';
        }
    }

    // Select/Highlight Update card
    function selectUpdate(update) {
        // Toggle selection
        if (selectedUpdateId === update.id) {
            selectedUpdateId = null;
            document.querySelectorAll('.note-card').forEach(c => c.classList.remove('selected'));
            showComposer(null);
        } else {
            selectedUpdateId = update.id;
            document.querySelectorAll('.note-card').forEach(c => {
                c.classList.toggle('selected', c.getAttribute('data-id') === update.id);
            });
            showComposer(update);
        }
    }

    // Show Composer Panel and populate draft
    function showComposer(update) {
        if (!update) {
            composerEmpty.style.display = 'flex';
            composerActive.style.display = 'none';
            return;
        }
        
        composerEmpty.style.display = 'none';
        composerActive.style.display = 'flex';
        
        // Update Preview Panel
        previewDate.textContent = update.date;
        previewTypeBadge.textContent = update.typeName.charAt(0).toUpperCase() + update.typeName.slice(1);
        previewTypeBadge.className = `type-badge badge-${update.type}`;
        previewSnippet.textContent = update.text;
        
        // Generate draft text
        // Limit details text size dynamically to avoid overflow of 280 X limit
        const tag = update.typeName.charAt(0).toUpperCase() + update.typeName.slice(1);
        const header = `BigQuery Update (${update.date}) - ${tag}:\n`;
        const link = `\n\nRead details: ${update.link}`;
        const hashtags = `\n#BigQuery #GCP`;
        
        const overheadLength = header.length + link.length + hashtags.length;
        const availableLength = 280 - overheadLength - 5; // buffer
        
        let snippet = update.text;
        if (snippet.length > availableLength) {
            snippet = snippet.substring(0, availableLength) + '...';
        }
        
        const initialTweetText = `${header}"${snippet}"${link}${hashtags}`;
        tweetTextarea.value = initialTweetText;
        
        updateCharacterCount();
        
        // Scroll composer into view on small screens
        if (window.innerWidth <= 1024) {
            composerActive.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Character counter updates
    function updateCharacterCount() {
        const text = tweetTextarea.value;
        const len = text.length;
        
        charCount.textContent = `${len}/280`;
        
        // Color coding class for warning/danger
        charCount.classList.remove('warning', 'danger');
        if (len > 280) {
            charCount.classList.add('danger');
            tweetBtn.disabled = true;
        } else if (len >= 250) {
            charCount.classList.add('warning');
            tweetBtn.disabled = false;
        } else {
            tweetBtn.disabled = false;
        }
        
        // Update circular indicator progress
        const percentage = Math.min(len / 280, 1);
        const offset = circumference - (percentage * circumference);
        progressRingCircle.style.strokeDashoffset = offset;
        
        // Radial progress color
        if (len > 280) {
            progressRingCircle.style.stroke = '#ef4444'; // Red
        } else if (len >= 250) {
            progressRingCircle.style.stroke = '#fbbf24'; // Amber
        } else {
            progressRingCircle.style.stroke = '#38bdf8'; // Blue
        }
    }

    // Textarea manual edits listener
    tweetTextarea.addEventListener('input', updateCharacterCount);

    // Filter pills event listener
    filterPillsContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;
        
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        
        activeFilter = pill.getAttribute('data-type');
        applyFiltersAndRender();
    });

    // Search events
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        applyFiltersAndRender();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        searchInput.focus();
        applyFiltersAndRender();
    });

    // Share buttons
    tweetBtn.addEventListener('click', () => {
        const tweetText = tweetTextarea.value;
        if (tweetText.length > 280) {
            alert("Draft exceeds X/Twitter's 280 character limit.");
            return;
        }
        const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(xUrl, '_blank', 'width=600,height=400,resizable=yes');
    });

    copyBtn.addEventListener('click', async () => {
        const tweetText = tweetTextarea.value;
        try {
            await navigator.clipboard.writeText(tweetText);
            
            // Temporary success feedback
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span style="color: #34d399;">Copied!</span>
            `;
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            alert("Unable to copy to clipboard. Please select the text and copy manually.");
        }
    });

    // Quick add hashtag event handler
    tagButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-type') || btn.textContent.trim();
            const text = tweetTextarea.value;
            
            // Only add if it doesn't already exist
            if (!text.includes(tag)) {
                tweetTextarea.value = text + ' ' + tag;
                updateCharacterCount();
            }
        });
    });

    // Refresh & Retries
    refreshBtn.addEventListener('click', () => loadReleaseNotes(true));
    retryBtn.addEventListener('click', () => loadReleaseNotes(true));

    // Initialize
    loadReleaseNotes();
});
