const STORAGE_KEY = "cleansched.jobs";
const NOTIFY_KEY = "cleansched.notifications";
const installButton = document.querySelector("#toggle-install");
const installHint = document.querySelector("#install-hint");
const jobForm = document.querySelector("#job-form");
const jobList = document.querySelector("#job-list");
const statusFilter = document.querySelector("#status-filter");
const searchInput = document.querySelector("#search-input");
const notificationList = document.querySelector("#notification-list");
const addFieldButton = document.querySelector("#add-field");
const fieldList = document.querySelector("#field-list");
const clearButton = document.querySelector("#clear-data");
const statTotal = document.querySelector("#stat-total");
const statToday = document.querySelector("#stat-today");
const statProgress = document.querySelector("#stat-progress");
const statCompleted = document.querySelector("#stat-completed");
const nextJobBadge = document.querySelector("#next-job");
const upcomingList = document.querySelector("#upcoming-list");

let deferredPrompt;

const statusLabels = {
  scheduled: "Scheduled",
  "in-progress": "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const defaultNotifications = [
  "Welcome! Create your first job to notify the team.",
];

const loadJobs = () => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
};

const saveJobs = (jobs) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
};

const loadNotifications = () => {
  const raw = window.localStorage.getItem(NOTIFY_KEY);
  if (raw) {
    return JSON.parse(raw);
  }
  window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(defaultNotifications));
  return [...defaultNotifications];
};

const saveNotifications = (notifications) => {
  window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(notifications));
};

const formatDateTime = (date, time) => {
  if (!date || !time) return "";
  const formatted = new Date(`${date}T${time}`);
  return formatted.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getDateKey = (date) => {
  if (!date) return "";
  const normalized = new Date(date);
  if (Number.isNaN(normalized.getTime())) return "";
  return normalized.toISOString().split("T")[0];
};

const formatTime = (date, time) => {
  if (!date || !time) return "";
  const formatted = new Date(`${date}T${time}`);
  return formatted.toLocaleTimeString(undefined, { timeStyle: "short" });
};

const renderOverview = () => {
  if (!statTotal || !statToday || !statProgress || !statCompleted) return;
  const jobs = loadJobs();
  const todayKey = getDateKey(new Date());
  const upcoming = jobs
    .filter((job) => job.status !== "cancelled" && job.status !== "completed")
    .sort((a, b) => {
      const aTime = new Date(`${a.date}T${a.time}`).getTime();
      const bTime = new Date(`${b.date}T${b.time}`).getTime();
      return aTime - bTime;
    });

  statTotal.textContent = jobs.length;
  statToday.textContent = jobs.filter((job) => getDateKey(job.date) === todayKey).length;
  statProgress.textContent = jobs.filter((job) => job.status === "in-progress").length;
  statCompleted.textContent = jobs.filter((job) => job.status === "completed").length;

  if (nextJobBadge && upcoming.length) {
    nextJobBadge.textContent = `Next: ${formatDateTime(upcoming[0].date, upcoming[0].time)}`;
  } else if (nextJobBadge) {
    nextJobBadge.textContent = "No upcoming jobs";
  }

  if (!upcomingList) return;
  upcomingList.innerHTML = "";
  const limited = upcoming.slice(0, 4);
  if (!limited.length) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "No upcoming jobs. Add a new booking to populate the queue.";
    upcomingList.appendChild(empty);
    return;
  }

  limited.forEach((job) => {
    const item = document.createElement("li");
    item.className = "snapshot-item";
    item.innerHTML = `
      <span class="snapshot-time">${formatTime(job.date, job.time)}</span>
      <div class="snapshot-details">
        <strong>${job.client}</strong>
        <span class="muted">${job.address}</span>
      </div>
    `;
    upcomingList.appendChild(item);
  });
};

const renderNotifications = () => {
  const notifications = loadNotifications();
  notificationList.innerHTML = "";
  notifications.slice(-6).reverse().forEach((message) => {
    const item = document.createElement("div");
    item.className = "notification";
    item.textContent = message;
    notificationList.appendChild(item);
  });
};

const addNotification = (message) => {
  const notifications = loadNotifications();
  notifications.push(message);
  saveNotifications(notifications);
  renderNotifications();
};

const createBadge = (status) => {
  const badge = document.createElement("span");
  badge.className = `badge ${status}`;
  badge.textContent = statusLabels[status] ?? "Scheduled";
  return badge;
};

