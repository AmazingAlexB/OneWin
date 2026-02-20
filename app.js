document.addEventListener("DOMContentLoaded", () => {
  // Storage
  let tasks = JSON.parse(localStorage.getItem("tasks") || "[]");
  let priorityMode = localStorage.getItem("priorityMode") || "deadline"; // "deadline" or "urgency"
  let reminderMinutes = localStorage.getItem("reminderMinutes");
  reminderMinutes = reminderMinutes === null ? null : (reminderMinutes === "off" ? null : Number(reminderMinutes));

  let userId = localStorage.getItem("userId");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("userId", userId);
  }

  // Elements
  const screens = {
    oneWin: document.getElementById("oneWinScreen"),
    brainDump: document.getElementById("brainDumpScreen"),
    settings: document.getElementById("settingsScreen"),
    help: document.getElementById("helpScreen"),
  };

  const helpBtn = document.getElementById("helpBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const brainBtn = document.getElementById("brainBtn");
  const addTaskBtn = document.getElementById("addTaskBtn");

  const helpBackBtn = document.getElementById("helpBackBtn");
  const settingsBackBtn = document.getElementById("settingsBackBtn");
  const backToOneWinFromBrain = document.getElementById("backToOneWinFromBrain");

  const oneWinTaskContainer = document.getElementById("oneWinTask");

  const addTaskOverlay = document.getElementById("addTaskOverlay");
  const taskInput = document.getElementById("taskInput");
  const dateInput = document.getElementById("dateInput");
  const timeInput = document.getElementById("timeInput");
  const saveTaskBtn = document.getElementById("saveTaskBtn");
  const cancelAddBtn = document.getElementById("cancelAddBtn");
  const urgencyButtons = document.querySelectorAll(".urgency-btn");

  const showTasksToggle = document.getElementById("showTasksToggle");
  const rolodexContainer = document.getElementById("rolodexContainer");
  const rolodexCard = document.getElementById("rolodexCard");
  const rolodexIndex = document.getElementById("rolodexIndex");
  const prevTaskBtn = document.getElementById("prevTaskBtn");
  const nextTaskBtn = document.getElementById("nextTaskBtn");
  const deleteTaskBtn = document.getElementById("deleteTaskBtn");

  const reminderButtons = document.querySelectorAll(".reminder-btn");
  const currentReminderLabel = document.getElementById("currentReminderLabel");
  const priorityButtons = document.querySelectorAll(".priority-btn");
  const currentPriorityLabel = document.getElementById("currentPriorityLabel");
  const userIdText = document.getElementById("userIdText");

  const reminderBanner = document.getElementById("reminderBanner");
  const reminderText = document.getElementById("reminderText");

  let selectedUrgency = null;
  let rolodexIndexValue = 0;
  let reminderIntervalId = null;

  // Helpers
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }

  function formatDateTime(task) {
    if (!task.deadlineDate || !task.deadlineTime) return "";
    return `${task.deadlineDate} · ${task.deadlineTime}`;
  }

  function getSortedTasks() {
    const remaining = tasks.filter(t => !t.done);
    if (priorityMode === "deadline") {
      return remaining.slice().sort((a, b) => {
        const aDT = new Date(`${a.deadlineDate}T${a.deadlineTime}`);
        const bDT = new Date(`${b.deadlineDate}T${b.deadlineTime}`);
        return aDT - bDT;
      });
    } else {
      const order = { "VERY URGENT": 1, "URGENT": 2, "NOT SO URGENT": 3 };
      return remaining.slice().sort((a, b) => order[a.urgency] - order[b.urgency]);
    }
  }

  // One Win rendering
  function renderOneWin() {
    oneWinTaskContainer.innerHTML = "";
    const sorted = getSortedTasks();

    if (sorted.length === 0) {
      oneWinTaskContainer.innerHTML = `
        <p class="onewin-title">No tasks yet</p>
        <p class="onewin-meta">Add a task with the blue + button.</p>
      `;
      return;
    }

    const task = sorted[0];

    const title = document.createElement("p");
    title.className = "onewin-title";
    title.textContent = task.title;

    const meta = document.createElement("p");
    meta.className = "onewin-meta";
    meta.textContent = `${task.urgency} · ${formatDateTime(task)}`;

    const completeRow = document.createElement("label");
    completeRow.className = "complete-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";

    const span = document.createElement("span");
    span.textContent = "Complete";

    completeRow.appendChild(checkbox);
    completeRow.appendChild(span);

    checkbox.addEventListener("change", () => {
  if (checkbox.checked) {

    // Remove the completed task entirely
    tasks = tasks.filter(t => t.id !== task.id);

    // Save using your existing function
    saveTasks();

    // Refresh UI
    renderOneWin();
    renderRolodex();
  }
});

    oneWinTaskContainer.appendChild(title);
    oneWinTaskContainer.appendChild(meta);
    oneWinTaskContainer.appendChild(completeRow);
  }

  // Brain Dump / Rolodex
  function renderRolodex() {
    const visibleTasks = tasks;
    if (!showTasksToggle.checked || visibleTasks.length === 0) {
      rolodexContainer.classList.add("hidden");
      return;
    }

    rolodexContainer.classList.remove("hidden");

    if (rolodexIndexValue >= visibleTasks.length) {
      rolodexIndexValue = visibleTasks.length - 1;
    }
    if (rolodexIndexValue < 0) rolodexIndexValue = 0;

    const t = visibleTasks[rolodexIndexValue];

    rolodexCard.innerHTML = `
      <p class="rolodex-title">${t.title}</p>
      <p class="rolodex-meta">${t.urgency} · ${formatDateTime(t)}</p>
    `;

    rolodexIndex.textContent = `${visibleTasks.length === 0 ? 0 : rolodexIndexValue + 1} / ${visibleTasks.length}`;
  }

  // Reminder
  function updateReminderLabel() {
    if (!reminderMinutes) {
      currentReminderLabel.textContent = "Current: Off";
      reminderButtons.forEach(b => b.classList.remove("active"));
      return;
    }
    currentReminderLabel.textContent = `Current: Every ${reminderMinutes} min(s)`;
    reminderButtons.forEach(b => {
      const val = b.dataset.mins;
      const isActive = val !== "off" && Number(val) === reminderMinutes;
      b.classList.toggle("active", isActive);
    });
  }

  function updatePriorityLabel() {
    currentPriorityLabel.textContent =
      priorityMode === "deadline" ? "Current: By deadline" : "Current: By urgency";
    priorityButtons.forEach(b => {
      b.classList.toggle("active", b.dataset.mode === priorityMode);
    });
  }

  function startReminderLoop() {
    clearInterval(reminderIntervalId);
    if (!reminderMinutes) return;

    reminderIntervalId = setInterval(() => {
      const sorted = getSortedTasks();
      if (sorted.length === 0) return;
      const task = sorted[0];
      reminderText.textContent = `One Win: ${task.title} (${formatDateTime(task)})`;
      reminderBanner.classList.remove("hidden");
      requestAnimationFrame(() => {
        reminderBanner.classList.add("show");
      });
    }, reminderMinutes * 60 * 1000);
  }

  reminderBanner.addEventListener("click", () => {
    reminderBanner.classList.remove("show");
    setTimeout(() => {
      reminderBanner.classList.add("hidden");
    }, 200);
  });

  // Navigation
  helpBtn.addEventListener("click", () => showScreen("help"));
  settingsBtn.addEventListener("click", () => showScreen("settings"));
  brainBtn.addEventListener("click", () => showScreen("brainDump"));

  helpBackBtn.addEventListener("click", () => showScreen("oneWin"));
  settingsBackBtn.addEventListener("click", () => showScreen("oneWin"));
  backToOneWinFromBrain.addEventListener("click", () => showScreen("oneWin"));

  // Add task overlay
  function openAddOverlay() {
    addTaskOverlay.classList.remove("hidden");
    taskInput.value = "";
    dateInput.value = "";
    timeInput.value = "";
    selectedUrgency = null;
    urgencyButtons.forEach(b => b.classList.remove("active"));
    validateSave();
  }

  function closeAddOverlay() {
    addTaskOverlay.classList.add("hidden");
  }

  addTaskBtn.addEventListener("click", openAddOverlay);
  cancelAddBtn.addEventListener("click", closeAddOverlay);

  urgencyButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      urgencyButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedUrgency = btn.dataset.urgency;
      validateSave();
    });
  });

  function validateSave() {
    const ok =
      taskInput.value.trim() &&
      dateInput.value &&
      timeInput.value &&
      selectedUrgency;
    saveTaskBtn.disabled = !ok;
  }

  taskInput.addEventListener("input", validateSave);
  dateInput.addEventListener("input", validateSave);
  timeInput.addEventListener("input", validateSave);

  saveTaskBtn.addEventListener("click", () => {
    if (saveTaskBtn.disabled) return;

    const newTask = {
      id: crypto.randomUUID(),
      title: taskInput.value.trim(),
      deadlineDate: dateInput.value, // YYYY-MM-DD
      deadlineTime: timeInput.value, // HH:MM (24h)
      urgency: selectedUrgency,
      done: false,
    };

    tasks.push(newTask);
    saveTasks();
    closeAddOverlay();
    renderOneWin();
    renderRolodex();
  });

  // Brain dump controls
  showTasksToggle.addEventListener("change", () => {
    renderRolodex();
  });

  prevTaskBtn.addEventListener("click", () => {
    rolodexIndexValue--;
    renderRolodex();
  });

  nextTaskBtn.addEventListener("click", () => {
    rolodexIndexValue++;
    renderRolodex();
  });

  deleteTaskBtn.addEventListener("click", () => {
    if (tasks.length === 0) return;
    tasks.splice(rolodexIndexValue, 1);
    saveTasks();
    if (rolodexIndexValue >= tasks.length) {
      rolodexIndexValue = tasks.length - 1;
    }
    if (rolodexIndexValue < 0) rolodexIndexValue = 0;
    renderOneWin();
    renderRolodex();
  });

  // Settings: reminder
  reminderButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.mins;
      if (val === "off") {
        reminderMinutes = null;
        localStorage.setItem("reminderMinutes", "off");
      } else {
        reminderMinutes = Number(val);
        localStorage.setItem("reminderMinutes", String(reminderMinutes));
      }
      updateReminderLabel();
      startReminderLoop();
    });
  });

  // Settings: priority
  priorityButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      priorityMode = btn.dataset.mode;
      localStorage.setItem("priorityMode", priorityMode);
      updatePriorityLabel();
      renderOneWin();
    });
  });

