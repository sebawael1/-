
async function loadProjects() {
  const container = document.getElementById("projects-container");
  const searchInput = document.getElementById("project-search");
  const filterSelect = document.getElementById("project-filter");

  if (!container || !searchInput || !filterSelect) return;

  const STORAGE_KEY = "madinatukum-added-projects";
  let projects = [];

  // قراءة البطاقات المحفوظة
  function getSavedProjects() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  // حفظ البطاقات المضافة
  function saveProjects() {
    const customProjects = projects.filter(project => project.isCustom);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customProjects));
  }

  // تحميل المشاريع الأصلية والمضافة
  try {
    const response = await fetch("/data/projects.json");

    if (!response.ok) {
      throw new Error("Failed to load projects");
    }

    const originalProjects = await response.json();

    projects = [
      ...originalProjects,
      ...getSavedProjects()
    ];
  } catch (error) {
    console.error("Projects loading error:", error);
    projects = getSavedProjects();
  }

  // إنشاء زر إضافة بطاقة بجانب قائمة المجالات
  const filterWrapper = document.createElement("div");
  filterWrapper.className = "flex gap-3 w-full min-w-0";

  filterSelect.parentNode.insertBefore(filterWrapper, filterSelect);
  filterWrapper.appendChild(filterSelect);

  filterSelect.classList.add("flex-1", "min-w-0");

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.textContent = "+ إضافة بطاقة";
  addButton.className =
    "shrink-0 bg-[#28664F] hover:bg-[#205340] text-white font-bold text-sm px-4 sm:px-5 py-3.5 rounded-xl transition shadow-sm whitespace-nowrap";

  filterWrapper.appendChild(addButton);

  // إنشاء نافذة عامة
  function createModal(content) {
    const modal = document.createElement("div");

    modal.className =
      "fixed inset-0 bg-black/50 hidden items-center justify-center z-50 p-4";

    modal.innerHTML = content;
    document.body.appendChild(modal);

    function close() {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      modal.remove();
    }

    modal.querySelector("[data-close]")?.addEventListener("click", close);

    modal.addEventListener("click", event => {
      if (event.target === modal) close();
    });

    return { modal, close };
  }

  // نافذة إضافة أو تعديل بطاقة
  function openProjectForm(project = null) {
    const isEditing = Boolean(project);

    const { modal, close } = createModal(`
      <div class="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl">

        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-extrabold text-[#28664F]">
            ${isEditing ? "تعديل بطاقة المشروع" : "إضافة بطاقة مشروع"}
          </h2>

          <button
            type="button"
            data-close
            class="text-2xl text-slate-400 hover:text-red-500"
            aria-label="إغلاق"
          >&times;</button>
        </div>

        <form id="project-form" class="space-y-5">

          <div>
            <label class="block text-sm font-bold text-slate-700 mb-2">
              اسم المشروع
            </label>

            <input
              id="new-project-name"
              type="text"
              required
              maxlength="100"
              placeholder="أدخل اسم المشروع"
              class="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#28664F]"
            />
          </div>

          <div>
            <label class="block text-sm font-bold text-slate-700 mb-2">
              اسم الخبير
            </label>

            <input
              id="new-project-expert"
              type="text"
              required
              maxlength="100"
              placeholder="أدخل اسم الخبير"
              class="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#28664F]"
            />
          </div>

          <div>
            <label class="block text-sm font-bold text-slate-700 mb-2">
              تكلفة المشروع
            </label>

            <input
              id="new-project-cost"
              type="text"
              required
              maxlength="50"
              placeholder="مثال: 500 ريال"
              class="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#28664F]"
            />
          </div>

          <div class="flex gap-3 pt-2">

            <button
              type="submit"
              class="flex-1 bg-[#28664F] hover:bg-[#205340] text-white font-bold rounded-xl py-3 transition"
            >
              ${isEditing ? "حفظ التعديلات" : "حفظ البطاقة"}
            </button>

            <button
              type="button"
              id="cancel-project"
              class="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition"
            >
              إلغاء
            </button>

          </div>
        </form>
      </div>
    `);

    const nameInput = modal.querySelector("#new-project-name");
    const expertInput = modal.querySelector("#new-project-expert");
    const costInput = modal.querySelector("#new-project-cost");

    if (isEditing) {
      nameInput.value = project.name || "";
      expertInput.value = project.expert || "";
      costInput.value = project.cost || "";
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    modal.querySelector("#cancel-project").addEventListener("click", close);

    modal.querySelector("#project-form").addEventListener("submit", event => {
      event.preventDefault();

      const name = nameInput.value.trim();
      const expert = expertInput.value.trim();
      const cost = costInput.value.trim();

      if (!name || !expert || !cost) return;

      if (isEditing) {
        const oldValues = {
          name: project.name,
          expert: project.expert,
          cost: project.cost
        };

        project.name = name;
        project.expert = expert;
        project.cost = cost;

        try {
          saveProjects();
        } catch (error) {
          Object.assign(project, oldValues);
          console.error(error);
          alert("تعذر حفظ التعديلات.");
          return;
        }

      } else {
        const newProject = {
          id: Date.now(),
          name,
          expert,
          cost,
          description: "مشروع تمت إضافته إلى مدينتكم.",
          field: "مشاريع مضافة",
          technologies: [],
          isCustom: true
        };

        projects.push(newProject);

        try {
          saveProjects();
        } catch (error) {
          projects.pop();
          console.error(error);
          alert("تعذر حفظ البطاقة.");
          return;
        }
      }

      updateFilterOptions();
      displayProjects();
      close();
    });
  }

  // زر إضافة بطاقة
  addButton.addEventListener("click", () => {
    openProjectForm();
  });

  // تحديث قائمة المجالات
  function updateFilterOptions() {
    const selectedValue = filterSelect.value;

    const fields = [
      ...new Set(
        projects
          .map(project => project.field)
          .filter(Boolean)
      )
    ];

    filterSelect.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "جميع المجالات";
    filterSelect.appendChild(allOption);

    fields.forEach(field => {
      const option = document.createElement("option");
      option.value = field;
      option.textContent = field;
      filterSelect.appendChild(option);
    });

    filterSelect.value = fields.includes(selectedValue)
      ? selectedValue
      : "all";
  }

  // عرض تفاصيل المشروع
  function showProjectDetails(project) {
    const { modal } = createModal(`
      <div class="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-xl">

        <div class="flex justify-between items-center mb-5">
          <h2
            id="modal-title"
            class="text-xl font-extrabold text-[#28664F]"
          ></h2>

          <button
            type="button"
            data-close
            class="text-2xl text-gray-500 hover:text-red-500"
            aria-label="إغلاق"
          >&times;</button>
        </div>

        <p id="modal-description" class="text-gray-600 mb-5"></p>

        <div class="space-y-4">

          <div>
            <p class="text-sm font-bold text-gray-500 mb-1">
              المجال التقني
            </p>
            <p id="modal-field" class="text-[#28664F]"></p>
          </div>

          <div id="expert-section">
            <p class="text-sm font-bold text-gray-500 mb-1">
              اسم الخبير
            </p>
            <p id="modal-expert" class="text-slate-700"></p>
          </div>

          <div id="cost-section">
            <p class="text-sm font-bold text-gray-500 mb-1">
              تكلفة المشروع
            </p>
            <p id="modal-cost" class="text-[#28664F] font-bold"></p>
          </div>

          <div id="technologies-section">
            <p class="text-sm font-bold text-gray-500 mb-1">
              التقنيات المستخدمة
            </p>
            <p id="modal-technologies" class="text-gray-600"></p>
          </div>

        </div>
      </div>
    `);

    function setText(selector, value) {
      const element = modal.querySelector(selector);
      if (element) element.textContent = value || "غير محدد";
    }

    setText("#modal-title", project.name);
    setText("#modal-description", project.description);
    setText("#modal-field", project.field);
    setText("#modal-expert", project.expert);
    setText("#modal-cost", project.cost);

    setText(
      "#modal-technologies",
      Array.isArray(project.technologies)
        ? project.technologies.join("، ")
        : ""
    );

    if (!project.expert) {
      modal.querySelector("#expert-section").classList.add("hidden");
    }

    if (!project.cost) {
      modal.querySelector("#cost-section").classList.add("hidden");
    }

    if (!project.technologies?.length) {
      modal.querySelector("#technologies-section").classList.add("hidden");
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  // عرض البطاقات
  function displayProjects() {
    const search = searchInput.value.trim().toLowerCase();
    const selectedField = filterSelect.value;

    const filteredProjects = projects.filter(project => {
      const matchesSearch =
        (project.name || "").toLowerCase().includes(search) ||
        (project.expert || "").toLowerCase().includes(search);

      const matchesField =
        selectedField === "all" || project.field === selectedField;

      return matchesSearch && matchesField;
    });

    container.replaceChildren();

    if (filteredProjects.length === 0) {
      const emptyMessage = document.createElement("p");

      emptyMessage.className =
        "text-sm text-slate-500 text-center py-10 col-span-full";

      emptyMessage.textContent = "لا توجد مشاريع مطابقة.";
      container.appendChild(emptyMessage);
      return;
    }

    filteredProjects.forEach(project => {
      const card = document.createElement("article");

      card.className =
        "border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-[#28664F]/30 transition cursor-pointer bg-white";

      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      const title = document.createElement("h3");
      title.className =
        "font-extrabold text-[#28664F] text-lg mb-3";
      title.textContent = project.name;

      const description = document.createElement("p");
      description.className = "text-sm text-slate-600 mb-4";
      description.textContent =
        project.description || "مشروع تقني ضمن منصة مدينتكم.";

      const field = document.createElement("span");
      field.className =
        "inline-block text-xs font-bold text-[#28664F] bg-[#EAF3EF] rounded-full px-3 py-1.5 mb-4";
      field.textContent = project.field || "مشروع تقني";

      card.append(title, description, field);

      if (project.expert) {
        const expert = document.createElement("p");
        expert.className = "text-sm text-slate-600 mb-2";
        expert.textContent = "الخبير: " + project.expert;
        card.appendChild(expert);
      }

      if (project.cost) {
        const cost = document.createElement("p");
        cost.className = "text-sm font-bold text-slate-700 mb-2";
        cost.textContent = "التكلفة: " + project.cost;
        card.appendChild(cost);
      }

      if (project.technologies?.length) {
        const technologies = document.createElement("p");
        technologies.className = "text-xs text-slate-500 mt-2";
        technologies.textContent =
          "التقنيات: " + project.technologies.join("، ");
        card.appendChild(technologies);
      }

      const detailsHint = document.createElement("p");
      detailsHint.className =
        "text-xs text-[#28664F] font-bold mt-5";
      detailsHint.textContent = "اضغط لعرض التفاصيل ←";
      card.appendChild(detailsHint);

      // أزرار تعديل وحذف البطاقات المضافة فقط
      if (project.isCustom) {
        const actions = document.createElement("div");

        actions.className =
          "flex gap-2 mt-5 pt-4 border-t border-slate-100";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "تعديل";

        editButton.className =
          "flex-1 rounded-lg bg-[#EAF3EF] text-[#28664F] hover:bg-[#dcece4] py-2.5 text-sm font-bold transition";

        editButton.addEventListener("click", event => {
          event.stopPropagation();
          openProjectForm(project);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "حذف";

        deleteButton.className =
          "flex-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 py-2.5 text-sm font-bold transition";

        deleteButton.addEventListener("click", event => {
          event.stopPropagation();

          const confirmed = confirm(
            `هل أنت متأكد من حذف مشروع "${project.name}"؟`
          );

          if (!confirmed) return;

          const index = projects.indexOf(project);

          if (index === -1) return;

          const removedProject = projects.splice(index, 1)[0];

          try {
            saveProjects();
            updateFilterOptions();
            displayProjects();
          } catch (error) {
            projects.splice(index, 0, removedProject);
            console.error(error);
            alert("تعذر حذف البطاقة.");
          }
        });

        actions.append(editButton, deleteButton);
        card.appendChild(actions);
      }

      card.addEventListener("click", () => {
        showProjectDetails(project);
      });

      card.addEventListener("keydown", event => {
        if (
          event.target === card &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          showProjectDetails(project);
        }
      });

      container.appendChild(card);
    });
  }

  // البحث والفلترة
  searchInput.addEventListener("input", displayProjects);
  filterSelect.addEventListener("change", displayProjects);

  updateFilterOptions();
  displayProjects();
}

loadProjects();
