document.addEventListener("DOMContentLoaded", () => {

  /* ================= ELEMENTS ================= */
  const editor = document.getElementById("editor");
  const checkBtn = document.getElementById("checkBtn");

  const fontSizeInput = document.getElementById("fontSizeInput");
  const boldBtn = document.getElementById("boldBtn");
  const italicBtn = document.getElementById("italicBtn");
  const underlineBtn = document.getElementById("underlineBtn");
  const highlightBtn = document.getElementById("highlightBtn");

  const timeInput = document.getElementById("timeInput");
  const playBtn = document.getElementById("playBtn");
  const muteBtn = document.getElementById("muteBtn");
  const alarmSound = document.getElementById("alarmSound");

  /* ================= NOTES ================= */
  let checklistMode = false;

  chrome.storage.local.get(["notesContent"], (res) => {
    if (res.notesContent) {
      editor.innerHTML = res.notesContent;
    } else {
      createTextLine();
    }
  });

  editor.addEventListener("input", saveNotes);

  checkBtn.onclick = () => {
    checklistMode = !checklistMode;
    checkBtn.textContent = checklistMode ? "Checklist ✓" : "Checklist";
  };

  editor.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      createTextLine();
      return;
    }
    if (e.key === "Backspace") {
      handleBackspace(e);
    }
  });

  function createTextLine() {
    const line = document.createElement("div");
    line.className = "line";

    if (checklistMode) {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.onchange = saveNotes;
      line.appendChild(cb);
    }

    const span = document.createElement("span");
    span.contentEditable = true;
    line.appendChild(span);

    editor.appendChild(line);
    placeCaret(span);
    saveNotes();
  }

  function saveNotes() {
    chrome.storage.local.set({ notesContent: editor.innerHTML });
  }

  /* ================= CARET ================= */
  function placeCaret(el) {
    const r = document.createRange();
    const s = window.getSelection();
    r.selectNodeContents(el);
    r.collapse(true);
    s.removeAllRanges();
    s.addRange(r);
  }

  function placeCaretAtEnd(el) {
    const r = document.createRange();
    const s = window.getSelection();
    r.selectNodeContents(el);
    r.collapse(false);
    s.removeAllRanges();
    s.addRange(r);
  }

  /* ================= CHECKLIST BACKSPACE ================= */
  function handleBackspace(e) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    if (range.startOffset !== 0) return;

    const span = range.startContainer.parentElement;
    if (!span || span.tagName !== "SPAN") return;

    const line = span.closest(".line");
    if (!line || !line.querySelector("input[type='checkbox']")) return;

    e.preventDefault();

    const prev = line.previousElementSibling;
    line.remove();

    if (prev) placeCaretAtEnd(prev.querySelector("span"));
    saveNotes();
  }

  /* ================= FORMATTING (RELIABLE) ================= */
  function focusEditor() {
    editor.focus();
  }

  boldBtn.onclick = () => {
    focusEditor();
    document.execCommand("bold");
    saveNotes();
  };

  italicBtn.onclick = () => {
    focusEditor();
    document.execCommand("italic");
    saveNotes();
  };

  underlineBtn.onclick = () => {
    focusEditor();
    document.execCommand("underline");
    saveNotes();
  };

  highlightBtn.onclick = () => {
    focusEditor();
    document.execCommand("hiliteColor", false, "yellow");
    saveNotes();
  };

  fontSizeInput.addEventListener("input", () => {
  const size = parseInt(fontSizeInput.value, 10);
  if (isNaN(size)) return;

  editor.focus();

  const sel = window.getSelection();
  let range;

  if (sel.rangeCount && !sel.isCollapsed) {
    // Use existing selection
    range = sel.getRangeAt(0);
  } else {
    // No selection → apply to current line
    const node = sel.anchorNode;
    if (!node) return;

    const span = node.nodeType === 3
      ? node.parentElement
      : node;

    if (!span || span.tagName !== "SPAN") return;

    range = document.createRange();
    range.selectNodeContents(span);

    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Apply temp font size
  document.execCommand("fontSize", false, "7");

  // Convert to real px
  editor.querySelectorAll("font[size='7']").forEach(font => {
    font.removeAttribute("size");
    font.style.fontSize = `${size}px`;
  });

  // Restore caret to end of the line
  sel.collapseToEnd();

  saveNotes();
});


  /* ================= TIMER ================= */
  let remainingSeconds = 0;
  let running = false;
  let muted = false;
  let interval = null;

  chrome.storage.local.get(
    ["remainingSeconds", "running", "muted"],
    (res) => {
      if (typeof res.remainingSeconds === "number")
        remainingSeconds = res.remainingSeconds;
      muted = !!res.muted;
      updateDisplay();
      updateMute();
      if (res.running && remainingSeconds > 0) start();
    }
  );

  timeInput.oninput = () => {
    if (running) return;
    remainingSeconds = parseTime(timeInput.value);
    updateDisplay();
    saveTimer();
  };

  playBtn.onclick = () => (running ? pause() : start());

  muteBtn.onclick = () => {
    muted = !muted;
    updateMute();
    chrome.storage.local.set({ muted });
  };

  function start() {
    if (remainingSeconds <= 0 || running) return;
    running = true;
    playBtn.textContent = "⏸";

    interval = setInterval(() => {
      remainingSeconds--;
      updateDisplay();
      saveTimer();
      if (remainingSeconds <= 0) {
        pause();
        if (!muted) alarmSound.play();
      }
    }, 1000);
  }

  function pause() {
    running = false;
    playBtn.textContent = "▶";
    clearInterval(interval);
    saveTimer();
  }

  function updateDisplay() {
    timeInput.value = formatTime(remainingSeconds);
  }

  function updateMute() {
    muteBtn.textContent = muted ? "🔇" : "🔊";
  }

  function saveTimer() {
    chrome.storage.local.set({ remainingSeconds, running });
  }

  function parseTime(str) {
    const p = str.split(":").map(n => parseInt(n, 10));
    if (p.length !== 3 || p.some(isNaN)) return 0;
    return p[0] * 3600 + p[1] * 60 + p[2];
  }

  function formatTime(sec) {
    sec = Math.max(0, sec);
    return [
      Math.floor(sec / 3600),
      Math.floor((sec % 3600) / 60),
      sec % 60
    ].map(n => String(n).padStart(2, "0")).join(":");
  }
});
