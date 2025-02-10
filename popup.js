document.addEventListener("DOMContentLoaded", () => {
  const todoInput = document.getElementById("new-todo");
  const deadlineInput = document.getElementById("todo-deadline");
  const todoList = document.getElementById("todo-list");
  const historyList = document.getElementById("history-list");
  const addButton = document.querySelector(".add-btn");
  const viewButtons = document.querySelectorAll(".view-btn");
  const views = document.querySelectorAll(".view");
  const sortFilter = document.getElementById("sort-filter");
  const historyDateFilter = document.getElementById("history-date-filter");
  const historyTypeFilter = document.getElementById("history-type-filter");
  const completedList = document.getElementById("completed-list");
  const completedSortFilter = document.getElementById("completed-sort-filter");
  const deadlineToggleBtn = document.querySelector(".deadline-toggle-btn");

  deadlineToggleBtn.addEventListener("click", function() {
    this.style.display = 'none';
    deadlineInput.classList.remove("hidden");
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const nowString = now.toISOString().slice(0, 16);
    deadlineInput.min = nowString;
    deadlineInput.value = nowString;
    deadlineInput.focus();
  });

  function initializeViews() {
    viewButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetView = btn.dataset.view;
        viewButtons.forEach((b) => b.classList.remove("active"));
        views.forEach((v) => v.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`${targetView}-view`).classList.add("active");
      });
    });
  }

  function updateEmptyState(view) {
    const list =
      view === "tasks"
        ? todoList
        : view === "completed"
        ? completedList
        : historyList;
    const emptyState = list.parentElement.querySelector(".empty-state");
    if (list.children.length === 0) {
      emptyState.style.display = "block";
    } else {
      emptyState.style.display = "none";
    }
  }

  function getDueStatusClass(deadline) {
    if (!deadline) return "";

    const now = new Date();
    const dueDate = new Date(deadline);
    const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);

    if (hoursUntilDue < 0) return "overdue";
    if (hoursUntilDue <= 2) return "due-now";
    if (hoursUntilDue <= 5) return "due-very-soon";
    if (hoursUntilDue <= 8) return "due-soon-3";
    if (hoursUntilDue <= 48) return "due-soon-2";
    if (hoursUntilDue <= 72) return "due-soon-1";
    return "";
  }

  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) {
      return `Today at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } else if (isTomorrow) {
      return `Tomorrow at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } else {
      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  async function addNewTodo() {
    const text = todoInput.value.trim();
    const deadline = deadlineInput.classList.contains("hidden") ? null : deadlineInput.value;

    if (text) {
      const newTodo = {
        id: Date.now(),
        text: text,
        completed: false,
        dateAdded: new Date().toISOString(),
        deadline: deadline || null,
        completedDate: null,
      };

      const result = await chrome.storage.local.get(["todos", "history"]);
      const todos = result.todos || [];
      const history = result.history || [];

      todos.push(newTodo);
      history.push({
        type: "added",
        todoId: newTodo.id,
        text: newTodo.text,
        date: new Date().toISOString(),
      });
      await chrome.storage.local.set({ todos, history: limitHistory(history) });

      todoInput.value = "";
      const newNow = new Date();
      newNow.setMinutes(newNow.getMinutes() - newNow.getTimezoneOffset());
      deadlineInput.value = newNow.toISOString().slice(0, 16);

      deadlineInput.classList.add("hidden");
      deadlineToggleBtn.style.display = '';

      await loadTodos();
      renderHistory(history);
    }
  }

  function filterAndSortTodos(todos, view = "tasks") {
    let filtered = todos.filter((todo) => {
      if (view === "completed") return todo.completed;
      if (view === "tasks") return !todo.completed;
      return true;
    });

    const sort =
      view === "completed" ? completedSortFilter.value : sortFilter.value;
    const now = new Date();

    filtered.sort((a, b) => {
      switch (sort) {
        case "completed-date":
          return (
            new Date(b.completedDate || 0) - new Date(a.completedDate || 0)
          );
        case "deadline":
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline) - new Date(b.deadline);
        case "added":
          return new Date(b.dateAdded) - new Date(a.dateAdded);
        case "name":
          return a.text.localeCompare(b.text);
        default:
          return 0;
      }
    });

    return filtered;
  }

  function filterHistory(history) {
    const switchedHistory = [...history].reverse();
    const type = historyTypeFilter.value;
    const date = historyDateFilter.value;

    return switchedHistory.filter((item) => {
      const matchesType = type === "all" || item.type === type;
      const matchesDate =
        !date ||
        new Date(item.date).toDateString() === new Date(date).toDateString();
      return matchesType && matchesDate;
    });
  }

  function renderTodos(todos, view = "tasks") {
    const filtered = filterAndSortTodos(todos, view);
    const targetList = view === "completed" ? completedList : todoList;

    if (!targetList) return;

    targetList.innerHTML = "";

    filtered.forEach((todo) => {
      const div = document.createElement("div");
      const statusClass = !todo.completed
        ? getDueStatusClass(todo.deadline)
        : "";
      div.className = `todo-item ${
        todo.completed ? "completed" : ""
      } ${statusClass}`;

      div.innerHTML = `
        <div class="checkbox-wrapper">
          <input type="checkbox" class="custom-checkbox" ${
            todo.completed ? "checked" : ""
          }>
        </div>
        <div class="todo-content">
          <div class="todo-text">${todo.text}</div>
          <div class="todo-meta">
            <span class="date-added">Added ${formatDate(todo.dateAdded)}</span>
            ${
              todo.deadline
                ? `<span class="deadline">Due ${formatDate(
                    todo.deadline
                  )}</span>`
                : ""
            }
            ${
              todo.completedDate
                ? `<span class="completed-date">Completed ${formatDate(
                    todo.completedDate
                  )}</span>`
                : ""
            }
          </div>
        </div>
        <button class="delete-btn">
          <i class="fas fa-trash-alt"></i>
        </button>
      `;

      const checkbox = div.querySelector(".custom-checkbox");
      checkbox.addEventListener("change", async () => {
        completeTask(todo, checkbox, div);
      });
      div.querySelector(".todo-content").addEventListener("click", () => {
        checkbox.checked = !checkbox.checked;
        completeTask(todo, checkbox, div);
      });

      const deleteBtn = div.querySelector(".delete-btn");
      deleteBtn.addEventListener("click", async () => {
        div.classList.add("fade-out");

        setTimeout(async () => {
          const result = await chrome.storage.local.get(["todos", "history"]);
          const updatedTodos = result.todos || [];
          const history = result.history || [];

          const filteredTodos = updatedTodos.filter((t) => t.id !== todo.id);
          history.push({
            type: "deleted",
            todoId: todo.id,
            text: todo.text,
            date: new Date().toISOString(),
          });

          await chrome.storage.local.set({
            todos: filteredTodos,
            history: limitHistory(history),
          });
          renderTodos(filteredTodos, "tasks");
          renderTodos(filteredTodos, "completed");
          renderHistory(history);
        }, 300);
      });

      targetList.appendChild(div);
    });

    updateEmptyState(view);
  }

  async function completeTask(todo, checkbox, div) {
    todo.completed = checkbox.checked;
    todo.completedDate = todo.completed ? new Date().toISOString() : null;

    const result = await chrome.storage.local.get(["todos", "history"]);
    const updatedTodos = result.todos || [];
    const history = result.history || [];

    const index = updatedTodos.findIndex((t) => t.id === todo.id);
    if (index !== -1) {
      updatedTodos[index] = todo;

      history.push({
        type: todo.completed ? "completed" : "uncompleted",
        todoId: todo.id,
        text: todo.text,
        date: new Date().toISOString(),
      });

      await chrome.storage.local.set({
        todos: updatedTodos,
        history: limitHistory(history),
      });

      div.classList.add("fade-out");
      setTimeout(() => {
        renderTodos(updatedTodos, "tasks");
        renderTodos(updatedTodos, "completed");
        renderHistory(history);
      }, 300);
    }
  }

  function renderHistory(history) {
    const filtered = filterHistory(history);
    historyList.innerHTML = "";

    filtered.forEach((item) => {
      const div = document.createElement("div");
      div.className = "history-item";

      const actionText = {
        added: "Added task",
        completed: "Completed task",
        uncompleted: "Uncompleted task",
        deleted: "Deleted task",
      };

      div.innerHTML = `
        <div class="history-icon ${item.type}">
          <i class="fas fa-${
            item.type === "added"
              ? "plus"
              : item.type === "completed"
              ? "check"
              : item.type === "uncompleted"
              ? "undo text-black"
              : "trash-alt"
          }" style="color: ${item.type === "uncompleted" ? "black" : "auto"}"></i>
        </div>
        <div class="history-content">
          <div class="history-text">${actionText[item.type]}: ${item.text}</div>
          <div class="history-date">${formatDate(item.date)}</div>
        </div>
      `;

      historyList.appendChild(div);
    });

    updateEmptyState("history");
  }

  async function loadTodos() {
    const result = await chrome.storage.local.get(["todos"]);
    const todos = result.todos || [];
    renderTodos(todos, "tasks");
    renderTodos(todos, "completed");
  }

  function limitHistory(history) {
    return history.slice(-30); // Keep only the most recent 30 items
  }

  async function loadHistory() {
    const result = await chrome.storage.local.get(["history"]);
    const history = result.history || [];
    renderHistory(history);
  }

  // Initialize event listeners
  addButton.addEventListener("click", addNewTodo);

  todoInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addNewTodo();
    }
  });

  sortFilter.addEventListener("change", loadTodos);
  completedSortFilter.addEventListener("change", loadTodos);
  historyDateFilter.addEventListener("change", loadHistory);
  historyTypeFilter.addEventListener("change", loadHistory);

  // Initialize
  initializeViews();
  loadTodos();
  loadHistory();
});
