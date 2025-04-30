// content.js (Enhanced with speed overlay)

const KEY_DECREASE = 's';
const KEY_INCREASE = 'd';
const SPEED_STEP = 0.1;
const MIN_SPEED = 0.1;
const MAX_SPEED = 8.0;
const OVERLAY_TIMEOUT_MS = 1500; // How long the overlay stays visible (in milliseconds)

let keyListenerAttached = false;

// --- Overlay Management ---

// Function to create (if needed) and return the overlay element for a video
function getOrCreateOverlay(video) {
    // Use a unique attribute to find/mark the overlay associated with this video
    const overlayAttribute = 'data-videospeed-overlay-for';
    const videoId = video.dataset.videospeedId || (video.dataset.videospeedId = `video-${Math.random().toString(36).substring(2, 9)}`);

    let overlay = document.querySelector(`[${overlayAttribute}="${videoId}"]`);

    if (!overlay) {
        console.log(`Video Speed Controller: Creating overlay for video ${videoId}`);
        overlay = document.createElement('div');
        overlay.setAttribute(overlayAttribute, videoId);
        overlay.style.position = 'absolute';
        overlay.style.top = '10px';
        overlay.style.left = '10px';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
        overlay.style.color = 'white';
        overlay.style.padding = '4px 8px';
        overlay.style.borderRadius = '4px';
        overlay.style.zIndex = '2147483647'; // Max z-index (or close to it)
        overlay.style.fontFamily = 'sans-serif';
        overlay.style.fontSize = '14px';
        overlay.style.fontWeight = 'bold';
        overlay.style.pointerEvents = 'none'; // Ignore mouse clicks
        overlay.style.opacity = '0'; // Start hidden
        overlay.style.transition = 'opacity 0.3s ease-out'; // Smooth fade
        overlay.textContent = '1.0x'; // Initial text

        // Ensure the video's parent is positioned to contain the absolute overlay
        const parent = video.parentElement;
        if (parent && getComputedStyle(parent).position === 'static') {
            parent.style.position = 'relative'; // Make parent the positioning context
        }
        // Append overlay usually next to the video within its positioned parent
        // or directly to body as fallback (less ideal positioning)
        (parent || document.body).appendChild(overlay);

        // Store reference on video element for easier access (optional)
         video._speedOverlayElement = overlay;
         video._speedOverlayTimeout = null; // Store timeout ID reference
    }
    // Ensure overlay is positioned correctly relative to video (might move)
    // Note: This basic positioning might not be perfect for all layouts.
    const videoRect = video.getBoundingClientRect();
    overlay.style.top = `${video.offsetTop + 10}px`; // Position relative to parent's coordinate system
    overlay.style.left = `${video.offsetLeft + 10}px`;


    return overlay;
}

// Function to show the overlay with the current speed
function showSpeedOverlay(video, speed) {
    const overlay = getOrCreateOverlay(video);
    if (!overlay) return; // Should not happen if creation works

    const formattedSpeed = speed.toFixed(1);
    overlay.textContent = `${formattedSpeed}x`;

    // Clear existing hide timeout if speed changes rapidly
    if (video._speedOverlayTimeout) {
        clearTimeout(video._speedOverlayTimeout);
    }

    // Make overlay visible (or re-trigger visibility)
    overlay.style.opacity = '1';

    // Set timeout to hide overlay
    video._speedOverlayTimeout = setTimeout(() => {
        overlay.style.opacity = '0';
         video._speedOverlayTimeout = null;
    }, OVERLAY_TIMEOUT_MS);
}

// --- Main function to apply speed (Modified to call overlay) ---
function applySpeed(newSpeed, fromInitialLoad = false) {
    const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, newSpeed));
    const formattedSpeed = clampedSpeed.toFixed(1);
    const floatSpeed = parseFloat(formattedSpeed);

    if (!fromInitialLoad) {
      console.log(`Video Speed Controller: Applying speed ${formattedSpeed}x`);
    }

    const videos = document.querySelectorAll('video');
    if (videos.length === 0 && !fromInitialLoad) {
        console.log("Video Speed Controller: No video elements found to apply speed.");
    }

    let speedWasChanged = false;
    videos.forEach(video => {
        // Only apply if speed is actually different & show overlay
        if (Math.abs(video.playbackRate - floatSpeed) > 0.01) {
             try {
                video.playbackRate = floatSpeed;
                showSpeedOverlay(video, floatSpeed); // *** Show the overlay ***
                speedWasChanged = true;
             } catch (error) {
                 if (!fromInitialLoad) console.error("Error setting playbackRate:", error);
             }
        } else if (!fromInitialLoad) {
            // If speed hasn't changed, but was manually triggered,
            // still show the overlay to confirm the current speed.
            showSpeedOverlay(video, floatSpeed);
        }
    });

    // Save speed logic (only if manually triggered or initial non-default)
    if (speedWasChanged || (!fromInitialLoad && formattedSpeed !== '1.0')) {
        chrome.storage.local.get(['playbackSpeed'], currentStorage => {
             if (chrome.runtime.lastError) { console.error("Storage get error:", chrome.runtime.lastError); return; }
            if (currentStorage.playbackSpeed !== formattedSpeed) {
                chrome.storage.local.set({ playbackSpeed: formattedSpeed }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Error saving speed:", chrome.runtime.lastError);
                    } else if (!fromInitialLoad) {
                         console.log(`Video Speed Controller: Speed ${formattedSpeed}x saved.`);
                    }
                });
            }
        });
    }
    return formattedSpeed;
}

