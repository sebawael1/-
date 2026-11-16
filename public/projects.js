
async function loadProjects() {
  const container = document.getElementById("projects-container");
  const searchInput = document.getElementById("project-search");
  const filterSelect = document.getElementById("project-filter");

  try {
    const response = await fetch("/data/projects.json");

    if (!response.ok) {
      throw new Error("Failed to load projects");
    }

    const projects = await response.json();

    // إنشاء خيارات المجالات
    const fields = [...new Set(projects.map(project => project.field))];

    fields.forEach(field => {
      const option = document.createElement("option");
      option.value = field;
      option.textContent = field;
      filterSelect.appendChild(option);
    });

    // إنشاء نافذة التفاصيل
    const modal = document.createElement("div");
    modal.className =
      "fixed inset-0 bg-black/50 hidden items-center justify-center z-50 p-4";

    modal.innerHTML = `
      <div class="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl">
        <div class="flex justify-between items-center mb-5">
          <h2 id="modal-title" class="text-xl font-extrabold text-[#28664F]"></h2>
          <button id="modal-close"
            class="text-2xl text-gray-500 hover:text-red-500"
            aria-label="إغلاق">&times;</button>
        </div>
        <p id="modal-description" class="text-gray-600 mb-4"></p>
        <p class="text-sm font-bold text-gray-500 mb-2">
          المجال التقني:
        </p>
        <p id="modal-field" class="mb-4 text-[#28664F]"></p>
        <p class="text-sm font-bold text-gray-500 mb-2">
          التقنيات المستخدمة:
        </p>
        <p id="modal-technologies" class="text-gray-600"></p>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    };

    modal.querySelector("#modal-close").addEventListener("click", closeModal);

    modal.addEventListener("click", event => {
      if (event.target === modal) {
        closeModal();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeModal();
      }
    });

    // عرض تفاصيل المشروع
    function showProjectDetails(project) {
      modal.querySelector("#modal-title").textContent = project.name;
      modal.querySelector("#modal-description").textContent =
        project.description;
      modal.querySelector("#modal-field").textContent = project.field;
      modal.querySelector("#modal-technologies").textContent =
        project.technologies.join("، ");

      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }

    // عرض المشاريع مع البحث والفلترة
    function displayProjects() {
      const search = searchInput.value.trim().toLowerCase();
      const selectedField = filterSelect.value;

      const filteredProjects = projects.filter(project => {
        const matchesName = project.name.toLowerCase().includes(search);
        const matchesField =
          selectedField === "all" || project.field === selectedField;

        return matchesName && matchesField;
      });

      container.replaceChildren();

      if (filteredProjects.length === 0) {
        container.textContent = "لا توجد مشاريع مطابقة.";
        return;
      }

      filteredProjects.forEach(project => {
        const card = document.createElement("article");

        card.className =
          "border border-slate-200 rounded-xl p-5 hover:shadow-md transition cursor-pointer";

        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");

        const title = document.createElement("h3");
        title.className = "font-extrabold text-[#28664F] text-lg mb-2";
        title.textContent = project.name;

        const description = document.createElement("p");
        description.className = "text-sm text-slate-600 mb-3";
        description.textContent = project.description;

        const field = document.createElement("p");
        field.className = "text-xs font-bold text-slate-500 mb-3";
        field.textContent = project.field;

        const technologies = document.createElement("p");
        technologies.className = "text-xs text-slate-500";
        technologies.textContent =
          "التقنيات: " + project.technologies.join("، ");

        const detailsHint = document.createElement("p");
        detailsHint.className = "text-xs text-[#28664F] font-bold mt-4";
        detailsHint.textContent = "اضغط لعرض التفاصيل ←";

        card.append(title, description, field, technologies, detailsHint);

        card.addEventListener("click", () => {
          showProjectDetails(project);
        });

        card.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            showProjectDetails(project);
          }
        });

        container.appendChild(card);
      });
    }

    searchInput.addEventListener("input", displayProjects);
    filterSelect.addEventListener("change", displayProjects);

    displayProjects();

  } catch (error) {
    console.error(error);
    container.textContent = "تعذر تحميل المشاريع.";
  }
}

loadProjects();
