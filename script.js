function updateDeviceClock() {
      const now = new Date();
      document.getElementById("deviceTime").textContent = now.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
      });
      document.getElementById("deviceDate").textContent = now.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }

    updateDeviceClock();
    setInterval(updateDeviceClock, 1000);

    let lessonsPerDay = 3;
    try {
      const savedLessonCount = localStorage.getItem("lessonsPerDay");
      const parsedLessonCount = Number(savedLessonCount);
      if (savedLessonCount !== null && Number.isInteger(parsedLessonCount) && parsedLessonCount >= 1 && parsedLessonCount <= 12) {
        lessonsPerDay = parsedLessonCount;
      }
    } catch (error) {}
    document.getElementById("lessonsPerDayInput").value = lessonsPerDay;
    document.getElementById("decreaseLessonsButton").disabled = lessonsPerDay <= 1;
    document.getElementById("increaseLessonsButton").disabled = lessonsPerDay >= 12;

    const defaultClassName = "My course";
    let classRosters = { [defaultClassName]: [] };
    let classUnits = { [defaultClassName]: [] };
    let activeClassName = defaultClassName;
    let students = classRosters[defaultClassName];

    function createLessons(...attendance) {
      return Array.from({ length: lessonsPerDay }, (_, index) => ({
        name: `Lesson ${index + 1}`,
        present: Boolean(attendance[index])
      }));
    }

    function updateLessonsPerDay(value) {
      const newCount = Number(value);
      const input = document.getElementById("lessonsPerDayInput");
      if (!Number.isInteger(newCount) || newCount < 1 || newCount > 12) {
        input.value = lessonsPerDay;
        return;
      }

      input.value = newCount;
      lessonsPerDay = newCount;
      students.forEach(student => {
        const previousLessons = student.lessons;
        student.lessons = Array.from({ length: lessonsPerDay }, (_, index) => ({
          name: `Lesson ${index + 1}`,
          present: previousLessons[index]?.present ?? false
        }));
        student.present = student.lessons.every(lesson => lesson.present);
        updateTodayHistory(student);
      });

      try {
        localStorage.setItem("lessonsPerDay", String(lessonsPerDay));
      } catch (error) {}
      document.getElementById("decreaseLessonsButton").disabled = lessonsPerDay <= 1;
      document.getElementById("increaseLessonsButton").disabled = lessonsPerDay >= 12;
      renderStudents();
    }

    function adjustLessonsPerDay(amount) {
      updateLessonsPerDay(lessonsPerDay + amount);
    }

    function formatLocalDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    const retiredDemoEmails = new Set(["teacher@edutrack.com", "amelia@edutrack.com"]);
    let accounts = { teacher: [], student: [] };
    try {
      const savedAccounts = JSON.parse(localStorage.getItem("edutrackAccounts"));
      if (savedAccounts && Array.isArray(savedAccounts.teacher) && Array.isArray(savedAccounts.student)) {
        accounts = savedAccounts;
      }
      const savedTeacherCount = accounts.teacher.length;
      const savedStudentCount = accounts.student.length;
      accounts.teacher = accounts.teacher.filter(account =>
        account && typeof account.email === "string"
        && !retiredDemoEmails.has(account.email.toLowerCase())
      );
      accounts.student = accounts.student.filter(account =>
        account && typeof account.email === "string"
        && !retiredDemoEmails.has(account.email.toLowerCase())
      );
      accounts.trainee = accounts.student;
      if (accounts.teacher.length !== savedTeacherCount || accounts.student.length !== savedStudentCount) {
        localStorage.setItem("edutrackAccounts", JSON.stringify(accounts));
      }
      localStorage.removeItem("edutrackClasses:teacher@edutrack.com");
    } catch (error) {}

    let currentRole = "";
    let currentAccount = null;
    let currentStudentRosterReference = null;
    let authMode = "login";
    let viewedStudentIndex = -1;
    let pendingAvatar = "";
    let magazineObjectUrls = [];
    let dashboardMagazineObjectUrls = [];
    let currentSystemMagazineIndex = 0;
    let systemMagazineTimer = null;
    let liveMagazineEntries = [];
    let liveMagazineLastFetch = 0;
    const liveMagazineRefreshInterval = 15 * 60 * 1000;
    const minimumImageShortSide = 1080;
    const minimumImageLongSide = 1920;
    const liveImageTopics = [
      { title: "Mountains", query: "mountains landscape filetype:bitmap" },
      { title: "Rivers and waterfalls", query: "river waterfall filetype:bitmap" },
      { title: "Cars", query: "sports car racing car filetype:bitmap" },
      { title: "Stadiums", query: "football stadium arena filetype:bitmap" },
      { title: "Sports", query: "sports athletics action filetype:bitmap" },
      { title: "Wildlife", query: "wildlife animal photography filetype:bitmap" },
      { title: "Coasts and beaches", query: "ocean coast beach filetype:bitmap" }
    ];
    let dashboardMagazines = [];
    const defaultWallpaper = "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2560&q=90";
    const defaultStudentAvatar = `data:image/svg+xml,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#d3dce8"/><circle cx="32" cy="24" r="12" fill="#718096"/><path d="M10 58c2-13 10-20 22-20s20 7 22 20" fill="#718096"/></svg>'
    )}`;
    const systemWallpapers = [
      defaultWallpaper
    ];

    try {
      const savedWallpaper = localStorage.getItem("dashboardWallpaper");
      setSystemWallpaper(systemWallpapers.includes(savedWallpaper) ? savedWallpaper : defaultWallpaper);
    } catch (error) {
      setSystemWallpaper(defaultWallpaper);
    }

    function openDashboard(role = "teacher", selectedAccount) {
      const normalizedRole = role === "trainee" ? "student" : role;
      const account = selectedAccount || (normalizedRole === "teacher" ? accounts.teacher : accounts.student).find(Boolean) || accounts.teacher[0] || accounts.student[0];
      if (!account) return;

      document.getElementById("loginPage").classList.add("hidden");
      document.getElementById("app").classList.remove("hidden");
      currentRole = normalizedRole;
      currentAccount = account;
      if (normalizedRole === "teacher") loadTeacherClasses(account);
      renderActiveClassName();
      const institutionDisplay = document.getElementById("activeInstitutionDisplay");
      const institutionName = typeof account.institutionName === "string" ? account.institutionName.trim() : "";
      institutionDisplay.textContent = institutionName ? `Institution: ${institutionName}` : "";
      institutionDisplay.classList.toggle("hidden", !institutionName);
      document.getElementById("loggedInUser").textContent = account.name;
      document.getElementById("studentWelcome").textContent = `Welcome, ${account.name}`;
      const studentCourse = document.getElementById("studentCourse");
      studentCourse.textContent = account.course ? `Course: ${account.course}` : "";
      studentCourse.classList.toggle("hidden", normalizedRole !== "student" || !account.course);
      const studentUnit = document.getElementById("studentUnit");
      studentUnit.textContent = account.unit ? `Unit: ${account.unit}` : "";
      studentUnit.classList.toggle("hidden", normalizedRole !== "student" || !account.unit);
      renderProfileAvatar();
      document.getElementById("teacherView").classList.toggle("hidden", normalizedRole !== "teacher");
      document.getElementById("studentView").classList.toggle("hidden", normalizedRole !== "student");
      document.getElementById("magazineSettingsLink").classList.toggle("hidden", normalizedRole !== "teacher");
      document.getElementById("classSettingsSection").classList.toggle("hidden", normalizedRole !== "teacher");
      renderStudents();
      if (normalizedRole === "teacher") {
        startSystemMagazineDisplay();
      } else {
        stopSystemMagazineDisplay();
      }
    }

    function getClassStorageKey(account) {
      return `edutrackClasses:${account.email.toLowerCase()}`;
    }

    function loadTeacherClasses(account) {
      classRosters = { [defaultClassName]: [] };
      classUnits = { [defaultClassName]: [] };
      activeClassName = defaultClassName;

      try {
        const savedData = JSON.parse(localStorage.getItem(getClassStorageKey(account)));
        if (savedData && savedData.classes && typeof savedData.classes === "object") {
          const savedRosters = Object.fromEntries(Object.entries(savedData.classes)
            .filter(([name, roster]) => name.trim() && Array.isArray(roster)));
          if (Object.keys(savedRosters).length) classRosters = savedRosters;
          classUnits = Object.fromEntries(Object.entries(savedData.units || {})
            .filter(([name, units]) => classRosters[name] && Array.isArray(units))
            .map(([name, units]) => [name, units.filter(unit => typeof unit === "string" && unit.trim())]));
          if (classRosters[savedData.activeClass]) activeClassName = savedData.activeClass;
        }
      } catch (error) {}

      Object.keys(classRosters).forEach(className => {
        if (!Array.isArray(classUnits[className])) classUnits[className] = [];
        classRosters[className].forEach(student => {
          const unit = typeof student?.unit === "string" ? student.unit.trim() : "";
          if (unit && !classUnits[className].some(existing => existing.toLowerCase() === unit.toLowerCase())) {
            classUnits[className].push(unit);
          }
        });
      });

      students = classRosters[activeClassName];
      document.getElementById("newStudentCourse").value = activeClassName;
      renderClassOptions();
      renderTeacherUnitOptions();
      renderLessonCoverage();
    }

    function renderActiveClassName() {
      const display = document.getElementById("activeClassDisplay");
      display.textContent = activeClassName;
      display.classList.toggle("hidden", currentRole !== "teacher");
    }

    function saveTeacherClasses() {
      if (currentRole !== "teacher" || !currentAccount) return true;
      try {
        localStorage.setItem(getClassStorageKey(currentAccount), JSON.stringify({
          activeClass: activeClassName,
          classes: classRosters,
          units: classUnits
        }));
        return true;
      } catch (error) {
        console.error("Could not save teacher course data.", error);
        const message = "Changes could not be saved in this browser. Check available storage and try again.";
        ["classSettingsResult", "studentRosterResult", "addStudentResult"].forEach(id => {
          const result = document.getElementById(id);
          if (!result) return;
          result.textContent = message;
          result.style.color = "#bb2222";
        });
        return false;
      }
    }

    function renderClassOptions() {
      const classSelect = document.getElementById("classSelect");
      if (!classSelect) return;
      classSelect.replaceChildren(...Object.keys(classRosters).map(className => new Option(className, className)));
      classSelect.value = activeClassName;
    }

    function renderTeacherUnitOptions(selectedUnit = "") {
      const unitSelect = document.getElementById("newStudentUnit");
      if (!unitSelect) return;
      const units = classUnits[activeClassName] || [];
      unitSelect.replaceChildren(
        new Option(units.length ? "Select a teacher-added unit" : "Add a unit in Course settings first", ""),
        ...units.map(unit => new Option(unit, unit))
      );
      if (units.includes(selectedUnit)) unitSelect.value = selectedUnit;
    }

    function switchClass(className) {
      if (currentRole !== "teacher" || !classRosters[className]) return;
      const previousClassName = activeClassName;
      const previousStudents = students;
      activeClassName = className;
      students = classRosters[activeClassName];
      renderActiveClassName();
      document.getElementById("newStudentCourse").value = activeClassName;
      renderTeacherUnitOptions();
      renderStudents(false);
      if (!saveTeacherClasses()) {
        activeClassName = previousClassName;
        students = previousStudents;
        renderActiveClassName();
        document.getElementById("newStudentCourse").value = activeClassName;
        renderTeacherUnitOptions();
        renderClassOptions();
        renderStudents(false);
        return;
      }
      document.getElementById("classSettingsResult").textContent = `Switched to ${activeClassName}. Changes saved.`;
      document.getElementById("classSettingsResult").style.color = "#14833b";
      renderLessonCoverage();
    }

    function addClassOrUnit() {
      if (currentRole !== "teacher") return;
      const classInput = document.getElementById("newClassName");
      const unitInput = document.getElementById("newUnitName");
      const result = document.getElementById("classSettingsResult");
      const className = classInput.value.trim();
      const unit = unitInput.value.trim();
      if (!className && !unit) {
        result.textContent = "Enter a course, a unit, or both.";
        result.style.color = "#bb2222";
        classInput.focus();
        return;
      }
      if (className && Object.keys(classRosters).some(name => name.toLowerCase() === className.toLowerCase())) {
        result.textContent = "That course already exists.";
        result.style.color = "#bb2222";
        return;
      }

      const targetClassName = className || activeClassName;
      const targetUnits = className ? [] : (classUnits[targetClassName] || []);
      if (unit && targetUnits.some(existing => existing.toLowerCase() === unit.toLowerCase())) {
        result.textContent = "That unit already exists in this course.";
        result.style.color = "#bb2222";
        return;
      }

      const previousRosters = { ...classRosters };
      const previousUnits = Object.fromEntries(Object.entries(classUnits)
        .map(([name, units]) => [name, [...units]]));
      const previousClassName = activeClassName;
      const previousStudents = students;

      if (className) {
        classRosters[className] = [];
        classUnits[className] = [];
        activeClassName = className;
        students = classRosters[className];
        renderActiveClassName();
        document.getElementById("newStudentCourse").value = className;
        renderClassOptions();
      }
      if (unit) classUnits[targetClassName].push(unit);

      classInput.value = "";
      unitInput.value = "";
      renderTeacherUnitOptions(unit);
      renderStudents(false);
      if (!saveTeacherClasses()) {
        classRosters = previousRosters;
        classUnits = previousUnits;
        activeClassName = previousClassName;
        students = previousStudents;
        classInput.value = className;
        unitInput.value = unit;
        document.getElementById("newStudentCourse").value = activeClassName;
        renderActiveClassName();
        renderClassOptions();
        renderTeacherUnitOptions();
        renderStudents(false);
        return;
      }
      result.textContent = className && unit
        ? `${className} course created and ${unit} unit added. Changes saved.`
        : className
          ? `${className} course created. Changes saved.`
          : `${unit} unit added to ${targetClassName} course. Changes saved.`;
      result.style.color = "#14833b";
    }

    function toggleSettings(show) {
      const panel = document.getElementById("settingsPanel");
      const shouldShow = typeof show === "boolean" ? show : panel.classList.contains("hidden");
      panel.classList.toggle("hidden", !shouldShow);
    }

    function openMagazineLibraryFromSettings() {
      if (currentRole !== "teacher") return;
      toggleSettings(false);
      showInterface("magazineLibraryPanel");
    }

    function toggleDarkMode(enabled) {
      document.body.classList.toggle("dark", enabled);
    }

    function applyThemePreference(themeKey) {
      const themes = ["classic", "ocean", "forest", "sunset", "berry", "arctic", "amber", "graphite", "lagoon", "lavender", "rose"];
      const selectedTheme = themes.includes(themeKey) ? themeKey : "classic";
      document.body.dataset.theme = selectedTheme;
      document.getElementById("themeSelect").value = selectedTheme;
      try {
        localStorage.setItem("dashboardTheme", selectedTheme);
      } catch (error) {}
    }

    function applyFontPreference(fontKey) {
      const fonts = {
        arial: "Arial, sans-serif",
        georgia: "Georgia, serif",
        trebuchet: "'Trebuchet MS', sans-serif",
        verdana: "Verdana, sans-serif",
        courier: "'Courier New', monospace"
      };
      const selectedFont = Object.hasOwn(fonts, fontKey) ? fontKey : "arial";
      document.body.style.fontFamily = fonts[selectedFont];
      document.getElementById("fontSelect").value = selectedFont;
      try {
        localStorage.setItem("dashboardFont", selectedFont);
      } catch (error) {}
    }

    function applyFontSizePreference(sizePercent) {
      const parsedSize = Number(sizePercent);
      const selectedSize = Number.isFinite(parsedSize)
        ? Math.min(120, Math.max(85, Math.round(parsedSize / 5) * 5))
        : 100;
      document.body.style.setProperty("--font-scale", String(selectedSize / 100));
      document.getElementById("fontSizeInput").value = selectedSize;
      document.getElementById("fontSizeValue").value = `${selectedSize}%`;
      document.getElementById("fontSizeValue").textContent = `${selectedSize}%`;
      try {
        localStorage.setItem("dashboardFontSize", String(selectedSize));
      } catch (error) {}
    }

    try {
      applyFontPreference(localStorage.getItem("dashboardFont") || "arial");
    } catch (error) {
      applyFontPreference("arial");
    }

    try {
      applyFontSizePreference(localStorage.getItem("dashboardFontSize") || "100");
    } catch (error) {
      applyFontSizePreference("100");
    }

    try {
      applyThemePreference(localStorage.getItem("dashboardTheme") || "classic");
    } catch (error) {
      applyThemePreference("classic");
    }

    function renderSystemMagazine() {
      if (!dashboardMagazines.length) return;
      const magazine = dashboardMagazines[currentSystemMagazineIndex];
      const image = document.getElementById("systemMagazineImage");
      const imageContainer = document.getElementById("systemMagazineContent");
      const onlineLabel = document.getElementById("systemMagazineOnlineLabel");
      const documentPreview = document.getElementById("systemMagazineDocument");
      const caption = document.getElementById("systemMagazineCaption");
      const isImage = magazine.kind === "image";
      const isDocument = magazine.kind === "document";
      image.hidden = !isImage;
      image.classList.toggle("hidden", !isImage);
      imageContainer.hidden = isDocument;
      imageContainer.classList.remove("image-unavailable");
      imageContainer.removeAttribute("aria-label");
      onlineLabel.classList.toggle("hidden", magazine.kind !== "online");
      onlineLabel.removeAttribute("href");
      if (magazine.kind === "online") onlineLabel.href = magazine.url;
      documentPreview.classList.toggle("hidden", !isDocument);
      const imageSource = isImage ? magazine.source : "";
      image.onload = () => {
        if (image.getAttribute("src") !== imageSource) return;
        if (Math.min(image.naturalWidth, image.naturalHeight) < minimumImageShortSide
          || Math.max(image.naturalWidth, image.naturalHeight) < minimumImageLongSide) {
          image.hidden = true;
          image.classList.add("hidden");
          onlineLabel.textContent = `Image is below the required high resolution (1920 × 1080): ${magazine.title}`;
          onlineLabel.classList.remove("hidden");
          imageContainer.classList.add("image-unavailable");
          imageContainer.setAttribute("aria-label", onlineLabel.textContent);
          return;
        }
        image.classList.remove("hidden");
        imageContainer.classList.remove("image-unavailable");
        imageContainer.removeAttribute("aria-label");
        onlineLabel.classList.toggle("hidden", magazine.kind !== "online");
      };
      image.onerror = () => {
        if (!isImage || image.getAttribute("src") !== imageSource) return;
        image.hidden = true;
        image.classList.add("hidden");
        onlineLabel.textContent = `Preview unavailable for ${magazine.title}`;
        onlineLabel.classList.remove("hidden");
        imageContainer.classList.add("image-unavailable");
        imageContainer.setAttribute("aria-label", onlineLabel.textContent);
      };
      image.src = imageSource;
      image.alt = magazine.title;
      if (isImage && image.complete && image.naturalWidth === 0) image.onerror();
      onlineLabel.textContent = `Open ${magazine.title}`;
      caption.textContent = magazine.live
        ? `${magazine.title} — ${magazine.credit}`
        : "";
      caption.classList.toggle("hidden", !magazine.live);
      documentPreview.src = isDocument ? magazine.source : "about:blank";
      documentPreview.title = magazine.title;
      const indicators = document.getElementById("systemMagazineIndicators");
      indicators.replaceChildren(...dashboardMagazines.map((entry, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.setAttribute("aria-label", `Show ${entry.title}`);
        dot.setAttribute("aria-current", String(index === currentSystemMagazineIndex));
        dot.title = entry.title;
        dot.addEventListener("click", () => {
          currentSystemMagazineIndex = index;
          renderSystemMagazine();
        });
        return dot;
      }));
    }

    function changeSystemMagazine(offset) {
      if (!dashboardMagazines.length) return;
      currentSystemMagazineIndex = (currentSystemMagazineIndex + offset + dashboardMagazines.length) % dashboardMagazines.length;
      renderSystemMagazine();
    }

    function syncDashboardMagazines(savedMagazines) {
      dashboardMagazineObjectUrls.forEach(url => URL.revokeObjectURL(url));
      dashboardMagazineObjectUrls = [];
      const savedEntries = savedMagazines.map(magazine => {
        if (magazine.kind === "online") {
          return { title: magazine.title, kind: "online", url: magazine.url };
        }

        const source = URL.createObjectURL(magazine.file);
        dashboardMagazineObjectUrls.push(source);
        return {
          title: magazine.title,
          kind: magazine.file.type === "application/pdf" ? "document" : "image",
          source
        };
      });
      dashboardMagazines = [...liveMagazineEntries, ...savedEntries];
      currentSystemMagazineIndex %= dashboardMagazines.length;
      renderSystemMagazine();
    }

    function secureImageUrl(value) {
      if (!value) return "";
      try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.href : "";
      } catch (error) {
        return "";
      }
    }

    function plainMetadataText(value) {
      if (!value) return "";
      return new DOMParser().parseFromString(value, "text/html").body.textContent
        .replace(/\s+/g, " ")
        .trim();
    }

    async function fetchLiveImagesForTopic(topic) {
      const apiUrl = new URL("https://commons.wikimedia.org/w/api.php");
      apiUrl.search = new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: topic.query,
        gsrnamespace: "6",
        gsrlimit: "10",
        prop: "imageinfo",
        iiprop: "url|size|extmetadata",
        iiurlwidth: "2560",
        format: "json",
        origin: "*"
      });

      const response = await fetch(apiUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load ${topic.title} images.`);
      const data = await response.json();
      if (data.error) throw new Error(`Could not load ${topic.title} images.`);

      return Object.values(data.query?.pages || {})
        .sort((first, second) => (first.index || 0) - (second.index || 0))
        .flatMap(page => {
          const imageInfo = page.imageinfo?.[0];
          const metadata = imageInfo?.extmetadata || {};
          const width = Number(imageInfo?.width) || 0;
          const height = Number(imageInfo?.height) || 0;
          const source = secureImageUrl(imageInfo?.thumburl);
          const license = plainMetadataText(metadata.LicenseShortName?.value);
          if (!source || !license
            || Math.min(width, height) < minimumImageShortSide
            || Math.max(width, height) < minimumImageLongSide) return [];

          const artist = plainMetadataText(metadata.Artist?.value);
          const fileTitle = page.title.replace(/^File:/i, "").replace(/_/g, " ");
          return [{
            title: `${topic.title}: ${fileTitle}`,
            kind: "image",
            source,
            credit: `Photo by ${artist || "Wikimedia Commons contributor"} · ${license} · Wikimedia Commons`,
            live: true
          }];
        })
        .slice(0, 2);
    }

    async function refreshLiveMagazines() {
      if (Date.now() - liveMagazineLastFetch < liveMagazineRefreshInterval) return;
      liveMagazineLastFetch = Date.now();

      const results = await Promise.all(liveImageTopics.map(async topic => {
        try {
          return { topic, entries: await fetchLiveImagesForTopic(topic) };
        } catch (error) {
          return { topic, entries: [], error };
        }
      }));
      const updatedEntries = results.flatMap(result => result.entries)
        .sort((first, second) => Number(Boolean(second.source)) - Number(Boolean(first.source)));
      const missingTopics = results.filter(result => !result.entries.length).map(result => result.topic.title);
      const status = document.getElementById("systemMagazineStatus");

      if (updatedEntries.length) {
        liveMagazineEntries = updatedEntries;
        status.textContent = `High-resolution images updated from Wikimedia Commons${missingTopics.length ? `. No images found for ${missingTopics.join(", ")}` : ""}.`;
      } else if (liveMagazineEntries.length) {
        status.textContent = "Network unavailable. Showing previously loaded images.";
      } else {
        status.textContent = "Could not load images. Check your internet connection and try again later.";
      }
    }

    async function loadDashboardMagazines() {
      await refreshLiveMagazines();
      const database = await openMagazineDatabase();
      const magazines = await new Promise((resolve, reject) => {
        const transaction = database.transaction("magazines", "readonly");
        const request = transaction.objectStore("magazines").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error("Could not load dashboard magazines."));
        transaction.oncomplete = () => database.close();
      });
      syncDashboardMagazines(magazines);
    }

    async function startSystemMagazineDisplay() {
      try {
        await loadDashboardMagazines();
      } catch (error) {
        renderSystemMagazine();
      }
      if (systemMagazineTimer === null) {
        systemMagazineTimer = setInterval(async () => {
          try {
            await loadDashboardMagazines();
          } catch (error) {
            renderSystemMagazine();
          }
          changeSystemMagazine(1);
        }, 15000);
      }
    }

    function stopSystemMagazineDisplay() {
      if (systemMagazineTimer !== null) {
        clearInterval(systemMagazineTimer);
        systemMagazineTimer = null;
      }
    }

    function openMagazineDatabase() {
      return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          reject(new Error("This browser does not support local magazine storage."));
          return;
        }

        const request = indexedDB.open("EduTrackMagazineLibrary", 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("magazines")) {
            database.createObjectStore("magazines", { keyPath: "id" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error("Could not open magazine storage."));
      });
    }

    async function saveMagazineRecord(record) {
      const database = await openMagazineDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction("magazines", "readwrite");
        transaction.objectStore("magazines").put(record);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(new Error("Could not save the magazine. Check available device storage."));
        };
        transaction.onabort = () => {
          database.close();
          reject(new Error("Magazine saving was cancelled."));
        };
      });
    }

    function readImageDimensions(file) {
      return new Promise((resolve, reject) => {
        const source = URL.createObjectURL(file);
        const image = new Image();
        const releaseSource = () => URL.revokeObjectURL(source);
        image.onload = () => {
          releaseSource();
          resolve({ width: image.naturalWidth, height: image.naturalHeight });
        };
        image.onerror = () => {
          releaseSource();
          reject(new Error("Could not read the selected image."));
        };
        image.src = source;
      });
    }

    function setMagazineStatus(message, isError = false) {
      const status = document.getElementById("magazineStatus");
      status.textContent = message;
      status.style.color = isError ? "#bb2222" : "#14833b";
    }

    function escapeMagazineText(value) {
      return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character]);
    }

    async function addOnlineMagazine(event) {
      event.preventDefault();
      const titleInput = document.getElementById("onlineMagazineTitle");
      const urlInput = document.getElementById("onlineMagazineUrl");

      try {
        const url = new URL(urlInput.value.trim());
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          throw new Error("Use a web address that starts with http:// or https://.");
        }

        await saveMagazineRecord({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          title: titleInput.value.trim(),
          kind: "online",
          url: url.href,
          addedAt: Date.now()
        });
        event.target.reset();
        setMagazineStatus("Online magazine added.");
        await renderMagazineLibrary();
      } catch (error) {
        setMagazineStatus(error.message || "Could not add this online magazine.", true);
      }
    }

    async function addDeviceMagazine(event) {
      event.preventDefault();
      const fileInput = document.getElementById("deviceMagazineFile");
      const titleInput = document.getElementById("deviceMagazineTitle");
      const file = fileInput.files[0];
      if (!file) return;

      if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
        setMagazineStatus("Choose a PDF or image file.", true);
        return;
      }

      try {
        if (file.type.startsWith("image/")) {
          const { width, height } = await readImageDimensions(file);
          if (Math.min(width, height) < minimumImageShortSide
            || Math.max(width, height) < minimumImageLongSide) {
            setMagazineStatus("Choose an image at least 1920 × 1080 pixels (or 1080 × 1920 for portrait images).", true);
            return;
          }
        }

        await saveMagazineRecord({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          title: titleInput.value.trim() || file.name,
          kind: "device",
          file,
          fileName: file.name,
          addedAt: Date.now()
        });
        event.target.reset();
        setMagazineStatus("Magazine uploaded to this device's browser storage.");
        await renderMagazineLibrary();
      } catch (error) {
        setMagazineStatus(error.message || "Could not save the selected file.", true);
      }
    }

    async function renderMagazineLibrary() {
      const list = document.getElementById("magazineList");
      magazineObjectUrls.forEach(url => URL.revokeObjectURL(url));
      magazineObjectUrls = [];

      try {
        const database = await openMagazineDatabase();
        const magazines = await new Promise((resolve, reject) => {
          const transaction = database.transaction("magazines", "readonly");
          const request = transaction.objectStore("magazines").getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(new Error("Could not load the magazine library."));
          transaction.oncomplete = () => database.close();
        });

        syncDashboardMagazines(magazines);
        magazines.sort((first, second) => second.addedAt - first.addedAt);
        if (!magazines.length) {
          list.innerHTML = "<p>No magazines have been added yet.</p>";
          return;
        }

        list.innerHTML = magazines.map(magazine => {
          const deviceFile = magazine.kind === "device";
          const href = deviceFile ? URL.createObjectURL(magazine.file) : magazine.url;
          if (deviceFile) magazineObjectUrls.push(href);
          const title = escapeMagazineText(magazine.title);
          const description = deviceFile
            ? `On this device: ${escapeMagazineText(magazine.fileName)}`
            : "Online magazine";
          return `
            <div class="magazine-item">
              <div class="magazine-item-info">
                <a href="${escapeMagazineText(href)}" target="_blank" rel="noopener noreferrer">${title}</a>
                <small>${description}</small>
              </div>
              <button type="button" onclick="removeMagazine('${escapeMagazineText(magazine.id)}')" aria-label="Remove ${title}">Remove</button>
            </div>
          `;
        }).join("");
      } catch (error) {
        list.innerHTML = "";
        setMagazineStatus(error.message || "Magazine storage is unavailable.", true);
      }
    }

    async function removeMagazine(id) {
      try {
        const database = await openMagazineDatabase();
        await new Promise((resolve, reject) => {
          const transaction = database.transaction("magazines", "readwrite");
          transaction.objectStore("magazines").delete(id);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => {
            database.close();
            reject(new Error("Could not remove this magazine."));
          };
        });
        setMagazineStatus("Magazine removed.");
        await renderMagazineLibrary();
      } catch (error) {
        setMagazineStatus(error.message || "Could not remove this magazine.", true);
      }
    }

    function changeWallpaper(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        document.getElementById("app").style.backgroundImage = `url("${reader.result}")`;
        document.getElementById("systemWallpaperSelect").value = "custom";
        try {
          localStorage.removeItem("dashboardWallpaper");
        } catch (error) {}
      };
      reader.readAsDataURL(file);
    }

    function setSystemWallpaper(wallpaper) {
      if (!systemWallpapers.includes(wallpaper)) return;

      document.getElementById("app").style.backgroundImage = `url("${encodeURI(wallpaper)}")`;
      document.getElementById("systemWallpaperSelect").value = wallpaper;
      document.getElementById("wallpaperUpload").value = "";
      try {
        localStorage.setItem("dashboardWallpaper", wallpaper);
      } catch (error) {}
    }

    function resetWallpaper() {
      setSystemWallpaper(defaultWallpaper);
    }

    function togglePasswordVisibility(inputId, checkbox) {
      document.getElementById(inputId).type = checkbox.checked ? "text" : "password";
    }

    function toggleProfilePasswordVisibility(checkbox) {
      ["currentProfilePassword", "newProfilePassword", "confirmProfilePassword"].forEach(inputId => {
        document.getElementById(inputId).type = checkbox.checked ? "text" : "password";
      });
    }

    function saveAccounts() {
      localStorage.setItem("edutrackAccounts", JSON.stringify(accounts));
    }

    function refreshInstitutionSuggestions() {
      const suggestions = new Map();
      Object.values(accounts).forEach(roleAccounts => {
        if (!Array.isArray(roleAccounts)) return;
        roleAccounts.forEach(account => {
          if (!account) return;
          const name = typeof account.institutionName === "string" ? account.institutionName.trim() : "";
          const key = name.toLowerCase();
          if (key && !suggestions.has(key)) suggestions.set(key, name);
        });
      });

      const datalist = document.getElementById("institutionSuggestions");
      const institutionNames = [...suggestions.values()]
        .sort((first, second) => first.localeCompare(second));
      datalist.replaceChildren(...institutionNames.map(name => new Option(name, name)));
    }

    refreshInstitutionSuggestions();

    function toggleAuthMode() {
      setAuthMode(authMode === "login" ? "signup" : "login");
    }

    function setAuthMode(mode) {
      authMode = mode;
      const signingUp = mode === "signup";
      const recovering = mode === "recover";
      document.getElementById("authTitle").textContent = signingUp
        ? "CREATE ACCOUNT"
        : recovering ? "RESET PASSWORD" : "ATTENDANCE SYSTEM";
      document.getElementById("authDescription").textContent = signingUp
        ? "Create an account to access attendance and school messages."
        : recovering
          ? "Reset the password saved for this account in this browser. This page cannot verify your identity or send email."
          : "Log in to manage attendance and school messages.";
      document.getElementById("nameLabel").classList.toggle("hidden", !signingUp);
      document.getElementById("accountName").classList.toggle("hidden", !signingUp);
      document.getElementById("accountName").required = signingUp;
      document.getElementById("confirmPasswordGroup").classList.toggle("hidden", !signingUp && !recovering);
      document.getElementById("confirmPassword").required = signingUp || recovering;
      document.getElementById("passwordLabel").textContent = recovering ? "New password" : "Password";
      document.getElementById("password").placeholder = recovering ? "Enter a new password" : "Enter your password";
      document.getElementById("password").autocomplete = signingUp || recovering ? "new-password" : "current-password";
      document.getElementById("password").minLength = signingUp || recovering ? 6 : 0;
      document.getElementById("authSubmit").textContent = signingUp ? "Create account" : recovering ? "Reset password" : "Log in";
      document.getElementById("authSwitch").textContent = signingUp || recovering ? "Back to log in" : "Create an account";
      document.getElementById("authForgot").classList.toggle("hidden", mode !== "login");
      const error = document.getElementById("loginError");
      error.textContent = "";
      error.style.color = "";
      updateCourseField();
    }

    function updateCourseField() {
      const selectedRole = document.getElementById("role").value;
      const isTrainee = selectedRole === "student" || selectedRole === "trainee";
      if (isTrainee && authMode !== "login") {
        setAuthMode("login");
        return;
      }

      const showAdmissionNumber = isTrainee && authMode !== "recover";
      const traineeLogin = isTrainee && authMode === "login";
      const showCourse = isTrainee && (authMode === "signup" || traineeLogin);
      const showUnit = traineeLogin;
      const showInstitution = authMode !== "recover";
      document.getElementById("institutionGroup").classList.toggle("hidden", !showInstitution);
      document.getElementById("institutionName").required = authMode === "signup";
      document.getElementById("admissionNumberGroup").classList.toggle("hidden", !showAdmissionNumber);
      document.getElementById("admissionNumber").required = showAdmissionNumber;
      document.getElementById("courseGroup").classList.toggle("hidden", !showCourse);
      document.getElementById("accountCourse").required = showCourse;
      document.getElementById("unitGroup").classList.toggle("hidden", !showUnit);
      document.getElementById("accountUnit").required = showUnit;
      document.getElementById("emailLabel").classList.toggle("hidden", traineeLogin);
      document.getElementById("email").classList.toggle("hidden", traineeLogin);
      document.getElementById("email").required = !traineeLogin;
      document.getElementById("passwordLabel").classList.toggle("hidden", traineeLogin);
      document.getElementById("password").classList.toggle("hidden", traineeLogin);
      document.getElementById("password").required = !traineeLogin;
      document.getElementById("passwordToggle").classList.toggle("hidden", traineeLogin);
      document.getElementById("authForgot").classList.toggle("hidden", authMode !== "login" || isTrainee);
      document.getElementById("authSwitch").classList.toggle("hidden", isTrainee);
      if (traineeLogin) {
        document.getElementById("authDescription").textContent =
          "Enter your institution, course, unit, and admission number to find your teacher's course.";
      } else if (authMode === "login") {
        document.getElementById("authDescription").textContent = "Log in to manage attendance and school messages.";
      }
      document.getElementById("courseLabel").textContent = authMode === "login" ? "Course name" : "Course";
      document.getElementById("accountCourse").placeholder = authMode === "login"
        ? "Enter the course name assigned by your teacher"
        : "Enter your course name";
    }

    updateCourseField();

    function submitAuth(event) {
      if (authMode === "signup") {
        createAccount(event);
      } else if (authMode === "recover") {
        resetPassword(event);
      } else {
        login(event);
      }
    }

    function resetPassword(event) {
      event.preventDefault();

      const role = document.getElementById("role").value;
      const email = document.getElementById("email").value.trim().toLowerCase();
      const password = document.getElementById("password").value;
      const confirmation = document.getElementById("confirmPassword").value;
      const error = document.getElementById("loginError");
      const account = accounts[role].find(candidate => candidate.email === email);

      if (!account) {
        error.textContent = "No account was found for that account type and email in this browser.";
        return;
      }
      if (password.length < 6) {
        error.textContent = "Choose a password with at least 6 characters.";
        return;
      }
      if (password !== confirmation) {
        error.textContent = "The passwords do not match.";
        return;
      }

      account.password = password;
      saveAccounts();
      document.getElementById("password").value = "";
      document.getElementById("confirmPassword").value = "";
      setAuthMode("login");
      error.textContent = "Password updated in this browser. You can now log in.";
      error.style.color = "#14833b";
    }

    function createAccount(event) {
      event.preventDefault();

      const rawRole = document.getElementById("role").value;
      const role = rawRole === "trainee" ? "student" : rawRole;
      const name = document.getElementById("accountName").value.trim();
      const institutionName = document.getElementById("institutionName").value.trim();
      const course = document.getElementById("accountCourse").value.trim();
      const admissionNumber = document.getElementById("admissionNumber").value.trim().toUpperCase();
      const email = document.getElementById("email").value.trim().toLowerCase();
      const password = document.getElementById("password").value;
      const confirmation = document.getElementById("confirmPassword").value;
      const error = document.getElementById("loginError");

      if (!name) {
        error.textContent = "Enter your full name.";
        return;
      }
      if (password.length < 6) {
        error.textContent = "Choose a password with at least 6 characters.";
        return;
      }
      if (password !== confirmation) {
        error.textContent = "The passwords do not match.";
        return;
      }
      if (role === "student" && accounts.student.some(account => account.admissionNumber && account.admissionNumber.toUpperCase() === admissionNumber)) {
        error.textContent = "This admission number is already registered.";
        return;
      }
      if (Object.values(accounts).some(roleAccounts => roleAccounts.some(account => account.email === email))) {
        error.textContent = "An account with this email already exists.";
        return;
      }

      accounts[role].push({ email, password, name, avatar: "", institutionName, course: role === "student" ? course : "", admissionNumber: role === "student" ? admissionNumber : "" });
      saveAccounts();
      refreshInstitutionSuggestions();
      document.getElementById("email").value = email;
      document.getElementById("password").value = "";
      document.getElementById("confirmPassword").value = "";
      document.getElementById("accountName").value = "";
      document.getElementById("institutionName").value = "";
      document.getElementById("accountCourse").value = "";
      document.getElementById("admissionNumber").value = "";
      toggleAuthMode();
      error.textContent = "Account created. Log in with your new credentials.";
      error.style.color = "#14833b";
    }

    function renderProfileAvatar() {
      const avatar = document.getElementById("profileAvatar");
      const interfaceAvatar = document.getElementById("profileInterfaceAvatar");
      const image = currentAccount.avatar;
      avatar.src = image;
      avatar.style.display = image ? "block" : "none";
      interfaceAvatar.src = image;
      interfaceAvatar.style.display = image ? "block" : "none";
    }

    function getStudentAvatar(student) {
      return student.avatar || defaultStudentAvatar;
    }

    function openImageViewer() {
      const image = currentAccount.avatar;
      if (!image) return;

      document.getElementById("viewedProfileImage").src = image;
      document.getElementById("viewedProfileImage").classList.remove("hidden");
      document.getElementById("studentProfileViewer").classList.add("hidden");
      document.getElementById("imageViewer").classList.remove("hidden");
    }

    function openStudentProfile(studentIndex) {
      const student = students[studentIndex];
      if (!student) return;

      document.getElementById("viewedProfileImage").classList.add("hidden");
      document.getElementById("viewedStudentImage").src = getStudentAvatar(student);
      document.getElementById("viewedStudentName").textContent = student.name;
      document.getElementById("viewedStudentCourse").textContent = student.course;
      document.getElementById("viewedStudentStatus").textContent = student.present ? "Present today" : "Absent today";
      document.getElementById("profileStudentCount").textContent = students.length;
      const deleteButton = document.getElementById("profileDeleteStudent");
      deleteButton.hidden = currentRole !== "teacher";
      deleteButton.disabled = students.length === 1;
      deleteButton.title = students.length === 1 ? "At least one student must remain." : "Delete this student";
      viewedStudentIndex = studentIndex;
      document.getElementById("studentProfileViewer").classList.remove("hidden");
      document.getElementById("imageViewer").classList.remove("hidden");
    }

    function closeImageViewer() {
      document.getElementById("imageViewer").classList.add("hidden");
    }

    function previewProfileImage(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        pendingAvatar = reader.result;
        document.getElementById("profileInterfaceAvatar").src = pendingAvatar;
        document.getElementById("profileInterfaceAvatar").style.display = "block";
      };
      reader.readAsDataURL(file);
    }

    function showProfileInterface() {
      document.getElementById("teacherView").classList.add("hidden");
      document.getElementById("studentView").classList.add("hidden");
      document.getElementById("profileInterface").classList.remove("hidden");
      document.getElementById("studentProfilePhotoHelp").classList.toggle("hidden", currentRole !== "student");
      document.getElementById("profileEmail").required = currentRole !== "student";
      document.getElementById("profileEmailLabel").textContent = currentRole === "student"
        ? "Email address (optional)"
        : "Email address";

      const account = currentAccount;
      document.getElementById("profileNavButton").setAttribute("aria-pressed", "true");
      document.getElementById("profileName").value = account.name;
      document.getElementById("profileEmail").value = account.email;
      document.getElementById("profileRole").textContent = currentRole === "teacher" ? "Teacher" : "Trainee";
      document.getElementById("profileImage").value = "";
      pendingAvatar = account.avatar;
      document.getElementById("profileInterfaceAvatar").src = account.avatar;
      document.getElementById("profileInterfaceAvatar").style.display = account.avatar ? "block" : "none";
      document.getElementById("profileResult").textContent = "";
      profileBaseline = getProfileSnapshot();
      document.getElementById("profileName").focus();
      document.getElementById("profileInterface").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function closeProfileInterface() {
      if (hasUnsavedProfileChanges() && !window.confirm("Discard your unsaved profile changes?")) return;
      discardProfileChanges();
      document.getElementById("profileInterface").classList.add("hidden");
      document.getElementById("profileNavButton").setAttribute("aria-pressed", "false");
      document.getElementById(currentRole === "teacher" ? "teacherView" : "studentView").classList.remove("hidden");
    }

    let profileBaseline = null;

    function getProfileSnapshot() {
      return {
        name: document.getElementById("profileName").value,
        email: document.getElementById("profileEmail").value,
        avatar: pendingAvatar
      };
    }

    function hasUnsavedProfileChanges() {
      if (document.getElementById("profileInterface").classList.contains("hidden")) return false;
      const current = getProfileSnapshot();
      return !profileBaseline || current.name !== profileBaseline.name || current.email !== profileBaseline.email || current.avatar !== profileBaseline.avatar;
    }

    function discardProfileChanges() {
      if (!currentAccount) return;
      document.getElementById("profileName").value = currentAccount.name;
      document.getElementById("profileEmail").value = currentAccount.email;
      pendingAvatar = currentAccount.avatar;
      document.getElementById("profileImage").value = "";
      document.getElementById("profileInterfaceAvatar").src = currentAccount.avatar;
      document.getElementById("profileInterfaceAvatar").style.display = currentAccount.avatar ? "block" : "none";
      profileBaseline = getProfileSnapshot();
    }

    document.addEventListener("click", event => {
      const control = event.target.closest("button, a");
      const profileInterface = document.getElementById("profileInterface");
      if (!control || profileInterface.contains(control) || !hasUnsavedProfileChanges()) return;
      if (!window.confirm("Discard your unsaved profile changes?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      discardProfileChanges();
      closeProfileInterface();
    }, true);

    window.addEventListener("beforeunload", event => {
      if (!hasUnsavedProfileChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    });

    function saveProfile(event) {
      event.preventDefault();

      const name = document.getElementById("profileName").value.trim();
      const email = document.getElementById("profileEmail").value.trim().toLowerCase();
      const result = document.getElementById("profileResult");

      if (!name) {
        result.textContent = "Enter a name first.";
        result.style.color = "#bb2222";
        return;
      }

      if (!email && currentRole !== "student") {
        result.textContent = "Enter an email address.";
        result.style.color = "#bb2222";
        return;
      }

      if (currentRole !== "student" && Object.values(accounts).some(roleAccounts => roleAccounts.some(account => account !== currentAccount && account.email === email))) {
        result.textContent = "An account with this email already exists.";
        result.style.color = "#bb2222";
        return;
      }

      if (currentRole === "student" && !saveStudentProfileToTeacherRoster(name, email, pendingAvatar)) return;

      currentAccount.name = name;
      currentAccount.email = email;
      currentAccount.avatar = pendingAvatar;
      if (currentRole !== "student") saveAccounts();
      document.getElementById("loggedInUser").textContent = name;
      document.getElementById("studentWelcome").textContent = `Welcome, ${name}`;
      renderProfileAvatar();
      result.textContent = currentRole === "student"
        ? "Profile photo and details saved to your teacher's roster in this browser."
        : "Profile updated.";
      result.style.color = "#14833b";
      profileBaseline = getProfileSnapshot();
    }

    function saveStudentProfileToTeacherRoster(name, email, avatar) {
      const result = document.getElementById("profileResult");
      const reference = currentStudentRosterReference;
      if (!reference) {
        result.textContent = "Could not find your teacher's roster. Sign out and sign in again before saving.";
        result.style.color = "#bb2222";
        return false;
      }

      const teacher = accounts.teacher.find(account =>
        account.email.toLowerCase() === reference.teacherEmail.toLowerCase()
      );
      if (!teacher) {
        result.textContent = "Could not find the teacher account for this trainee record.";
        result.style.color = "#bb2222";
        return false;
      }

      try {
        const key = getClassStorageKey(teacher);
        const stored = localStorage.getItem(key);
        let rosterData = stored ? JSON.parse(stored) : null;
        if (!rosterData || !rosterData.classes || typeof rosterData.classes !== "object") {
          rosterData = {
            activeClass: reference.className,
            classes: { [reference.className]: [] },
            units: {}
          };
        }

        const roster = rosterData.classes[reference.className];
        if (!Array.isArray(roster)) {
          result.textContent = "Your trainee record was not found in the teacher's course roster.";
          result.style.color = "#bb2222";
          return false;
        }

        const normalize = value => String(value || "").trim().toLowerCase();
        const student = roster.find(candidate =>
          candidate
          && normalize(candidate.admissionNumber) === normalize(reference.admissionNumber)
          && normalize(candidate.course || reference.className) === normalize(reference.course)
          && normalize(candidate.unit) === normalize(reference.unit)
        );
        if (!student) {
          result.textContent = "Your trainee record was not found in the teacher's course roster.";
          result.style.color = "#bb2222";
          return false;
        }

        student.name = name;
        student.email = email;
        student.avatar = avatar;
        localStorage.setItem(key, JSON.stringify(rosterData));
        return true;
      } catch (error) {
        console.error("Could not save trainee profile to the teacher's roster.", error);
        result.textContent = "Could not save your profile photo to the teacher's roster in this browser. Check available storage and try again.";
        result.style.color = "#bb2222";
        return false;
      }
    }

    function showInterface(interfaceId, button) {
      const target = document.getElementById(interfaceId);
      if (!target) return;

      const teacherInterfaces = [
        "teacherDashboard",
        "todayAttendance",
        "studentRosterPanel",
        "studentSummaryPanel",
        "attendanceHistoryPanel",
        "markAttendancePanel",
        "lessonCoveragePanel",
        "magazineLibraryPanel",
        "classAttendanceOverview"
      ];
      const studentInterfaces = ["studentAttendancePanel", "studentNotesPanel"];
      const interfaceGroup = teacherInterfaces.includes(interfaceId)
        ? teacherInterfaces
        : studentInterfaces;

      interfaceGroup.forEach(id => {
        document.getElementById(id).classList.toggle("hidden", id !== interfaceId);
      });
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (interfaceId === "magazineLibraryPanel" || interfaceId === "teacherDashboard") {
        startSystemMagazineDisplay();
        if (interfaceId === "magazineLibraryPanel") renderMagazineLibrary();
      } else {
        stopSystemMagazineDisplay();
      }
      const navigation = document.querySelector(interfaceGroup === teacherInterfaces
        ? "#teacherView .interface-nav"
        : "#studentView .interface-nav");
      navigation.querySelectorAll("button").forEach(navButton => {
        navButton.classList.toggle("active", navButton === button);
        if (navButton === button) navButton.setAttribute("aria-current", "page");
        else navButton.removeAttribute("aria-current");
      });
    }

    function findStudentInTeacherClasses(admissionNumber, course, unit, institutionName) {
      const normalize = value => String(value || "").trim().toLowerCase();
      const normalizedAdmissionNumber = normalize(admissionNumber);
      const normalizedCourse = normalize(course);
      const normalizedUnit = normalize(unit);
      const normalizedInstitution = normalize(institutionName);
      const matches = [];

      for (const teacher of accounts.teacher) {
        if (!teacher.email) continue;
        const teacherInstitution = normalize(teacher.institutionName);
        if (normalizedInstitution !== teacherInstitution) continue;

        let savedData = null;
        try {
          const serialized = localStorage.getItem(getClassStorageKey(teacher));
          savedData = serialized ? JSON.parse(serialized) : null;
        } catch (error) {
          return { error: "Could not read the teachers' course rosters in this browser. Please try again." };
        }

        let classes;
        if (savedData && savedData.classes && typeof savedData.classes === "object") {
          classes = Object.entries(savedData.classes)
            .filter(([name, roster]) => name.trim() && Array.isArray(roster));
        } else {
          classes = [[defaultClassName, []]];
        }

        classes.forEach(([className, roster]) => {
          roster.forEach(student => {
            if (!student
              || normalize(student.admissionNumber) !== normalizedAdmissionNumber
              || normalize(student.course || className) !== normalizedCourse
              || normalize(student.unit) !== normalizedUnit) {
              return;
            }
            matches.push({ teacher, className, student });
          });
        });
      }

      if (matches.length === 0) {
        return { error: "No trainee with that admission number, course, and unit was found for this institution. Check the details with your teacher." };
      }
      if (matches.length > 1) {
        return { error: "More than one teacher has a matching trainee. Ask your institution to confirm the course assignment." };
      }
      return { match: matches[0] };
    }

    function login(event) {
      event.preventDefault();

      const rawRole = document.getElementById("role").value;
      const role = rawRole === "trainee" ? "student" : rawRole;
      const admissionNumber = document.getElementById("admissionNumber").value.trim().toUpperCase();
      const institutionName = document.getElementById("institutionName").value.trim();
      const course = document.getElementById("accountCourse").value.trim();
      const unit = document.getElementById("accountUnit").value.trim();
      const error = document.getElementById("loginError");
      let account;
      currentStudentRosterReference = null;

      if (role === "student") {
        const result = findStudentInTeacherClasses(admissionNumber, course, unit, institutionName);
        if (result.error) {
          error.textContent = result.error;
          return;
        }

        const { teacher, className, student } = result.match;
        currentStudentRosterReference = {
          teacherEmail: teacher.email,
          className,
          admissionNumber: student.admissionNumber,
          course: student.course || className,
          unit: student.unit || ""
        };
        account = {
          ...student,
          email: student.email || "",
          avatar: student.avatar || "",
          course: student.course || className,
          unit: student.unit || "",
          institutionName: teacher.institutionName || ""
        };
      } else {
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;
        account = accounts[role].find(candidate => candidate.email === email);
        if (!account || password !== account.password) {
          error.textContent = "The email or password is incorrect.";
          return;
        }
        if (account.institutionName && institutionName.toLowerCase() !== account.institutionName.trim().toLowerCase()) {
          error.textContent = "The institution name does not match this account.";
          return;
        }
        if (!account.institutionName && institutionName) {
          error.textContent = "No institution is saved for this older account. Leave the field blank to continue.";
          return;
        }
      }

      openDashboard(rawRole, account);
      error.textContent = "";
    }

    function logout() {
      stopSystemMagazineDisplay();
      closeProfileInterface();
      currentStudentRosterReference = null;
      document.getElementById("app").classList.remove("hidden");
      document.getElementById("loginPage").classList.add("hidden");
      document.getElementById("password").value = "";
      currentAccount = accounts.teacher[0] || accounts.student[0] || null;
      currentRole = currentAccount && accounts.teacher.includes(currentAccount) ? "teacher" : "student";
      if (currentAccount) {
        document.getElementById("loggedInUser").textContent = currentAccount.name;
        document.getElementById("studentWelcome").textContent = `Welcome, ${currentAccount.name}`;
        document.getElementById("teacherView").classList.toggle("hidden", currentRole !== "teacher");
        document.getElementById("studentView").classList.toggle("hidden", currentRole !== "student");
        document.getElementById("magazineSettingsLink").classList.toggle("hidden", currentRole !== "teacher");
        renderProfileAvatar();
        renderStudents();
        if (currentRole === "teacher") {
          startSystemMagazineDisplay();
        } else {
          stopSystemMagazineDisplay();
        }
      }
    }

    function showStudentList() {
      const panel = document.getElementById("todayAttendance");
      const navButton = document.querySelector("#teacherView .interface-nav button:nth-child(2)");
      if (panel) {
        showInterface("todayAttendance", navButton || undefined);
        const studentList = document.getElementById("studentList");
        if (studentList) {
          studentList.innerHTML = students.length ? students.map((student, index) => `
            <div class="student">
              <div class="student-identity" role="button" tabindex="0" onclick="openStudentProfile(${index})" onkeydown="if (event.key === 'Enter' || event.key === ' ') openStudentProfile(${index})">
                <img class="student-profile-image" src="${getStudentAvatar(student)}" alt="${student.name} profile image" />
                <div>
                  <strong>${student.name}</strong>
                  <small>${student.course} · ${escapeMagazineText(student.unit || "Unit not assigned")}</small>
                </div>
              </div>
            </div>
          `).join("") : '<p class="empty-state">No students in this course yet. Add students below.</p>';
          studentList.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }

    function getTodayKey() {
      return formatLocalDate(new Date());
    }

    function syncStudentTodayMarkState(student) {
      const todayKey = getTodayKey();
      const todayRecord = student.history.find(item => item.date === todayKey);

      if (!todayRecord) {
        student.present = false;
        return { isMarked: false, label: "Not marked", className: "unmarked" };
      }

      student.present = todayRecord.attended === todayRecord.total;
      return {
        isMarked: true,
        label: student.present ? "Present" : "Absent",
        className: student.present ? "present" : "absent"
      };
    }

    function getStudentTodayStatus(student) {
      return syncStudentTodayMarkState(student);
    }

    function getStudentAttendancePercentage(student) {
      const historyTotal = student.history.reduce((sum, day) => sum + (Number(day.total) || 0), 0);
      const historyAttended = student.history.reduce((sum, day) => sum + (Number(day.attended) || 0), 0);
      if (historyTotal > 0) {
        return Math.round((historyAttended / historyTotal) * 100);
      }
      const totalLessons = student.lessons.length || 1;
      const attendedLessons = student.lessons.filter(lesson => lesson.present).length;
      return Math.round((attendedLessons / totalLessons) * 100);
    }

    function renderClassAttendanceOverview() {
      const overview = document.getElementById("classAttendanceOverview");
      if (!overview) return;

      const tableWrap = overview.querySelector(".class-attendance-table-wrap");
      if (!tableWrap) return;

      if (!students.length) {
        tableWrap.innerHTML = '<p class="empty-state">No students in this course yet. Add a student to view attendance percentages.</p>';
        return;
      }

      tableWrap.innerHTML = `
        <table class="class-attendance-table" aria-label="Attendance overview by trainee">
          <thead>
            <tr>
              <th>Trainee</th>
              <th>Admission No.</th>
              <th>Course attendance</th>
              <th>Attendance %</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(student => {
              const percentage = getStudentAttendancePercentage(student);
              const todayStatus = getStudentTodayStatus(student);
              return `
                <tr>
                  <td>
                    <div class="student-roster-identity">
                      <img class="student-roster-photo" src="${escapeMagazineText(getStudentAvatar(student))}" alt="${escapeMagazineText(student.name)} profile photo" />
                      <span>${escapeMagazineText(student.name)}</span>
                    </div>
                  </td>
                  <td>${student.admissionNumber || "N/A"}</td>
                  <td>
                    <div class="attendance-progress" aria-label="${percentage}% attendance">
                      <span style="width: ${percentage}%"></span>
                    </div>
                  </td>
                  <td>${percentage}%</td>
                  <td>
                    <span class="student-roster-status status ${todayStatus.className}">
                      ${todayStatus.label}
                    </span>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;
    }

    function getLessonCoverageStorageKey() {
      if (!currentAccount || !activeClassName) return "edutrackLessonCoverage";
      return `edutrackLessonCoverage:${currentAccount.email.toLowerCase()}:${activeClassName}`;
    }

    function formatLessonCoverageDate(date) {
      const parsedDate = new Date(`${date}T00:00:00`);
      return Number.isNaN(parsedDate.getTime())
        ? date
        : parsedDate.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    }

    function renderLessonCoverage() {
      const list = document.getElementById("lessonCoverageList");
      const dateInput = document.getElementById("lessonCoverageDate");
      const topicInput = document.getElementById("lessonCoverageTopic");
      const result = document.getElementById("lessonCoverageResult");

      if (!dateInput || !list || !topicInput) return;
      if (!dateInput.value) {
        dateInput.value = formatLocalDate(new Date());
      }

      try {
        const rawEntries = localStorage.getItem(getLessonCoverageStorageKey());
        const entries = rawEntries ? JSON.parse(rawEntries) : [];
        const selectedDateEntries = entries.filter(entry => entry.date === dateInput.value && entry.className === activeClassName);

        if (selectedDateEntries.length && !topicInput.value.trim()) {
          const latestEntry = selectedDateEntries[0];
          topicInput.value = latestEntry.topic || "";
          document.getElementById("lessonCoverageSubTopic").value = latestEntry.subTopic || "";
          document.getElementById("lessonCoverageSummary").value = latestEntry.summary || "";
        }

        const groupedEntries = entries
          .filter(entry => entry.className === activeClassName)
          .reduce((groups, entry) => {
            const key = entry.date;
            if (!groups[key]) groups[key] = [];
            groups[key].push(entry);
            return groups;
          }, {});

        const orderedDates = Object.keys(groupedEntries).sort((a, b) => new Date(b) - new Date(a));

        if (!orderedDates.length) {
          list.innerHTML = '<p class="empty-state">No lesson notes recorded yet. Use the form above to save what was covered.</p>';
          return;
        }

        list.innerHTML = orderedDates
          .slice(0, 12)
          .map(date => {
            const dayEntries = groupedEntries[date];
            return `
              <section class="lesson-coverage-day">
                <h4 class="lesson-coverage-day-title">${escapeMagazineText(formatLessonCoverageDate(date))}</h4>
                ${dayEntries.map(entry => {
                  const entryIndex = entries.indexOf(entry);
                  return `
                    <button type="button" class="lesson-coverage-entry" onclick="openLessonCoverage(${entryIndex}, this)" aria-label="View lesson coverage: ${escapeMagazineText(entry.topic || "Lesson")}">
                      <strong class="lesson-coverage-entry-title">${escapeMagazineText(entry.topic || "Lesson")}</strong>
                      ${entry.subTopic ? `<span class="lesson-coverage-entry-subtopic">${escapeMagazineText(entry.subTopic)}</span>` : ""}
                      <span class="lesson-coverage-entry-preview">${escapeMagazineText(entry.summary || "")}</span>
                    </button>
                  `;
                }).join("")}
              </section>
            `;
          })
          .join("");
      } catch (error) {
        console.error("Could not load lesson coverage.", error);
        list.innerHTML = '<p class="empty-state">Lesson notes are unavailable right now.</p>';
        if (result) {
          result.textContent = "Could not load lesson coverage.";
          result.style.color = "#bb2222";
        }
      }
    }

    let lessonCoverageReturnFocus = null;

    function openLessonCoverage(entryIndex, trigger) {
      const result = document.getElementById("lessonCoverageResult");
      try {
        const entries = JSON.parse(localStorage.getItem(getLessonCoverageStorageKey()) || "[]");
        const entry = Array.isArray(entries) ? entries[entryIndex] : null;
        if (!entry) {
          result.textContent = "This lesson coverage could not be found. Refresh the list and try again.";
          result.style.color = "#bb2222";
          return;
        }

        document.getElementById("lessonCoverageViewerDate").textContent = formatLessonCoverageDate(entry.date || "");
        document.getElementById("lessonCoverageViewerTitle").textContent = entry.topic || "Lesson";
        const subTopicSection = document.getElementById("lessonCoverageSubTopicSection");
        subTopicSection.hidden = !entry.subTopic;
        document.getElementById("lessonCoverageViewerSubTopic").textContent = entry.subTopic || "";
        document.getElementById("lessonCoverageViewerSummary").textContent = entry.summary || "";
        lessonCoverageReturnFocus = trigger;
        const viewer = document.getElementById("lessonCoverageViewer");
        viewer.classList.remove("hidden");
        viewer.querySelector(".lesson-coverage-viewer-card").focus();
      } catch (error) {
        console.error("Could not open lesson coverage.", error);
        result.textContent = "Could not open lesson coverage.";
        result.style.color = "#bb2222";
      }
    }

    function closeLessonCoverage() {
      document.getElementById("lessonCoverageViewer").classList.add("hidden");
      if (lessonCoverageReturnFocus && lessonCoverageReturnFocus.isConnected) {
        lessonCoverageReturnFocus.focus();
      }
      lessonCoverageReturnFocus = null;
    }

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !document.getElementById("lessonCoverageViewer").classList.contains("hidden")) {
        closeLessonCoverage();
      }
    });

    function saveLessonCoverage(event) {
      event.preventDefault();
      const dateInput = document.getElementById("lessonCoverageDate");
      const topicInput = document.getElementById("lessonCoverageTopic");
      const subTopicInput = document.getElementById("lessonCoverageSubTopic");
      const summaryInput = document.getElementById("lessonCoverageSummary");
      const result = document.getElementById("lessonCoverageResult");
      const topic = topicInput.value.trim();
      const subTopic = subTopicInput.value.trim();
      const summary = summaryInput.value.trim();
      const date = dateInput.value || formatLocalDate(new Date());

      if (!topic) {
        result.textContent = "Enter the lesson topic.";
        result.style.color = "#bb2222";
        topicInput.focus();
        return;
      }
      if (!summary) {
        result.textContent = "Enter what was done that day.";
        result.style.color = "#bb2222";
        summaryInput.focus();
        return;
      }

      try {
        const key = getLessonCoverageStorageKey();
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        const filtered = existing.filter(entry => !(entry.date === date && entry.className === activeClassName && entry.topic === topic && entry.subTopic === subTopic && entry.summary === summary));
        filtered.unshift({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          date,
          className: activeClassName,
          topic,
          subTopic,
          summary
        });
        localStorage.setItem(key, JSON.stringify(filtered.slice(0, 100)));
        result.textContent = "Lesson coverage saved.";
        result.style.color = "#14833b";
        topicInput.value = "";
        subTopicInput.value = "";
        summaryInput.value = "";
        renderLessonCoverage();
      } catch (error) {
        result.textContent = "Could not save lesson coverage.";
        result.style.color = "#bb2222";
      }
    }

    function renderStudents(persistChanges = true) {
      renderLessonCoverage();
      const list = document.getElementById("studentList");
      const selectedSummaryStudent = document.getElementById("summaryStudentSelect").value;
      const selectedHistoryStudent = document.getElementById("historyStudentSelect").value;

      list.innerHTML = students.length ? students.map((student, index) => {
        const todayStatus = getStudentTodayStatus(student);
        const toggleLabel = todayStatus.isMarked
          ? `Mark ${todayStatus.label === "Present" ? "Absent" : "Present"}`
          : "Mark Present";
        return `
          <div class="student">
            <div class="student-identity" role="button" tabindex="0" onclick="openStudentProfile(${index})" onkeydown="if (event.key === 'Enter' || event.key === ' ') openStudentProfile(${index})">
              <img class="student-profile-image" src="${getStudentAvatar(student)}" alt="${student.name} profile image" />
              <div>
              <strong>${student.name}</strong>
              <small>${student.course} · ${escapeMagazineText(student.unit || "Unit not assigned")}</small>
              </div>
            </div>
            <div>
              <span class="status ${todayStatus.className}">
                ${todayStatus.label}
              </span>
              <button type="button" onclick="toggleAttendance(${index})">
                ${toggleLabel}
              </button>
            </div>
          </div>
        `;
      }).join("") : '<p class="empty-state">No students in this course yet. Add students in Today\'s Attendance.</p>';

      const present = students.filter(student => student.present).length;
      document.getElementById("totalStudents").textContent = students.length;
      document.getElementById("headerStudentCount").textContent = students.length;
      document.getElementById("presentCount").textContent = present;
      document.getElementById("attendanceRate").textContent =
        (students.length ? Math.round((present / students.length) * 100) : 0) + "%";

      renderClassAttendanceOverview();

      const studentRosterList = document.getElementById("studentRosterList");
      if (studentRosterList) {
        studentRosterList.innerHTML = students.length ? `
          <table class="student-roster-table" aria-label="Student roster table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Admission No.</th>
                <th>Course</th>
                <th>Unit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${students.map((student, index) => `
                <tr>
                  <td>
                    <div class="student-roster-identity">
                      <img class="student-roster-photo" src="${escapeMagazineText(getStudentAvatar(student))}" alt="${escapeMagazineText(student.name)} profile photo" />
                      <span>${escapeMagazineText(student.name)}</span>
                    </div>
                  </td>
                  <td>${student.admissionNumber || "N/A"}</td>
                  <td>${student.course}</td>
                  <td>
                    <select
                      aria-label="Unit for ${escapeMagazineText(student.name)}"
                      onchange="updateStudentUnit(${index}, this)"
                    >
                      <option value="" ${student.unit ? "" : "selected"}>Assign unit</option>
                      ${(classUnits[activeClassName] || []).map(unit => `
                        <option value="${escapeMagazineText(unit)}" ${student.unit === unit ? "selected" : ""}>
                          ${escapeMagazineText(unit)}
                        </option>
                      `).join("")}
                    </select>
                  </td>
                  <td>
                    <span class="student-roster-status status ${student.present ? "present" : "absent"}">
                      ${student.present ? "Present" : "Absent"}
                    </span>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : '<p class="empty-state">No students in this course yet.</p>';
      }

      const studentSelect = document.getElementById("studentSelect");
      if (studentSelect) {
        studentSelect.innerHTML = students.length
          ? students.map(student => `<option>${student.name}</option>`).join("")
          : '<option value="">No students in this course</option>';
      }

      const summaryStudentSelect = document.getElementById("summaryStudentSelect");
      summaryStudentSelect.innerHTML = students.length
        ? students.map((student, index) => `<option value="${index}">${student.name}</option>`).join("")
        : '<option value="">No students in this course</option>';
      summaryStudentSelect.disabled = students.length === 0;
      summaryStudentSelect.value = selectedSummaryStudent || "0";
      renderAttendanceSummary();

      const historyStudentSelect = document.getElementById("historyStudentSelect");
      historyStudentSelect.innerHTML = students.length
        ? students.map((student, index) => `<option value="${index}">${student.name}</option>`).join("")
        : '<option value="">No students in this course</option>';
      historyStudentSelect.disabled = students.length === 0;
      historyStudentSelect.value = selectedHistoryStudent || "0";
      renderAttendanceHistory();
      renderBulkAttendance();
      renderAbsentTraineeList();
      if (persistChanges) saveTeacherClasses();
    }

    function toggleAttendance(index) {
      const present = !students[index].present;
      students[index].lessons.forEach(lesson => lesson.present = present);
      students[index].present = present;
      updateTodayHistory(students[index]);
      renderStudents();
    }

    function addStudent(event) {
      event.preventDefault();

      const nameInput = document.getElementById("newStudentName");
      const admissionNumberInput = document.getElementById("newStudentAdmissionNumber");
      const courseInput = document.getElementById("newStudentCourse");
      const unitInput = document.getElementById("newStudentUnit");
      const result = document.getElementById("addStudentResult");
      const name = nameInput.value.trim();
      const admissionNumber = admissionNumberInput.value.trim();
      const course = courseInput.value.trim();
      const selectedUnit = unitInput.value.trim();
      const unit = (classUnits[activeClassName] || []).find(
        existing => existing.toLowerCase() === selectedUnit.toLowerCase()
      ) || "";

      if (!course || !unit) {
        result.textContent = "Enter the course and select a unit added in Course settings.";
        result.style.color = "#bb2222";
        return;
      }

      if (students.some(student => student.name.toLowerCase() === name.toLowerCase())) {
        result.textContent = "That student is already on the list.";
        result.style.color = "#bb2222";
        return;
      }

      if (students.some(student => student.admissionNumber?.toLowerCase() === admissionNumber.toLowerCase())) {
        result.textContent = "That admission number is already in use.";
        result.style.color = "#bb2222";
        return;
      }

      students.push({
        name,
        course,
        unit,
        admissionNumber,
        present: false,
        lessons: createLessons(false, false, false),
        history: []
      });
      renderStudents(false);
      if (!saveTeacherClasses()) {
        students.pop();
        renderStudents(false);
        result.textContent = "The trainee was not saved. Check available storage and try again.";
        result.style.color = "#bb2222";
        return;
      }

      nameInput.value = "";
      admissionNumberInput.value = "";
      unitInput.value = "";
      result.textContent = `${name} was added to the course and saved.`;
      result.style.color = "#14833b";
    }

    function updateStudentUnit(index, input) {
      const student = students[index];
      if (!student) return;

      const selectedUnit = input.value.trim();
      const unit = (classUnits[activeClassName] || []).find(
        existing => existing.toLowerCase() === selectedUnit.toLowerCase()
      ) || "";
      const result = document.getElementById("studentRosterResult");
      if (!unit) {
        input.value = student.unit || "";
        result.textContent = "Select a unit added in Course settings.";
        result.style.color = "#bb2222";
        return;
      }

      const previousUnit = student.unit;
      student.unit = unit;
      input.value = unit;
      if (!saveTeacherClasses()) {
        student.unit = previousUnit;
        input.value = previousUnit || "";
        return;
      }
      result.textContent = `${student.name}'s unit was saved.`;
      result.style.color = "#14833b";
    }

    function deleteViewedStudent() {
      if (currentRole !== "teacher" || students.length === 1) return;

      const student = students[viewedStudentIndex];
      if (!student || !window.confirm(`Delete ${student.name} from the system?`)) return;

      students.splice(viewedStudentIndex, 1);
      viewedStudentIndex = -1;
      closeImageViewer();
      renderStudents();
    }

    function renderAttendanceSummary() {
      const selectedIndex = Number(document.getElementById("summaryStudentSelect").value || 0);
      const student = students[selectedIndex];
      const summary = document.getElementById("attendanceSummary");
      if (!student) {
        summary.innerHTML = '<p class="empty-state">Add students to this course to view attendance summaries.</p>';
        return;
      }
      const attendedLessons = student.lessons.filter(lesson => lesson.present).length;
      const totalLessons = student.lessons.length;
      const rate = Math.round((attendedLessons / totalLessons) * 100);
      const allLessonsAttended = attendedLessons === totalLessons;

      summary.innerHTML = `
        <strong>${student.name}</strong>
        <small>${student.course} · ${escapeMagazineText(student.unit || "Unit not assigned")}</small>
        <div class="summary-details">
          <div class="summary-item">
            <small>Lessons attended</small>
            <strong>${attendedLessons} of ${totalLessons}</strong>
          </div>
          <div class="summary-item">
            <small>Lessons missed</small>
            <strong>${totalLessons - attendedLessons}</strong>
          </div>
          <div class="summary-item">
            <small>Attendance rate</small>
            <strong>${rate}%</strong>
          </div>
        </div>
        <div class="lesson-list">
          <strong>Today's lessons</strong>
          ${student.lessons.map((lesson, lessonIndex) => `
            <div class="lesson-row">
              <span>${lesson.name}</span>
              <button type="button" onclick="toggleLessonAttendance(${selectedIndex}, ${lessonIndex})">
                ${lesson.present ? "Attended" : "Mark attended"}
              </button>
            </div>
          `).join("")}
        </div>
        <div class="all-lessons ${allLessonsAttended ? "complete" : "incomplete"}">
          ${allLessonsAttended
            ? "All lessons attended"
            : `${totalLessons - attendedLessons} lesson${totalLessons - attendedLessons === 1 ? "" : "s"} still need${totalLessons - attendedLessons === 1 ? "s" : ""} attendance`}
        </div>
      `;
    }

    function toggleLessonAttendance(studentIndex, lessonIndex) {
      const student = students[studentIndex];
      student.lessons[lessonIndex].present = !student.lessons[lessonIndex].present;
      student.present = student.lessons.every(lesson => lesson.present);
      updateTodayHistory(student);
      renderStudents();
      document.getElementById("summaryStudentSelect").value = studentIndex;
      renderAttendanceSummary();
    }

    function updateTodayHistory(student) {
      const attendedLessons = student.lessons.filter(lesson => lesson.present).length;
      updateAttendanceForDates(student, [formatLocalDate(new Date())], attendedLessons);
    }

    function updateAttendanceForDates(student, dates, attended) {
      dates.forEach(date => {
        let record = student.history.find(item => item.date === date);

        if (!record) {
          record = { date, attended: 0, total: student.lessons.length };
          student.history.unshift(record);
        }

        record.total = student.lessons.length;
        record.attended = typeof attended === "number" ? attended : (attended ? record.total : 0);
      });

      const todayKey = getTodayKey();
      const todayRecord = student.history.find(item => item.date === todayKey);
      if (todayRecord) {
        student.present = todayRecord.attended === todayRecord.total;
      } else {
        student.present = false;
      }
    }

    function renderBulkAttendance() {
      const dateInput = document.getElementById("bulkDate");
      if (!dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
      }

      document.getElementById("bulkStudentList").innerHTML = students.length ? students.map((student, index) => `
        <label class="bulk-student">
          <input type="checkbox" value="${index}" />
          <img class="student-profile-image" src="${getStudentAvatar(student)}" alt="${student.name} profile image" />
          <span role="button" tabindex="0" onclick="openStudentProfile(${index})" onkeydown="if (event.key === 'Enter' || event.key === ' ') openStudentProfile(${index})">
            <img class="student-profile-image" src="${getStudentAvatar(student)}" alt="${student.name} profile image" />
            ${student.name}
          </span>
        </label>
      `).join("") : '<p class="empty-state">Add students to this course before marking attendance.</p>';
    }

    function markAllStudentsPresent() {
      const result = document.getElementById("bulkResult");
      const today = getTodayKey();

      students.forEach(student => {
        student.lessons = Array.from({ length: lessonsPerDay }, (_, index) => ({
          name: `Lesson ${index + 1}`,
          present: true
        }));
        student.present = true;
        updateAttendanceForDates(student, [today], student.lessons.length);
      });

      result.textContent = "All trainees were marked present for today.";
      result.style.color = "#14833b";
      renderStudents();
    }

    function addAbsentTrainee(event) {
      event.preventDefault();
      const admissionInput = document.getElementById("absentTraineeAdmissions");
      const result = document.getElementById("absentTraineeResult");
      const admissionNumbers = [...new Set(
        admissionInput.value
          .split(/[\r\n,;]+/)
          .map(value => value.trim().toLowerCase())
          .filter(Boolean)
      )];

      if (!admissionNumbers.length) {
        result.textContent = "Enter at least one admission number.";
        result.style.color = "#bb2222";
        return;
      }

      const matchedStudents = admissionNumbers.map(admissionNumber =>
        students.find(student =>
          student.admissionNumber && student.admissionNumber.trim().toLowerCase() === admissionNumber
        )
      );
      const unmatchedAdmissions = admissionNumbers.filter((_, index) => !matchedStudents[index]);

      if (unmatchedAdmissions.length) {
        result.textContent = `No trainees were marked. Admission number(s) not found in this course: ${unmatchedAdmissions.join(", ")}.`;
        result.style.color = "#bb2222";
        return;
      }

      matchedStudents.forEach(student => {
        student.lessons = Array.from({ length: lessonsPerDay }, (_, index) => ({
          name: `Lesson ${index + 1}`,
          present: false
        }));
        student.present = false;
        updateAttendanceForDates(student, [getTodayKey()], 0);
      });

      admissionInput.value = "";
      result.textContent = `${matchedStudents.length} trainee${matchedStudents.length === 1 ? "" : "s"} marked absent.`;
      result.style.color = "#14833b";
      renderStudents();
      renderAbsentTraineeList();
    }

    function renderAbsentTraineeList() {
      const list = document.getElementById("absentTraineeList");
      if (!list) return;

      const absentStudents = students.filter(student => {
        const todayKey = getTodayKey();
        const todayRecord = student.history.find(item => item.date === todayKey);
        return todayRecord ? todayRecord.attended < todayRecord.total : false;
      });

      if (!absentStudents.length) {
        list.innerHTML = '<p class="empty-state">No absent trainees marked today.</p>';
        return;
      }

      list.innerHTML = `
        <div class="absent-trainee-table-wrap">
          <table class="absent-trainee-table" aria-label="Absent trainees table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Admission No.</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${absentStudents.map(student => `
                <tr>
                  <td>${student.name}</td>
                  <td>${student.admissionNumber || "N/A"}</td>
                  <td><span class="status absent">Absent</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    function markSelectedAttendance(attended) {
      const selectedStudents = Array.from(document.querySelectorAll("#bulkStudentList input:checked"));
      const dateInput = document.getElementById("bulkDate");
      const period = document.getElementById("bulkPeriodSelect").value;
      const result = document.getElementById("bulkResult");

      if (!selectedStudents.length) {
        result.textContent = "Select at least one student first.";
        result.style.color = "#bb2222";
        return;
      }

      const selectedDate = new Date(`${dateInput.value}T00:00:00`);
      const dates = [];
      const numberOfDays = period === "week" ? 7 : 1;

      for (let day = 0; day < numberOfDays; day++) {
        const date = new Date(selectedDate);
        date.setDate(selectedDate.getDate() - day);
        dates.push(formatLocalDate(date));
      }

      selectedStudents.forEach(checkbox => {
        const student = students[Number(checkbox.value)];
        updateAttendanceForDates(student, dates, attended);
        if (dates.includes(formatLocalDate(new Date()))) {
          student.lessons.forEach(lesson => lesson.present = attended);
          student.present = attended;
        }
      });

      result.textContent = `${selectedStudents.length} student${selectedStudents.length === 1 ? "" : "s"} updated.`;
      result.style.color = "#14833b";
      renderStudents();
      renderAbsentTraineeList();
    }

    function renderAttendanceHistory() {
      const studentIndex = Number(document.getElementById("historyStudentSelect").value || 0);
      const period = document.getElementById("historyPeriodSelect").value;
      const student = students[studentIndex];
      if (!student) {
        document.getElementById("attendanceHistory").innerHTML = '<p class="empty-state">Add students to this course to view attendance history.</p>';
        return;
      }
      const dateInput = document.getElementById("historyDate");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateInput.max = formatLocalDate(today);
      if (!dateInput.value) dateInput.value = formatLocalDate(today);
      const selectedDate = dateInput.value;
      const selectedRecord = student.history.find(record => record.date === selectedDate);
      const selectedLessonsValue = selectedRecord ? selectedRecord.attended : 0;
      const selectedDayStatus = selectedRecord
        ? (selectedRecord.attended === 0 ? "Absent" : "Marked")
        : "Not marked";
      const daysByPeriod = { week: 7, month: 30, threeMonths: 90, year: 365 };
      const records = student.history.slice(0, daysByPeriod[period]);
      const attendedLessons = records.reduce((total, record) => total + record.attended, 0);
      const totalLessons = records.reduce((total, record) => total + record.total, 0);
      const attendanceRate = Math.round((attendedLessons / totalLessons) * 100);
      const fullyAttendedDays = records.filter(record => record.attended === record.total).length;

      document.getElementById("attendanceHistory").innerHTML = `
        <div class="history-day-editor">
          <label for="historyAttendedInput">Lessons attended on ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString()}</label>
          <input id="historyAttendedInput" type="number" min="0" max="${student.lessons.length}" step="1" value="${selectedLessonsValue}" placeholder="${selectedRecord ? "0" : "Not marked"}" />
          <button type="button" onclick="saveHistoricalAttendance()">Save attendance</button>
          <p id="historyEditResult" class="settings-result" aria-live="polite">${selectedDayStatus}</p>
        </div>
        <div class="history-summary">
          <div class="summary-item"><small>Attendance rate</small><strong>${attendanceRate}%</strong></div>
          <div class="summary-item"><small>Lessons attended</small><strong>${attendedLessons} / ${totalLessons}</strong></div>
          <div class="summary-item"><small>Fully attended days</small><strong>${fullyAttendedDays} / ${records.length}</strong></div>
        </div>
        <table class="history-table">
          <thead><tr><th>Date</th><th>Lessons attended</th><th>Status</th></tr></thead>
          <tbody>
            ${records.map(record => `
              <tr>
                <td>${new Date(`${record.date}T00:00:00`).toLocaleDateString()}</td>
                <td>${record.attended} of ${record.total}</td>
                <td><span class="status ${record.attended === record.total ? "present" : "absent"}">
                  ${record.attended === record.total ? "All attended" : (record.attended === 0 ? "Absent" : "Incomplete")}
                </span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    function changeHistoryDate(offset) {
      const dateInput = document.getElementById("historyDate");
      const selectedDate = dateInput.value
        ? new Date(`${dateInput.value}T00:00:00`)
        : new Date();
      selectedDate.setDate(selectedDate.getDate() + offset);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate > today) selectedDate.setTime(today.getTime());

      dateInput.value = formatLocalDate(selectedDate);
      renderAttendanceHistory();
    }

    function saveHistoricalAttendance() {
      const studentIndex = Number(document.getElementById("historyStudentSelect").value || 0);
      const student = students[studentIndex];
      const selectedDate = document.getElementById("historyDate").value;
      const attendedInput = document.getElementById("historyAttendedInput");
      const attended = Number(attendedInput.value);
      const result = document.getElementById("historyEditResult");

      if (!selectedDate || !Number.isInteger(attended) || attended < 0 || attended > student.lessons.length) {
        result.textContent = `Enter a whole number from 0 to ${student.lessons.length}.`;
        result.style.color = "#bb2222";
        return;
      }

      updateAttendanceForDates(student, [selectedDate], attended);
      if (selectedDate === formatLocalDate(new Date())) {
        student.lessons.forEach((lesson, index) => lesson.present = index < attended);
        student.present = attended === student.lessons.length;
      }

      renderStudents();
      const updatedResult = document.getElementById("historyEditResult");
      updatedResult.textContent = "Attendance updated.";
      updatedResult.style.color = "#14833b";
    }

    function sendNote() {
      const student = document.getElementById("studentSelect").value;
      const message = document.getElementById("message").value.trim();
      const result = document.getElementById("sendResult");

      if (!message) {
        result.textContent = "Please write a message first.";
        result.style.color = "#bb2222";
        return;
      }

      const note = document.createElement("div");
      note.className = "note";
      note.innerHTML = `
        <strong>New note from teacher</strong>
        <p>${message}</p>
        <small>Just now</small>
      `;

      document.getElementById("notes").prepend(note);
      document.getElementById("message").value = "";
      result.textContent = `Note sent to ${student}.`;
      result.style.color = "#14833b";
      document.getElementById("noteCount").textContent =
        Number(document.getElementById("noteCount").textContent) + 1;
    }