const renderJobs = () => {
  const jobs = loadJobs();
  const filter = statusFilter.value;
  const query = searchInput.value.trim().toLowerCase();
  jobList.innerHTML = "";

  const filtered = jobs.filter((job) => {
    const matchesStatus = filter === "all" || job.status === filter;
    const matchesQuery =
      !query ||
      job.client.toLowerCase().includes(query) ||
      job.address.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No jobs match your filters yet.";
    jobList.appendChild(empty);
    renderOverview();
    return;
  }

  filtered.forEach((job) => {
    const card = document.createElement("div");
    card.className = "job-card";

    const header = document.createElement("div");
    header.className = "job-card__header";

    const title = document.createElement("div");
    title.innerHTML = `
      <strong>${job.client}</strong>
      <div class="muted">${job.address}</div>
    `;

    header.appendChild(title);
    header.appendChild(createBadge(job.status));

    const meta = document.createElement("div");
    meta.className = "job-meta";
    meta.innerHTML = `
      <span>${formatDateTime(job.date, job.time)}</span>
      <span>${job.duration} hours</span>
      <span>Assigned: ${job.assignee}</span>
      <span>Priority: ${job.priority}</span>
    `;

    const customFields = job.customFields
      .map((field) => `${field.label}: ${field.value}`)
      .join(" · ");

    const notes = document.createElement("div");
    notes.className = "muted";
    notes.textContent = job.notes || "No notes yet.";

    const custom = document.createElement("div");
    custom.className = "muted";
    custom.textContent = customFields || "No custom fields.";

    const actions = document.createElement("div");
    actions.className = "job-actions";

    const statusSelect = document.createElement("select");
    ["scheduled", "in-progress", "completed", "cancelled"].forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = statusLabels[status];
      if (job.status === status) {
        option.selected = true;
      }
      statusSelect.appendChild(option);
    });

    statusSelect.addEventListener("change", () => {
      job.status = statusSelect.value;
      saveJobs(jobs);
      renderJobs();
      addNotification(`Job for ${job.client} updated to ${statusLabels[job.status]}.`);
    });

    const emailButton = document.createElement("a");
    emailButton.className = "secondary";
    emailButton.href = `mailto:${job.email}?subject=Cleaning%20job%20update&body=Hi%20${encodeURIComponent(
      job.client
    )},%0A%0AYour%20cleaning%20job%20is%20currently%20${encodeURIComponent(
      statusLabels[job.status]
    )}.%0A%0AThanks!`;
    emailButton.textContent = "Email update";

    const deleteButton = document.createElement("button");
    deleteButton.className = "secondary";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      const nextJobs = jobs.filter((item) => item.id !== job.id);
      saveJobs(nextJobs);
      renderJobs();
      addNotification(`Job for ${job.client} was deleted.`);
    });

    actions.append(statusSelect, emailButton, deleteButton);
    card.append(header, meta, notes, custom, actions);
    jobList.appendChild(card);
  });
  renderOverview();
};

const collectCustomFields = () => {
  const fields = Array.from(fieldList.querySelectorAll(".field-row"));
  return fields
    .map((row) => {
      const label = row.querySelector("input[name='field-label']").value.trim();
      const value = row.querySelector("input[name='field-value']").value.trim();
      return { label, value };
    })
    .filter((field) => field.label && field.value);
};

const addFieldRow = () => {
  const row = document.createElement("div");
  row.className = "field-row";
  row.innerHTML = `
    <input name="field-label" type="text" placeholder="Field name" />
    <input name="field-value" type="text" placeholder="Field value" />
    <button type="button" class="secondary">Remove</button>
  `;
  row.querySelector("button").addEventListener("click", () => {
    row.remove();
  });
  fieldList.appendChild(row);
};

jobForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(jobForm);
  const job = {
    id: crypto.randomUUID(),
    client: data.get("client"),
    email: data.get("email"),
    address: data.get("address"),
    date: data.get("date"),
    time: data.get("time"),
    duration: data.get("duration"),
    assignee: data.get("assignee"),
    priority: data.get("priority"),
    notes: data.get("notes"),
    customFields: collectCustomFields(),
    status: "scheduled",
  };

  const jobs = loadJobs();
  jobs.unshift(job);
  saveJobs(jobs);
  jobForm.reset();
  fieldList.innerHTML = "";
  renderJobs();
  addNotification(`New job created for ${job.client} on ${formatDateTime(job.date, job.time)}.`);
});

jobForm.addEventListener("reset", () => {
  fieldList.innerHTML = "";
});

statusFilter.addEventListener("change", renderJobs);
searchInput.addEventListener("input", renderJobs);
addFieldButton.addEventListener("click", addFieldRow);

clearButton.addEventListener("click", () => {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(NOTIFY_KEY);
  renderJobs();
  renderNotifications();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installButton.disabled = false;
  installHint.textContent = "Install available";
});

installButton.addEventListener("click", async () => {
  if (!deferredPrompt) {
    installHint.textContent = "Install prompt not available yet";
    return;
  }
  deferredPrompt.prompt();
  const result = await deferredPrompt.userChoice;
  installHint.textContent =
    result.outcome === "accepted" ? "App installed" : "Install dismissed";
  deferredPrompt = null;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}

renderJobs();
renderNotifications();
renderOverview();
addFieldRow();
