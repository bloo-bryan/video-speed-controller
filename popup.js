// popup.js (Revised)

document.addEventListener('DOMContentLoaded', () => {

  const slider = document.getElementById('speedSlider');
  const speedValueDisplay = document.getElementById('speedValue');
  const resetButton = document.getElementById('resetButton');

  if (!slider || !speedValueDisplay || !resetButton) {
      console.error("Error: Could not find essential popup elements.");
      document.body.innerHTML = "<p style='color: red; padding: 10px;'>Error loading extension popup elements.</p>";
      return;
  }

  // --- Function to Set Speed (via Content Script Function Execution) ---
  function setSpeedOnPage(speed) {
    // We still need to find the active tab to execute the function in its context
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
        console.error("Error querying tabs:", chrome.runtime.lastError || "No active tab found.");
        return;
      }
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) {
          console.error("Error: Invalid active tab found.");
          return;
      }

      // *** REMOVED the executeScript call for { files: ['content.js'] } ***
      // It's no longer needed as the manifest injects the script automatically.

      // Now, just execute the function WITHIN the already-loaded content script
      chrome.scripting.executeScript({
          target : {tabId : activeTab.id, allFrames: true}, // Target all frames just in case video is in one
          func : applySpeedFromPopup, // Execute this function defined below
          args : [ speed ]            // Pass the desired speed
      }).catch(err => console.error("Error executing speed function in content script:", err));

    });
  }

  // --- Function Definition for Injection ---
  // This function is defined within popup.js, then serialized and executed
  // IN THE CONTEXT of content.js by the executeScript call above.
  // It relies on content.js having loaded (via manifest) and defined its own 'applySpeed' function.
  function applySpeedFromPopup(newSpeed) {
     // This code runs on the webpage, not in the popup!
     if (typeof applySpeed === 'function') {
          applySpeed(newSpeed); // Call the applySpeed function defined in content.js
     } else {
          console.error("applySpeed function not found in content script context. Applying speed directly (fallback).");
          const videos = document.querySelectorAll('video');
          videos.forEach(video => {
              try { video.playbackRate = newSpeed; } catch (e) { console.error("Fallback failed:", e); }
          });
     }
  }
  // --- End of function definition for injection ---


  // --- Event Listeners (No changes needed here) ---
  slider.addEventListener('input', () => {
    const speedValue = parseFloat(slider.value);
    const formattedSpeed = speedValue.toFixed(1);
    speedValueDisplay.textContent = formattedSpeed;
    setSpeedOnPage(speedValue);
    chrome.storage.local.set({ playbackSpeed: formattedSpeed }, () => {
        if (chrome.runtime.lastError) console.error("Error saving speed:", chrome.runtime.lastError);
    });
  });

  resetButton.addEventListener('click', () => {
      const defaultSpeed = 1.0;
      const formattedSpeed = defaultSpeed.toFixed(1);
      slider.value = defaultSpeed;
      speedValueDisplay.textContent = formattedSpeed;
      setSpeedOnPage(defaultSpeed);
      chrome.storage.local.set({ playbackSpeed: formattedSpeed }, () => {
          if (chrome.runtime.lastError) console.error("Error saving reset speed:", chrome.runtime.lastError);
      });
  });

  // --- Load Initial Speed (No changes needed here) ---
  chrome.storage.local.get(['playbackSpeed'], (result) => {
     if (chrome.runtime.lastError) {
          console.error("Error loading speed:", chrome.runtime.lastError);
     } else {
         const savedSpeed = result.playbackSpeed || '1.0';
         slider.value = savedSpeed;
         speedValueDisplay.textContent = savedSpeed;
     }
  });

}); // --- End of DOMContentLoaded listener ---