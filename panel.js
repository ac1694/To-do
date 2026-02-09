document.addEventListener("DOMContentLoaded", () => {

  /* elements */
  const editor = document.getElementById("editor");
  const checkBtn = document.getElementById("checkBtn");
  const clearBtn = document.getElementById("clearBtn");

  const boldBtn = document.getElementById("boldBtn");
  const italicBtn = document.getElementById("italicBtn");
  const underlineBtn = document.getElementById("underlineBtn");
  const highlightBtn = document.getElementById("highlightBtn");

  const timeInput = document.getElementById("timeInput");
  const playBtn = document.getElementById("playBtn");
  const muteBtn = document.getElementById("muteBtn");
  const alarmSound = document.getElementById("alarmSound");

  /* notes */
  let checklistMode = false;

  chrome.storage.local.get(["notesContent"], (res) => {
    if (res.notesContent && res.notesContent.trim() !== "") {
      editor.innerHTML = res.notesContent;
    }

    
    if (!editor.querySelector(".line")) {
      createTextLine();
    }
  });

  editor.addEventListener("input", saveNotes);

  checkBtn.onclick = () => {
    checklistMode = !checklistMode;
    checkBtn.textContent = checklistMode ? "Checklist ✓" : "Checklist";
  };

  /* key handling */
  editor.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      createTextLine();
      return;
    }

    if (e.key === "Backspace") {
      handleBackspace(e);

      
      editor.querySelectorAll("div:not(.line)").forEach(d => {
        if (d.innerHTML.trim() === "") d.remove();
      });
    }
  });

  editor.addEventListener("click", () => {
    if (!editor.querySelector(".line")) {
      createTextLine();
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

  /* caret*/
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

  /* checklist backspace */
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

  /* clear */
  clearBtn.onclick = () => {
    if (!confirm("Clear all notes?")) return;

    editor.innerHTML = "";
    chrome.storage.local.remove("notesContent");
    createTextLine();
  };

  /* formatting */
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

  /* Timer*/
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