// TIME PICKER LOGIC
const timePickerOverlay = document.getElementById("timePickerOverlay");
const hourColumn = document.getElementById("hourColumn");
const minuteColumn = document.getElementById("minuteColumn");
const cancelTimeBtn = document.getElementById("cancelTimeBtn");
const doneTimeBtn = document.getElementById("doneTimeBtn");

let selectedHour = null;
let selectedMinute = null;

function openTimePicker() {
  timePickerOverlay.classList.remove("hidden");
  buildTimeColumns();
}

function closeTimePicker() {
  timePickerOverlay.classList.add("hidden");
}

function buildTimeColumns() {
  hourColumn.innerHTML = "";
  minuteColumn.innerHTML = "";

  // Hours 00–23
  for (let h = 0; h < 24; h++) {
    const div = document.createElement("div");
    div.className = "time-option";
    div.textContent = h.toString().padStart(2, "0");
    div.dataset.value = h;
    hourColumn.appendChild(div);
  }

  // Minutes 00–59
  for (let m = 0; m < 60; m++) {
    const div = document.createElement("div");
    div.className = "time-option";
    div.textContent = m.toString().padStart(2, "0");
    div.dataset.value = m;
    minuteColumn.appendChild(div);
  }
}

// Select hour
hourColumn.addEventListener("click", e => {
  const opt = e.target.closest(".time-option");
  if (!opt) return;

  selectedHour = opt.dataset.value;

  [...hourColumn.children].forEach(el =>
    el.classList.toggle("selected", el === opt)
  );
});

// Select minute
minuteColumn.addEventListener("click", e => {
  const opt = e.target.closest(".time-option");
  if (!opt) return;

  selectedMinute = opt.dataset.value;

  [...minuteColumn.children].forEach(el =>
    el.classList.toggle("selected", el === opt)
  );
});

// Cancel
cancelTimeBtn.addEventListener("click", closeTimePicker);

// Done
doneTimeBtn.addEventListener("click", () => {
  if (selectedHour !== null && selectedMinute !== null) {
    timeInput.value =
      selectedHour.toString().padStart(2, "0") +
      ":" +
      selectedMinute.toString().padStart(2, "0");

    validateSave();
  }
  closeTimePicker();
});

// Open picker when clicking the time input
timeInput.addEventListener("click", openTimePicker);

  // User ID
  userIdText.textContent = `User ID: ${userId}`;

  // Initial state
  updateReminderLabel();
  updatePriorityLabel();
  renderOneWin();
  renderRolodex();
  startReminderLoop();
});