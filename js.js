const $ = id => document.getElementById(id);

const STORAGE_USERS   = "studentSpaceUsers";
const STORAGE_POSTS   = "studentSpacePosts";
const STORAGE_CURRENT = "studentSpaceCurrent";

const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
};

const uid = () =>
  (window.crypto && typeof crypto.randomUUID === "function")
    ? crypto.randomUUID()
    : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

let users   = load(STORAGE_USERS, []);
let posts   = load(STORAGE_POSTS, []);
let current = load(STORAGE_CURRENT, null);

if (current && !users.some(u => u.id === current.id)) current = null;

const save = () => {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
  localStorage.setItem(STORAGE_CURRENT, JSON.stringify(current));
};

const initials = name =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase();

const fmtDate = ts => new Date(ts).toLocaleString("ru-RU", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
});

function setMessage(text, isError) {
  const el = $("accountMessage");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("msg-error", !!isError);
}

function avatar(el, user) {
  el.innerHTML = "";
  if (user && user.avatar) {
    const img = document.createElement("img");
    img.src = user.avatar;
    img.alt = "Аватар";
    img.onerror = () => { el.textContent = initials(user.name); };
    el.appendChild(img);
  } else {
    el.textContent = initials(user?.name || "?");
  }
}

function renderProfile() {
  const name = current?.name || "Гость";
  $("sideName").textContent = name;
  $("sideGroup").textContent = current?.group || "Студент ПК МУКР";
  avatar($("sideAvatar"), current);
  avatar($("headerAvatar"), current);

  const myPosts = posts.filter(p => p.authorId === current?.id);
  $("postCount").textContent = myPosts.length;
  $("likeCount").textContent = myPosts.reduce((n, p) => n + (p.likes?.length || 0), 0);

  if (document.activeElement !== $("username"))  $("username").value  = current?.name   || "";
  if (document.activeElement !== $("group"))     $("group").value     = current?.group  || "";
  if (document.activeElement !== $("avatarUrl")) $("avatarUrl").value = current?.avatar || "";

  $("logoutBtn").style.display = current ? "block" : "none";

  setMessage(
    current ? `Вы вошли как ${current.name}.` : "Данные демо-аккаунта сохраняются только в этом браузере.",
    false
  );
}

function renderPosts() {
  const host = $("posts");
  host.innerHTML = "";

  if (!posts.length) {
    host.innerHTML = '<div class="empty">Пока публикаций нет. Стань первым — расскажи что-нибудь!</div>';
    return;
  }

  [...posts].sort((a, b) => b.createdAt - a.createdAt).forEach(post => {
    if (!Array.isArray(post.likes))    post.likes = [];
    if (!Array.isArray(post.comments)) post.comments = [];

    const author = users.find(u => u.id === post.authorId) || { name: "Студент", group: "ПК МУКР" };

    const item = document.createElement("article");
    item.className = "post";

    /* --- шапка поста --- */
    const head = document.createElement("div");
    head.className = "post-head";

    const av = document.createElement("div");
    av.className = "avatar post-avatar";
    avatar(av, author);

    const who  = document.createElement("div");
    const nm   = document.createElement("div");
    nm.className = "post-author";
    nm.textContent = author.name;
    const meta = document.createElement("div");
    meta.className = "post-meta";
    meta.textContent = `${author.group || "ПК МУКР"} · ${fmtDate(post.createdAt)}`;
    who.append(nm, meta);
    head.append(av, who);

    /* удалить свой пост */
    if (current && post.authorId === current.id) {
      const del = document.createElement("button");
      del.className = "post-del";
      del.type = "button";
      del.textContent = "✕";
      del.title = "Удалить публикацию";
      del.onclick = () => {
        if (confirm("Удалить эту публикацию?")) {
          posts = posts.filter(p => p.id !== post.id);
          save();
          renderAll();
        }
      };
      head.append(del);
    }

    /* --- текст поста --- */
    const body = document.createElement("p");
    body.className = "post-body";
    body.textContent = post.text;

    /* --- действия: лайк + счётчики --- */
    const liked = !!current && post.likes.includes(current.id);

    const actions = document.createElement("div");
    actions.className = "post-actions";

    const like = document.createElement("button");
    like.className = "like-btn" + (liked ? " liked" : "");
    like.textContent = (liked ? "♥" : "♡") + " Нравится";
    like.onclick = () => {
      if (!current) { setMessage("Сначала войди или создай аккаунт.", true); return; }
      post.likes = post.likes.includes(current.id)
        ? post.likes.filter(id => id !== current.id)
        : [...post.likes, current.id];
      save();
      renderAll();
    };

    const likeCount = document.createElement("span");
    likeCount.className = "post-likes";
    likeCount.textContent = `${post.likes.length} лайков`;

    const commentCount = document.createElement("span");
    commentCount.className = "post-likes";
    commentCount.textContent = `💬 ${post.comments.length}`;

    actions.append(like, likeCount, commentCount);

    /* --- комментарии --- */
    const comments = document.createElement("div");
    comments.className = "comments";

    if (!post.comments.length) {
      const empty = document.createElement("div");
      empty.className = "comments-empty";
      empty.textContent = "Комментариев пока нет — напиши первым.";
      comments.append(empty);
    } else {
      [...post.comments].sort((a, b) => a.createdAt - b.createdAt).forEach(c => {
        const cAuthor = users.find(u => u.id === c.authorId) || { name: "Студент" };

        const row = document.createElement("div");
        row.className = "comment";

        const cav = document.createElement("div");
        cav.className = "avatar";
        avatar(cav, cAuthor);

        const cbody = document.createElement("div");
        cbody.className = "comment-body";

        const cauthor = document.createElement("div");
        cauthor.className = "comment-author";
        cauthor.textContent = cAuthor.name;

        const ctext = document.createElement("div");
        ctext.className = "comment-text";
        ctext.textContent = c.text;

        const cmeta = document.createElement("div");
        cmeta.className = "comment-meta";
        const cdate = document.createElement("span");
        cdate.textContent = fmtDate(c.createdAt);
        cmeta.append(cdate);

        if (current && c.authorId === current.id) {
          const cdel = document.createElement("button");
          cdel.className = "comment-del";
          cdel.type = "button";
          cdel.textContent = "удалить";
          cdel.onclick = () => {
            post.comments = post.comments.filter(x => x.id !== c.id);
            save();
            renderPosts();
          };
          cmeta.append(cdel);
        }

        cbody.append(cauthor, ctext, cmeta);
        row.append(cav, cbody);
        comments.append(row);
      });
    }

    /* --- форма добавления комментария --- */
    const form = document.createElement("div");
    form.className = "comment-form";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = current ? "Написать комментарий..." : "Войди, чтобы комментировать";
    input.disabled = !current;

    const sendBtn = document.createElement("button");
    sendBtn.className = "primary";
    sendBtn.type = "button";
    sendBtn.textContent = "Отправить";

    const submitComment = () => {
      if (!current) { setMessage("Сначала войди или создай аккаунт.", true); return; }
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      post.comments.push({ id: uid(), authorId: current.id, text, createdAt: Date.now() });
      save();
      renderPosts();
    };

    sendBtn.onclick = submitComment;
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); submitComment(); }
    });

    form.append(input, sendBtn);
    comments.append(form);

    item.append(head, body, actions, comments);
    host.append(item);
  });
}