// --- Keyboard Listener (No changes needed here) ---
function handleKeyDown(event) {
    const target = event.target;
    const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    const isVideoElement = target.tagName === 'VIDEO';

    if (isInputElement && !isVideoElement) return;

    let speedChange = 0;
    if (event.key.toLowerCase() === KEY_DECREASE) {
        speedChange = -SPEED_STEP;
    } else if (event.key.toLowerCase() === KEY_INCREASE) {
        speedChange = SPEED_STEP;
    }

    if (speedChange !== 0) {
        event.preventDefault();
        event.stopPropagation();
        chrome.storage.local.get(['playbackSpeed'], (result) => {
            if (chrome.runtime.lastError) { console.error("Error getting speed:", chrome.runtime.lastError); return; }
            const currentSpeed = parseFloat(result.playbackSpeed || '1.0');
            const newSpeed = currentSpeed + speedChange;
            applySpeed(newSpeed); // Apply & show overlay
        });
    }
}

// --- Mutation Observer to find new videos ---
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            // Check if the added node is a video element
            if (node.tagName === 'VIDEO') {
                console.log("Video Speed Controller: New <video> element detected.");
                prepareVideo(node); // Prepare overlay & apply speed
            }
            // Check if the added node contains video elements
            else if (node.querySelectorAll) {
                 node.querySelectorAll('video').forEach(videoNode => {
                     console.log("Video Speed Controller: New <video> detected within subtree.");
                     prepareVideo(videoNode); // Prepare overlay & apply speed
                 });
            }
        });
    });
});

// Function to prepare a video (create overlay, apply current speed)
function prepareVideo(video) {
    getOrCreateOverlay(video); // Ensure overlay container exists
    // Apply the currently saved speed to the new video
    chrome.storage.local.get(['playbackSpeed'], (result) => {
        if (chrome.runtime.lastError) { console.error("Error getting speed for new video:", chrome.runtime.lastError); return; }
        const savedSpeed = parseFloat(result.playbackSpeed || '1.0');
         // Check if speed needs setting (avoid unnecessary changes/overlay flashes)
        if (Math.abs(video.playbackRate - savedSpeed) > 0.01) {
            try {
                video.playbackRate = savedSpeed;
                console.log(`Video Speed Controller: Applied speed ${savedSpeed.toFixed(1)}x to new video.`);
                // Optionally show overlay briefly on new video load?
                // showSpeedOverlay(video, savedSpeed);
            } catch (e) {
                console.error("Error setting initial speed for new video:", e);
            }
        }
    });
}


// --- Attach Listener, Apply Initial Speed, Start Observer ---
function initializeSpeedControl() {
    // 1. Attach Keyboard Listener
    if (!keyListenerAttached) {
        document.addEventListener('keydown', handleKeyDown, true);
        keyListenerAttached = true;
        console.log("Video Speed Controller: Keyboard listener ('s'/'d') attached.");
    }

    // 2. Prepare existing videos & Apply saved speed
    document.querySelectorAll('video').forEach(video => {
        prepareVideo(video); // Ensure overlay exists & apply initial speed
    });


    // 3. Start observing the body for dynamically added videos
    observer.observe(document.body, {
      childList: true, // Watch for direct children changes
      subtree: true    // Watch for changes in all descendants
    });
     console.log("Video Speed Controller: Mutation Observer started.");
}

// Run the initialization
initializeSpeedControl();

// Make applySpeed accessible globally *within this script's context*
// so it can be called by the injected function from popup.js
// (This isn't strictly necessary if applySpeed is defined at top level, but good practice)
window.applySpeed = applySpeed;