/* ---------------- Рейтинг ---------------- */
function renderLeaderboard() {
  const scores = users
    .map(u => ({
      user: u,
      score: posts.filter(p => p.authorId === u.id).reduce((n, p) => n + (p.likes?.length || 0), 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const host = $("leaderboard");
  host.innerHTML = "";

  if (!scores.length) {
    host.innerHTML = '<p class="tiny muted">Здесь появятся активные студенты.</p>';
    return;
  }

  scores.forEach((entry, i) => {
    const row = document.createElement("div");
    row.className = "leader";

    const av = document.createElement("div");
    av.className = "avatar";
    avatar(av, entry.user);

    const name = document.createElement("span");
    name.className = "leader-name";
    name.textContent = `${i + 1}. ${entry.user.name}`;

    const score = document.createElement("span");
    score.className = "leader-score";
    score.textContent = `★ ${entry.score}`;

    row.append(av, name, score);
    host.append(row);
  });
}

/* ---------------- Вход / Регистрация ---------------- */
$("loginBtn").addEventListener("click", () => {
  const name      = $("username").value.trim();
  const group     = $("group").value.trim() || "ПК МУКР";
  const avatarUrl = $("avatarUrl").value.trim();
  const password  = $("password").value;

  if (!name) {
    setMessage("Введи своё имя.", true);
    return;
  }
  if (password.length < 4) {
    setMessage("Пароль должен быть не короче 4 символов.", true);
    return;
  }
  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
    setMessage("Для аватара нужна ссылка, начинающаяся с http:// или https://", true);
    return;
  }

  /* ищем аккаунт по имени + группе */
  let user = users.find(u =>
    u.name.toLowerCase() === name.toLowerCase() && u.group === group
  );

  if (!user) {
    /* регистрация */
    user = { id: uid(), name, group, avatar: avatarUrl, password };
    users.push(user);
    setMessage(`Аккаунт создан. Добро пожаловать, ${name}!`);
  } else {
    /* вход — проверяем пароль */
    if (user.password && user.password !== password) {
      setMessage("Неверный пароль для этого аккаунта.", true);
      return;
    }
    user.password = password;              /* миграция старых аккаунтов без пароля */
    user.avatar = avatarUrl || user.avatar;
    setMessage(`С возвращением, ${name}!`);
  }

  current = user;
  save();
  $("password").value = "";
  renderAll();
});

/* ---------------- Выход ---------------- */
$("logoutBtn").addEventListener("click", () => {
  current = null;
  save();
  renderAll();
});

/* ---------------- Публикация поста ---------------- */
$("publishBtn").addEventListener("click", () => {
  if (!current) {
    setMessage("Сначала войди или создай аккаунт справа.", true);
    return;
  }
  const text = $("postText").value.trim();
  if (!text) {
    setMessage("Напиши текст публикации.", true);
    return;
  }
  posts.push({
    id: uid(),
    authorId: current.id,
    text,
    createdAt: Date.now(),
    likes: [],
    comments: []
  });
  $("postText").value = "";
  save();
  renderAll();
});

/* ---------------- Клик по аватару в шапке ---------------- */
$("headerAvatar").addEventListener("click", () => {
  $("accountPanel").scrollIntoView({ behavior: "smooth", block: "center" });
  if (!current) $("username").focus();
});

/* ---------------- Общий рендер ---------------- */
function renderAll() {
  renderProfile();
  renderPosts();
  renderLeaderboard();
}

renderAll();
