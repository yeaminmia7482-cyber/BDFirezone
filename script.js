(function () {
    function openBdfzNotice() {
        var overlay = document.getElementById('bdfz-notice-overlay');
        if (overlay) overlay.classList.add('show');
    }
    function closeBdfzNotice() {
        var overlay = document.getElementById('bdfz-notice-overlay');
        if (overlay) overlay.classList.remove('show');
    }

    document.addEventListener('DOMContentLoaded', function () {
        var closeBtn = document.getElementById('bdfz-notice-close');
        if (closeBtn) closeBtn.addEventListener('click', closeBdfzNotice);

        var overlay = document.getElementById('bdfz-notice-overlay');
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) closeBdfzNotice();
            });
        }

        // Show the notice when the app opens.
        setTimeout(openBdfzNotice, 350);
    });

    window.openBdfzNotice = openBdfzNotice;
    window.closeBdfzNotice = closeBdfzNotice;
})();

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
        import { getDatabase, ref, set, onValue, push, update, get, query, orderByChild, equalTo, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
        import { getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

        // CONFIG
  const firebaseConfig = {
  apiKey: "AIzaSyDWQdXk35sg-GsNAq87OO91GfIQdXCW7Y4",
  authDomain: "firetourbd-233f4.firebaseapp.com",
  databaseURL: "https://firetourbd-233f4-default-rtdb.firebaseio.com",
  projectId: "firetourbd-233f4",
  storageBucket: "firetourbd-233f4.firebasestorage.app",
  messagingSenderId: "516867408815",
  appId: "1:516867408815:web:872f6dcdff44db2389255a"
};

        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);

        // --- THEME LOGIC ---
        window.toggleUserTheme = () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('userTheme', isDark ? 'dark' : 'light');
            updateUserThemeIcon(isDark);
        }


        let auth;
        // Android WebView compatibility: prefer IndexedDB/local persistence,
        // then safely fall back to the normal Firebase Auth instance.
        try {
            auth = initializeAuth(app, {
                persistence: [indexedDBLocalPersistence, browserLocalPersistence]
            });
        } catch (e) {
            auth = getAuth(app);
        }
        const provider = new GoogleAuthProvider();
        let currentUser = null;

        let depositBal = 0;
        let winningBal = 0;
        let currentJoinMatchId = null;
        let currentJoinFee = 0;
        let currentActiveCategory = null;
        const telegramJoinLink = "https://t.me/bd_fire_zone";
        const supportLink = "https://t.me/Bdfirezone_support";

        // --- GLOBAL DATA HOLDERS ---
        let rawMatches = [];
        let activeCategories = {};
        let timerInterval = null;
        let appSettings = {}; // To hold all app settings
        let myJoinedMatchIds = new Set(); // real join records from match_participants
        let myJoinedNamesByMatch = {};
        let currentMyMatchTab = 'upcoming';

        /* --- INITIALIZATION --- */
        function bootApp() {
            if (window.__bdfzBooted) return;
            window.__bdfzBooted = true;
            initAppSettings();
            initCategories();
            initMatchesListener();
            initNotifications();
            initBanners();
            initMyMatchesListener();
        }

        // Works reliably in Android WebView as well as normal browsers.
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bootApp, { once: true });
        } else {
            bootApp();
        }

        /* --- 1. SETTINGS & SUPPORT (UPDATED FOR AUTO PAY) --- */
        function initAppSettings() {
            const settingsRef = ref(db, 'app_settings');
            onValue(settingsRef, (snap) => {
                const data = snap.val();
                if (data) {
                    appSettings = data; // Store all settings globally
                    
                    // Support link is fixed for BDFireZone.
                    if (data.min_deposit) document.getElementById('add-amount-input').placeholder = `Minimum ${data.min_deposit} BDT`;

                    // Dynamic Notice
                    if (data.notice) { const el = document.getElementById('dynamic-notice'); if (el) el.innerText = data.notice; }

                    // Dynamic Payment Numbers for manual
                    if (data.bkash_number) document.getElementById('disp-bkash-num').value = data.bkash_number;

                    // Dynamic App Info
                    if (data.app_name) document.getElementById('header-app-name').innerText = data.app_name;
                    if (data.app_icon) {
                        const icons = [document.getElementById('header-app-icon'), document.getElementById('login-app-icon'), document.getElementById('reg-app-icon')];
                        icons.forEach(i => i.src = data.app_icon);
                        document.getElementById('header-app-icon').style.display = 'block';
                    }
                    
                    // Toggle UI based on Auto Pay status
                    togglePaymentModeUI(data.auto_pay_enabled);
                }
            });
        }
        
        function togglePaymentModeUI(isEnabled) {
            const autoSection = document.getElementById('auto-pay-section');
            const manualSection = document.getElementById('manual-pay-section');
            if (!autoSection || !manualSection) return;
            const enabled = isEnabled === true || String(isEnabled).toLowerCase() === 'true';
            if (enabled) {
                autoSection.classList.remove('hidden');
                autoSection.style.display = 'block';
                manualSection.classList.add('hidden');
                manualSection.style.display = 'none';
            } else {
                autoSection.classList.add('hidden');
                autoSection.style.display = 'none';
                manualSection.classList.remove('hidden');
                manualSection.style.display = 'block';
            }
        }


        window.openTelegram = () => window.open(telegramJoinLink, "_blank");
        window.openSupport = () => window.open(supportLink, "_blank");

        /* --- 2. DYNAMIC SLIDER: fade + slow-zoom carousel with story-style progress bars --- */
        function initBanners() {
            const bannerRef = ref(db, 'banners');
            const wrapper = document.getElementById('banner-slider-wrapper');
            const progressContainer = document.getElementById('slider-progress');

            onValue(bannerRef, (snap) => {
                wrapper.innerHTML = "";
                progressContainer.innerHTML = "";
                const data = snap.val();
                if (data) {
                    const slides = Object.values(data);
                    slides.forEach((slide, i) => {
                        const div = document.createElement('div');
                        div.className = 'slide' + (i === 0 ? ' active' : '');
                        div.onclick = () => window.open(slide.link, '_blank');
                        div.innerHTML = `
                            <img src="${slide.img}">
                            ${slide.title ? `<div class="slide-caption">${slide.title}</div>` : ''}
                        `;
                        wrapper.appendChild(div);

                        if (slides.length > 1) {
                            const seg = document.createElement('div');
                            seg.className = 'slider-progress-seg';
                            seg.innerHTML = '<div class="slider-progress-seg-fill"></div>';
                            seg.onclick = (e) => { e.stopPropagation(); goToSlide(i); };
                            progressContainer.appendChild(seg);
                        }
                    });
                    startSlider(slides.length);
                } else {
                    // Fallback static
                    wrapper.innerHTML = `<div class="slide active"><img src="https://placehold.co/600x200?text=No+Banners"></div>`;
                }
            });
        }

        let sliderInterval;
        let sliderIndex = 0;
        let sliderCount = 0;

        function setActiveSlide(i) {
            document.querySelectorAll('#banner-slider-wrapper .slide').forEach((s, idx) => {
                s.classList.toggle('active', idx === i);
            });

            const segs = document.querySelectorAll('#slider-progress .slider-progress-seg');
            segs.forEach((seg, idx) => {
                seg.classList.remove('active', 'done');
                if (idx < i) seg.classList.add('done');
            });
            const activeSeg = segs[i];
            if (activeSeg) {
                // remove + reflow + re-add so the CSS width transition restarts every time
                activeSeg.classList.remove('active');
                void activeSeg.offsetWidth;
                activeSeg.classList.add('active');
            }
        }

        window.goToSlide = (i) => {
            sliderIndex = i;
            setActiveSlide(sliderIndex);
            startSlider(sliderCount); // reset the auto-rotate timer on manual interaction
        };

        function startSlider(count) {
            if (sliderInterval) clearInterval(sliderInterval);
            sliderCount = count;
            sliderIndex = 0;
            setActiveSlide(sliderIndex);

            sliderInterval = setInterval(() => {
                sliderIndex++;
                if (sliderIndex >= count) sliderIndex = 0;
                setActiveSlide(sliderIndex);
            }, 3500); // 3.5 Seconds per slide
        }

        /* --- 3. DYNAMIC CATEGORIES --- */
        function initCategories() {
            const catRef = ref(db, 'categories');
            const list = document.getElementById('dynamic-category-list');

            onValue(catRef, (snap) => {
                list.innerHTML = "";
                const data = snap.val();
                if (data) {
                    activeCategories = data;
                    Object.entries(data).forEach(([key, val]) => {
                        const html = `
                        <div class="game-card" onclick="openCategory('${key}')">
                            <div class="game-card-bg" style="background-image: url('${val.img}');"></div>
                            <div class="game-card-content">
                                <div class="game-info">
                                    <div class="game-title">${val.name}</div>
                                    <div class="match-count" id="count-${key}">Loading...</div>
                                </div>
                            </div>
                        </div>`;
                        list.innerHTML += html;
                    });
                    updateMatchCounts();
                } else {
                    list.innerHTML = "<div style='padding:20px; text-align:center;'>No Categories Found</div>";
                }
            });
        }

        /* --- 4. DYNAMIC MATCHES & COUNTS --- */
        function initMatchesListener() {
            const matchesRef = ref(db, 'matches');
            onValue(matchesRef, (snap) => {
                rawMatches = [];
                const data = snap.val();
                if (data) {
                    Object.entries(data).forEach(([key, val]) => {
                        rawMatches.push({ dbKey: key, ...val });
                    });
                }
                updateMatchCounts();
                if (document.getElementById('matches-view').classList.contains('active')) {
                    switchMatchTab(document.querySelector('.tab-btn.active').id.replace('tab-', ''));
                }
            });
        }

        function updateMatchCounts() {
            Object.keys(activeCategories).forEach(catKey => {
                const count = rawMatches.filter(m => m.categoryId === catKey && m.status !== 'Finished' && (m.total > m.joined)).length;
                const el = document.getElementById(`count-${catKey}`);
                if (el) el.innerText = `${count} Matches Available`;
            });
        }

        /* --- CATEGORY-SPECIFIC RULES (real data only, no hardcoded demo rules) --- */
        function renderCategoryRules() {
            const rulesList = document.getElementById('dynamic-rules-list');
            if (!rulesList) return;
            const rules = (activeCategories[currentActiveCategory] && activeCategories[currentActiveCategory].rules) || [];
            if (!rules.length) {
                rulesList.innerHTML = '<li><i class="fas fa-info-circle"></i> No Rules Available</li>';
            } else {
                rulesList.innerHTML = rules.map(r => `<li><i class="fas fa-check"></i> ${r}</li>`).join('');
            }
        }

        /* --- MY MATCH: real aggregation from match_participants, no fake data --- */
        function initMyMatchesListener() {
            const pRef = ref(db, 'match_participants');
            onValue(pRef, (snap) => {
                const data = snap.val() || {};
                myJoinedMatchIds = new Set();
                myJoinedNamesByMatch = {};
                if (currentUser) {
                    Object.entries(data).forEach(([matchId, players]) => {
                        const mine = Object.values(players || {}).filter(p => p.joinedBy === currentUser.uid);
                        if (mine.length) {
                            myJoinedMatchIds.add(String(matchId));
                            myJoinedNamesByMatch[matchId] = mine.map(p => p.ign);
                        }
                    });
                }
                updateTotalMatchStat();
                if (document.getElementById('my-matches').classList.contains('active')) {
                    switchMyMatchTab(currentMyMatchTab);
                }
            });
        }

        function updateTotalMatchStat() {
            const el = document.getElementById('profile-page-total-matches');
            if (el) el.innerText = myJoinedMatchIds.size;
        }

        window.switchMyMatchTab = (tab) => {
            currentMyMatchTab = tab;
            document.querySelectorAll('#my-matches .tab-btn').forEach(b => b.classList.remove('active'));
            const activeBtn = document.getElementById(`mm-tab-${tab}`);
            if (activeBtn) activeBtn.classList.add('active');

            const container = document.getElementById('my-matches-container');
            if (!currentUser) {
                container.innerHTML = "<div style='text-align:center; padding:30px; color:#999;'>Please login to see your matches.</div>";
                return;
            }

            const now = new Date().getTime();
            const mine = rawMatches.filter(m => myJoinedMatchIds.has(m.dbKey));

            let list = [];
            if (tab === 'upcoming') {
                list = mine.filter(m => m.status !== 'Finished' && (m.timestamp || 0) > now);
            } else if (tab === 'live') {
                list = mine.filter(m => m.status !== 'Finished' && (m.timestamp || 0) <= now);
            } else if (tab === 'completed') {
                list = mine.filter(m => m.status === 'Finished');
            } else if (tab === 'won' || tab === 'lost') {
                list = mine.filter(m => {
                    if (m.status !== 'Finished' || !m.results) return false;
                    const myNames = myJoinedNamesByMatch[m.dbKey] || [];
                    const myResults = m.results.filter(r => myNames.includes(r.name));
                    const won = myResults.some(r => (r.win || 0) > 0);
                    return tab === 'won' ? won : (myResults.length > 0 && !won);
                });
            }

            if (!list.length) {
                container.innerHTML = "<div style='text-align:center; padding:30px; color:#999;'>No matches in this list yet.</div>";
                return;
            }

            container.innerHTML = list.map(m => {
                const myNames = myJoinedNamesByMatch[m.dbKey] || [];
                const myResults = (m.results || []).filter(r => myNames.includes(r.name));
                const winAmount = myResults.reduce((sum, r) => sum + (r.win || 0), 0);
                let statusLabel = 'JOINED';
                if (m.status === 'Finished') {
                    statusLabel = winAmount > 0 ? 'WON' : 'LOST';
                } else if ((m.timestamp || 0) <= now) {
                    statusLabel = 'LIVE';
                }
                return `
                <div class="match-card">
                    <div class="m-header">
                        <div class="m-title-box">
                            <h3 class="m-title">${m.title}</h3>
                            <div class="m-time">${m.time || ''}</div>
                        </div>
                        <span class="stat-card-label" style="align-self:flex-start;">${statusLabel}</span>
                    </div>
                    <div class="m-status-row">
                        <span>Entry: ৳${m.entry}</span>
                        <span>${winAmount > 0 ? 'Winning: ৳' + winAmount : ''}</span>
                    </div>
                    <div style="display:flex; gap:8px; margin-top:10px;">
                        <button class="btn-view-participants" onclick="openJoinedView('${m.dbKey}', '${m.title}')">View Joined</button>
                        ${m.status === 'Finished' ? `<button class="btn-view-result" onclick="openMatchResult('${m.dbKey}')">Result</button>` : `<button class="btn-room" onclick="checkRoomDetails('${m.dbKey}', '${m.room_id}', '${m.room_pass}')">ROOM ID</button>`}
                    </div>
                </div>`;
            }).join('');
        };

        /* --- 5. NOTIFICATIONS --- */
        function initNotifications() {
            const notifRef = ref(db, 'notifications');
            const container = document.getElementById('notif-list-container');
            const badge = document.getElementById('header-notif-badge');

            onValue(notifRef, (snap) => {
                container.innerHTML = "";
                const data = snap.val();
                if (data) {
                    const keys = Object.keys(data).reverse();
                    badge.style.display = 'flex';
                    badge.innerText = keys.length;

                    keys.forEach(key => {
                        const n = data[key];
                        container.innerHTML += `
                        <div class="notif-item">
                            <div class="notif-icon"><i class="fas fa-bell"></i></div>
                            <div class="notif-content">
                                <h5>${n.title}</h5>
                                <p>${n.body}</p>
                                <span style="font-size:9px; color:#999;">${n.date}</span>
                            </div>
                        </div>`;
                    });
                } else {
                    badge.style.display = 'none';
                    container.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">No notifications</div>';
                }
            });
        }

        /* --- AUTH LOGIC --- */
        window.googleLogin = () => {
            signInWithPopup(auth, provider).then((result) => {
                closeAuthPage();
                saveUserToDB(result.user, result.user.displayName, null);
            }).catch((error) => {
                alert("Google Sign-In Error: " + error.message);
                console.error(error);
            });
        };

        window.emailLogin = () => {
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-pass').value;
            if (!email || !pass) return alert("Please fill all fields");
            signInWithEmailAndPassword(auth, email, pass).then(() => {
                closeAuthPage();
            }).catch(e => showTopToast(e.message || "Join failed. Please try again.", false));
        };

        window.emailRegister = () => {
            const name = document.getElementById('reg-username').value;
            const phone = document.getElementById('reg-phone').value;
            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-pass').value;
            if (!name || !phone || !email || !pass) return alert("Please fill all fields");

            createUserWithEmailAndPassword(auth, email, pass).then((userCredential) => {
                const user = userCredential.user;
                updateProfile(user, { displayName: name }).then(() => {
                    saveUserToDB(user, name, phone);
                    closeAuthPage();
                });
            }).catch(e => showTopToast(e.message || "Join failed. Please try again.", false));
        };

        function saveUserToDB(user, name, phone) {
            const userRef = ref(db, 'users/' + user.uid);
            onValue(userRef, (snapshot) => {
                if (!snapshot.exists()) {
                    set(userRef, {
                        username: name || "User",
                        email: user.email,
                        phone: phone || "N/A",
                        deposit: 0,
                        winning: 0,
                        joined: new Date().toLocaleDateString()
                    });
                }
            }, { onlyOnce: true });
        }

        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = user;
                updateUIForLogin(user);
                loadHistory();
            } else {
                currentUser = null;
                depositBal = 0;
                winningBal = 0;
                updateUIForLogout();
            }
        });

        window.handleLogout = () => {
            signOut(auth).then(() => {
                toggleSidebar();
                navigate('home');
            });
        };

        function updateUIForLogin(user) {
            document.getElementById('auth-nav').style.display = 'none';
            document.getElementById('user-nav').style.display = 'flex';

            document.getElementById('sidebar-auth-btn').style.display = 'none';
            document.getElementById('menu-logout').classList.remove('hidden');
            document.getElementById('profile-menu-logout').classList.remove('hidden');

            document.getElementById('sidebar-name').innerText = user.displayName || "Gamer";
            document.getElementById('sidebar-email').innerText = user.email;
            if (user.photoURL) {
                document.getElementById('sidebar-avatar').src = user.photoURL;
                document.getElementById('header-avatar').src = user.photoURL;
            }

            const userRef = ref(db, 'users/' + user.uid);
            onValue(userRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    if (data.banned) {
                        alert("Your account has been banned by Admin.");
                        handleLogout();
                        return;
                    }
                    depositBal = data.deposit || 0;
                    winningBal = data.winning || 0;
                    const totalBal = depositBal + winningBal;

                    document.getElementById('header-balance').innerText = totalBal;
                    document.getElementById('profile-page-deposit').innerText = depositBal + " ৳";
                    document.getElementById('profile-page-winning').innerText = winningBal + " ৳";
                    document.getElementById('withdraw-available-display').innerText = winningBal + " ৳";

                    document.getElementById('profile-page-phone').innerText = data.phone;
                    document.getElementById('profile-page-name').innerText = data.username;
                    document.getElementById('profile-page-email').innerText = data.email;
                }
            });
        }

        function updateUIForLogout() {
            document.getElementById('auth-nav').style.display = 'flex';
            document.getElementById('user-nav').style.display = 'none';

            document.getElementById('sidebar-auth-btn').style.display = 'block';
            document.getElementById('menu-logout').classList.add('hidden');
            document.getElementById('profile-menu-logout').classList.add('hidden');

            document.getElementById('sidebar-name').innerText = "Guest User";
            document.getElementById('sidebar-email').innerText = "Please login";
            document.getElementById('sidebar-avatar').src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

            document.getElementById('profile-page-name').innerText = "Guest";
            document.getElementById('profile-page-deposit').innerText = "0 ৳";
            document.getElementById('profile-page-winning').innerText = "0 ৳";
            document.getElementById('profile-page-total-matches').innerText = "0";
        }

        /* --- VIEW LOGIC & TIMER --- */
        window.openCategory = (catId) => {
            currentActiveCategory = catId;
            switchMatchTab('play');
            renderCategoryRules();
            navigate('matches-view');
        };

        window.switchMatchTab = (tab) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');

            const container = document.getElementById('matches-container');
            container.innerHTML = "";

            if (timerInterval) clearInterval(timerInterval);

            let dataToRender = [];

            if (tab === 'play') {
                dataToRender = rawMatches.filter(m => m.categoryId === currentActiveCategory && m.status !== 'Finished');
            } else {
                dataToRender = rawMatches.filter(m => m.categoryId === currentActiveCategory && m.status === 'Finished');
            }

            if (dataToRender.length === 0) {
                container.innerHTML = "<div style='text-align:center; padding:30px; color:#666;'>No matches found in this category.</div>";
                return;
            }

            dataToRender.forEach(m => {
                const joinedCount = m.joined || 0;
                const totalSlots = m.total || 48;
                const progressPercent = (joinedCount / totalSlots) * 100;
                const isFull = joinedCount >= totalSlots;
                const categoryImg = activeCategories[currentActiveCategory]?.img || "https://placehold.co/50";

                let actionArea = '';

                if (tab === 'result') {
                    actionArea = `<div style="text-align:center; margin-top:10px;">
                        <button class="btn-view-result" onclick="openMatchResult('${m.dbKey}')">View Result</button>
                    </div>`;
                } else {
                    if (isFull) {
                        actionArea = `
                        <div style="display:flex; justify-content:space-between; margin-top:10px;">
                            <button class="btn-view-participants" onclick="openJoinedView('${m.dbKey}', '${m.title}')">View Joined</button>
                            <button class="btn-full-outline" style="width:48%;">Full</button>
                        </div>`;
                    } else {
                        actionArea = `
                        <div style="display:flex; justify-content:space-between; margin-top:10px;">
                            <button class="btn-view-participants" onclick="openJoinedView('${m.dbKey}', '${m.title}')">View Joined</button>
                            ${myJoinedMatchIds.has(String(m.dbKey))
                                ? `<button class="btn-join-outline" onclick="showTopToast('You have already Joined This match.', false)">Joined</button>`
                                : `<button class="btn-join-outline" onclick="openJoinModal('${m.dbKey}', '${m.title}', ${m.entry}, '${m.type}', ${joinedCount})">Join</button>`}
                        </div>`;
                    }
                }

                const html = `
                <div class="match-card">
                    <div class="m-header">
                        <img src="${categoryImg}" class="m-img" alt="Game">
                        <div class="m-title-box">
                            <h3 class="m-title">${m.title}</h3>
                            <div class="m-time">${m.time}</div>
                        </div>
                    </div>

                    <div class="m-stats-grid">
                        <div class="m-stat-box">
                            <span class="stat-label">🏆 TOTAL PRIZE</span>
                            <span class="stat-value">৳ ${m.total_prize || 0}</span>
                        </div>
                        <div class="m-stat-box">
                            <span class="stat-label">PER KILL</span>
                            <span class="stat-value">৳ ${m.per_kill}</span>
                        </div>
                        <div class="m-stat-box">
                            <span class="stat-label">ENTRY FEE</span>
                            <span class="stat-value">৳ ${m.entry}</span>
                        </div>
                        
                        <div class="m-stat-box">
                            <span class="stat-label">TYPE</span>
                            <span class="stat-value">${m.type}</span>
                        </div>
                        <div class="m-stat-box">
                            <span class="stat-label">GAME MODE</span>
                            <span class="stat-value">${m.gameModeName || 'Classic'}</span>
                        </div>
                        <div class="m-stat-box">
                            <span class="stat-label">MAP</span>
                            <span class="stat-value">${m.map}</span>
                        </div>
                    </div>

                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                    </div>

                    <div class="m-status-row">
                        <span>${joinedCount} Joined</span>
                        <span>${totalSlots - joinedCount} Available</span>
                    </div>

                    ${actionArea}

                    <div class="m-btn-row" style="margin-top:15px;">
                        <button class="btn-prize" onclick="openPrizeList('${m.dbKey}')">🏆 Prize List</button>
                        <button class="btn-room" onclick="checkRoomDetails('${m.dbKey}', '${m.room_id}', '${m.room_pass}')">ROOM ID</button>
                    </div>

                    <div class="timer-display match-countdown" data-time="${m.timestamp}">
                        Loading Timer...
                    </div>
                </div>`;
                container.innerHTML += html;
            });

            if (tab === 'play') startTimers();
        };

        // ROOM ID / PASSWORD CHECK
        window.checkRoomDetails = (matchKey, id, pass) => {
            const joined = myJoinedMatchIds.has(String(matchKey));
            const old = document.getElementById('room-details-modal');
            if (old) old.remove();

            if (!joined) {
                showTopToast('Join this match first to see Room ID & Password.', false);
                return;
            }

            const hasDetails = String(id || '').trim() && String(pass || '').trim();
            const modal = document.createElement('div');
            modal.id = 'room-details-modal';
            modal.className = 'room-details-modal';
            modal.innerHTML = `
                <div class="room-details-box">
                    <div class="room-key">🔑</div>
                    <h3>Room Details</h3>
                    <div class="room-watch">🕒</div>
                    ${hasDetails
                        ? `<div style="text-align:left; background:#f7f7f7; border-radius:12px; padding:12px; margin:10px 0 12px;">
                             <div style="font-size:13px; margin-bottom:8px;"><b>Room ID:</b> ${id}</div>
                             <div style="font-size:13px;"><b>Password:</b> ${pass}</div>
                           </div>`
                        : `<div class="pending">Details Pending</div>
                           <p class="room-note">আইডি পাসওয়ার্ড ম্যাচ শুরুর ১৫ মিনিট আগে দেওয়া হবে।</p>`}
                    <button class="room-close-btn" onclick="document.getElementById('room-details-modal')?.remove()">Close Window</button>
                </div>`;
            document.body.appendChild(modal);
        };

        window.closePrizeList = () => {
            const modal = document.getElementById('prize-list-modal');
            if (modal) modal.classList.remove('show');
        };

        window.openPrizeList = (dbKey) => {
            const match = rawMatches.find(m => m.dbKey === dbKey);
            if (!match) return showTopToast('Prize list is not available.', false);
            const modal = document.getElementById('prize-list-modal');
            const totalBox = document.getElementById('prize-total-box');
            const content = document.getElementById('prize-list-content');
            document.getElementById('prize-list-title').innerText = `🏆 ${match.title || 'Prize List'}`;
            totalBox.innerHTML = `<small>Total Prize</small><strong>৳ ${match.total_prize || 0}</strong>`;

            let source = match.prize_list ?? match.prizeList ?? match.prizes ?? match.prizeDistribution ?? null;
            let rows = [];
            if (Array.isArray(source)) {
                rows = source.map((p, i) => {
                    if (typeof p === 'object' && p) return { rank: p.rank || p.position || `${i + 1}${i===0?'st':i===1?'nd':i===2?'rd':'th'} Place`, amount: p.amount ?? p.prize ?? p.value ?? 0 };
                    return { rank: `${i + 1}${i===0?'st':i===1?'nd':i===2?'rd':'th'} Place`, amount: p };
                });
            } else if (source && typeof source === 'object') {
                rows = Object.entries(source).map(([rank, value]) => ({ rank: String(rank).replace(/_/g,' '), amount: typeof value === 'object' ? (value.amount ?? value.prize ?? 0) : value }));
            } else if (typeof source === 'string') {
                rows = source.split(/[,\n]+/).map((v,i) => ({ rank: `${i + 1}${i===0?'st':i===1?'nd':i===2?'rd':'th'} Place`, amount: v.trim() })).filter(x => x.amount);
            }

            if (!rows.length) {
                content.innerHTML = `<div class="prize-empty">Prize distribution has not been added yet.<br><small>Total prize is shown above.</small></div>`;
            } else {
                content.innerHTML = rows.map(r => `<div class="prize-row"><span class="rank">${r.rank}</span><span class="amount">৳ ${r.amount}</span></div>`).join('');
            }
            modal.classList.add('show');
        };

        function startTimers() {
            function update() {
                const timers = document.querySelectorAll('.match-countdown');
                const now = new Date().getTime();

                timers.forEach(timer => {
                    const target = parseInt(timer.getAttribute('data-time'));
                    const distance = target - now;

                    if (distance < 0) {
                        timer.innerText = "MATCH STARTED / ENDED";
                        timer.style.color = "red";
                    } else {
                        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                        timer.innerHTML = `
                            ${days} <span style="font-size:10px;">Days</span> : 
                            ${hours} <span style="font-size:10px;">Hours</span> : 
                            ${minutes} <span style="font-size:10px;">Min</span> : 
                            ${seconds} <span style="font-size:10px;">Sec</span>
                        `;
                    }
                });
            }
            update();
            timerInterval = setInterval(update, 1000);
        }

        /* --- OPEN JOINED MEMBERS VIEW --- */
        window.openJoinedView = (matchId, title) => {
            document.getElementById('view-joined-title').innerText = title;
            const container = document.getElementById('joined-members-list-container');
            container.innerHTML = "<div style='text-align:center; padding:20px; color:#999;'>Loading participants...</div>";
            navigate('view-joined-members');

            const matchRef = ref(db, 'match_participants/' + matchId);
            onValue(matchRef, (snapshot) => {
                container.innerHTML = "";
                const data = snapshot.val();
                if (data) {
                    const list = document.createElement('ul');
                    list.className = 'joined-list';

                    Object.values(data).forEach(player => {
                        const li = document.createElement('li');
                        li.className = 'joined-item';
                        li.innerHTML = `
                             <span class="joined-name">${player.ign}</span>
                             <span class="joined-uid">UID: ${player.uid}</span>
                         `;
                        list.appendChild(li);
                    });
                    container.appendChild(list);
                } else {
                    container.innerHTML = "<div style='text-align:center; padding:20px; color:#666;'>No players joined yet. Be the first!</div>";
                }
            });
        };

        /* --- OPEN RESULT DETAILS --- */
        window.openMatchResult = (dbKey) => {
            const match = rawMatches.find(m => m.dbKey === dbKey);
            if (!match || !match.results) return alert("Results not available yet.");

            const container = document.getElementById('result-details-container');

            let rows = match.results.map(r => `
                <tr class="${r.win > 0 ? 'winner-row' : ''}">
                    <td>${r.name}</td>
                    <td>${r.kill}</td>
                    <td>${r.win}</td>
                </tr>
            `).join('');

            container.innerHTML = `
                <div class="result-view-header">
                    <div class="result-view-title">${match.title}</div>
                    <table class="result-table">
                        <thead>
                            <tr>
                                <th>Game Name</th>
                                <th>Kill</th>
                                <th>Win</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>

                <div class="rules-box">
                    <h4 class="rules-title">Information</h4>
                    <ul class="rules-list">
                        <li><i class="fas fa-check"></i> Match finished at ${match.time}</li>
                        <li><i class="fas fa-check"></i> Winnings have been added to wallets.</li>
                    </ul>
                </div>
            `;

            navigate('match-result');
        };

        /* --- JOIN MODAL --- */
        window.openJoinModal = (id, title, fee, type, joined) => {
            if (!currentUser) {
                showAuthPage('login');
                return;
            }

            const totalBal = depositBal + winningBal;
            if (totalBal < fee) {
                showTopToast(`Insufficient Balance! You need ${fee}৳ but you have ${totalBal}৳.`, false);
                return;
            }

            currentJoinMatchId = id; // this is now the match's real Firebase dbKey
            currentJoinFee = fee;
            const matchDbKey = id;

            document.getElementById('join-modal-title').innerText = title;
            document.getElementById('join-modal-balance').innerText = totalBal;
            document.getElementById('join-modal-fee').innerText = fee;
            document.getElementById('join-modal-joined').innerText = joined;

            const container = document.getElementById('join-inputs-container');
            container.innerHTML = "";
            let count = 1;
            if (type.toLowerCase().includes('duo')) count = 2;
            if (type.toLowerCase().includes('squad')) count = 4;

            for (let i = 1; i <= count; i++) {
                container.innerHTML += `
                    <div style="margin-bottom:15px;">
                        <h5 style="font-size:12px; margin-bottom:5px; color:#666;">Player ${i} Details</h5>
                        <div class="form-group" style="margin-bottom:8px;">
                            <input type="text" class="input-field player-name-input" placeholder="In-Game Name">
                        </div>
                        <div class="form-group">
                            <input type="number" class="input-field player-uid-input" placeholder="Free Fire UID (Game ID)">
                        </div>
                    </div>
                `;
            }
            document.querySelector('#join-modal .primary-btn').dataset.matchKey = matchDbKey;
            document.getElementById('join-modal').classList.add('active');
        };

        window.closeJoinModal = () => {
            document.getElementById('join-modal').classList.remove('active');
        };

        window.confirmJoin = async () => {
            const nameInputs = document.querySelectorAll('.player-name-input');
            const uidInputs = document.querySelectorAll('.player-uid-input');
            const matchDbKey = document.querySelector('#join-modal .primary-btn').dataset.matchKey;

            let valid = true;
            let playersData = [];

            for (let i = 0; i < nameInputs.length; i++) {
                if (!nameInputs[i].value.trim() || !uidInputs[i].value.trim()) {
                    valid = false;
                    break;
                }
                playersData.push({
                    ign: nameInputs[i].value.trim(),
                    uid: uidInputs[i].value.trim()
                });
            }

            if (!valid) return showTopToast("Please fill Name and UID for all players.", false);

            // RULE: One account can join a specific match only once.
            // (Real check against match_participants — no client-only assumption;
            // this must also be mirrored in your Firebase Security Rules server-side.)
            const dupRef = ref(db, 'match_participants/' + currentJoinMatchId);
            const dupSnap = await get(dupRef);
            const existingParticipants = dupSnap.val();
            if (existingParticipants && Object.values(existingParticipants).some(p => p.joinedBy === currentUser.uid)) {
                closeJoinModal();
                return showTopToast("You have already joined this match.", false);
            }

            let newDeposit = depositBal;
            let newWinning = winningBal;
            let remainingFee = currentJoinFee;

            if (newDeposit >= remainingFee) {
                newDeposit -= remainingFee;
            } else {
                remainingFee -= newDeposit;
                newDeposit = 0;
                newWinning -= remainingFee;
            }

            const userRef = ref(db, 'users/' + currentUser.uid);
            update(userRef, { deposit: newDeposit, winning: newWinning }).then(() => {

                const participantsRef = ref(db, 'match_participants/' + currentJoinMatchId);
                playersData.forEach(p => {
                    push(participantsRef, {
                        ign: p.ign,
                        uid: p.uid,
                        joinedBy: currentUser.uid
                    });
                });

                const matchRef = ref(db, 'matches/' + matchDbKey);
                get(matchRef).then(snap => {
                    const currentJoined = snap.val().joined || 0;
                    update(matchRef, { joined: currentJoined + 1 });
                });

                myJoinedMatchIds.add(String(matchDbKey));
                showTopToast("Successfully Joined! Check 'View Joined' to see your name.", true);
                closeJoinModal();
                if (document.getElementById('matches-view')?.classList.contains('active')) {
                    switchMatchTab(document.querySelector('#matches-view .tab-btn.active')?.id?.replace('tab-', '') || 'play');
                }
            }).catch(e => showTopToast(e.message || "Join failed. Please try again.", false));
        };

        /* --- NAVIGATION & UI --- */
        window.showAuthPage = (type) => {
            closeAllSidebars();
            if (type === 'login') {
                document.getElementById('login-page').classList.add('active');
                document.getElementById('register-page').classList.remove('active');
            } else {
                document.getElementById('register-page').classList.add('active');
                document.getElementById('login-page').classList.remove('active');
            }
        };

        window.closeAuthPage = () => {
            document.querySelectorAll('.auth-page').forEach(el => el.classList.remove('active'));
        };

        window.closeAllSidebars = () => {
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('notif-sidebar').classList.remove('active');
            document.querySelector('.sidebar-overlay').classList.remove('active');
        }

        window.toggleSidebar = () => {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (sidebar.classList.contains('active')) {
                closeAllSidebars();
            } else {
                closeAllSidebars();
                sidebar.classList.add('active');
                overlay.classList.add('active');
            }
        };

        window.toggleNotification = () => {
            const sidebar = document.getElementById('notif-sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (sidebar.classList.contains('active')) {
                closeAllSidebars();
            } else {
                closeAllSidebars();
                sidebar.classList.add('active');
                overlay.classList.add('active');
            }
        }

        window.navigate = (sectionId) => {
            if ((sectionId === 'profile' || sectionId === 'add-money' || sectionId === 'withdraw' || sectionId === 'history' || sectionId === 'my-matches') && !currentUser) {
                showAuthPage('login');
                return;
            }

            document.querySelectorAll('.app-section').forEach(el => el.classList.remove('active'));
            const target = document.getElementById(sectionId);
            if (target) target.classList.add('active');
            if (sectionId === 'add-money' && !appSettings.auto_pay_enabled) {
                 showStep(1);
            }
            if (sectionId === 'my-matches') {
                switchMyMatchTab(currentMyMatchTab);
            }

            updateBottomNavActive(sectionId);
            closeAllSidebars();
            window.scrollTo(0, 0);
        };

        function updateBottomNavActive(sectionId) {
            const map = { home: 'bn-play', 'matches-view': 'bn-play', 'my-matches': 'bn-my-matches', 'add-money': 'bn-add-money', profile: 'bn-profile' };
            document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('bn-active'));
            const activeId = map[sectionId];
            if (activeId) {
                const el = document.getElementById(activeId);
                if (el) el.classList.add('bn-active');
            }
        }

        let topToastTimer = null;
        window.showTopToast = (message, success = true) => {
            let toast = document.getElementById('top-toast-message');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'top-toast-message';
                toast.style.position = 'fixed';
                toast.style.top = '18px';
                toast.style.left = '50%';
                toast.style.transform = 'translateX(-50%)';
                toast.style.zIndex = '99999';
                toast.style.padding = '12px 20px';
                toast.style.borderRadius = '10px';
                toast.style.fontSize = '14px';
                toast.style.fontWeight = '700';
                toast.style.boxShadow = '0 5px 18px rgba(0,0,0,0.18)';
                toast.style.textAlign = 'center';
                toast.style.maxWidth = 'calc(100% - 30px)';
                toast.style.transition = 'opacity .2s ease, transform .2s ease';
                document.body.appendChild(toast);
            }
            if (topToastTimer) clearTimeout(topToastTimer);
            toast.textContent = message;
            toast.style.color = success ? '#198754' : '#dc3545';
            toast.style.background = success ? '#eaf8ef' : '#fff0f0';
            toast.style.border = success ? '1px solid #8fd3a8' : '1px solid #f0a0a0';
            toast.style.opacity = '1';
            toast.style.display = 'block';
            toast.style.transform = 'translateX(-50%) translateY(0)';
            topToastTimer = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(-8px)';
                setTimeout(() => {
                    if (toast) toast.style.display = 'none';
                }, 220);
            }, 3000);
        };

        window.copyToClipboard = async (text) => {
            text = String(text || '').trim();
            if (!text || text === '...') {
                return showTopToast('Number not available.', false);
            }

            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                } else {
                    const temp = document.createElement('textarea');
                    temp.value = text;
                    temp.setAttribute('readonly', '');
                    temp.style.position = 'fixed';
                    temp.style.opacity = '0';
                    temp.style.left = '-9999px';
                    document.body.appendChild(temp);
                    temp.focus();
                    temp.select();
                    temp.setSelectionRange(0, temp.value.length);
                    const copied = document.execCommand('copy');
                    document.body.removeChild(temp);
                    if (!copied) throw new Error('Copy command failed');
                }
                showTopToast('Copied', true);
            } catch (error) {
                // Last fallback: select the visible number so the user can copy it manually.
                try {
                    const input = document.getElementById('disp-bkash-num') || document.getElementById('auto-pay-number');
                    if (input) {
                        input.focus();
                        input.select();
                        input.setSelectionRange(0, input.value.length);
                    }
                } catch (_) {}
                showTopToast('Copy failed. Number selected—please copy it manually.', false);
            }
        };

        /* --- ADD MONEY FLOW --- */
        let addMoneyAmount = 0;
        let selectedAutoPayMethod = null;

        // Auto Pay Functions
        window.selectAutoPayMethod = (method) => {
             selectedAutoPayMethod = method;
             
             // Highlight selected button
             document.querySelectorAll('#auto-pay-method-selector .method-btn').forEach(btn => {
                 btn.classList.remove('selected');
             });
             document.querySelector(`#auto-pay-method-selector .method-btn[data-method="${method}"]`).classList.add('selected');

            // Show number and input field
            const detailsDiv = document.getElementById('auto-pay-details');
            const numberInput = document.getElementById('auto-pay-number');
            const nameSpan = document.getElementById('payment-method-name');
            
            let number = '';
            if (method === 'bKash') number = appSettings.bkash_number;

            if (number) {
                 nameSpan.textContent = method;
                 numberInput.value = number;
                 detailsDiv.classList.remove('hidden');
            } else {
                 showTopToast(`${method} number not set by admin.`, false);
                 detailsDiv.classList.add('hidden');
            }
        }

        window.requestAutoPayment = async () => {
            if (!currentUser) return showAuthPage('login');
            
            const trxId = document.getElementById('auto-pay-trxid').value.trim();

            if (!selectedAutoPayMethod) return showTopToast('Please select a payment method.', false);
            if (!trxId) return showTopToast('Please enter the transaction ID.', false);
            
            // 1. Check if TrxID is already used
            const usedTrxRef = ref(db, `Auto Pay/${trxId}`);
            const usedSnapshot = await get(usedTrxRef);
            if (usedSnapshot.exists()) {
                return showTopToast('This transaction ID has already been used.', false);
            }

            // 2. Find the transaction in XNXANIKPAY
            const paymentsRef = ref(db, 'XNXANIKPAY');
            const snapshot = await get(paymentsRef);
            
            if (snapshot.exists()) {
                const allPayments = snapshot.val();
                let foundPayment = null;

                for (const key in allPayments) {
                    if (allPayments[key].txid && allPayments[key].txid.toLowerCase() === trxId.toLowerCase()) {
                        foundPayment = allPayments[key];
                        break;
                    }
                }
                
                if (foundPayment) {
                    // 3. Process the payment
                    const amount = parseFloat(foundPayment.amount);
                    const userRef = ref(db, `users/${currentUser.uid}`);
                    const newBalance = depositBal + amount;
                    
                    // Update user's balance
                    await update(userRef, { deposit: newBalance });

                    // Add to user's transaction history
                    const userTrxRef = ref(db, `transactions/${currentUser.uid}`);
                    await push(userTrxRef, {
                        type: 'Deposit (Auto)',
                        method: selectedAutoPayMethod,
                        amount: amount,
                        trxId: trxId,
                        status: 'Completed',
                        date: new Date().toLocaleString()
                    });

                    // 4. Mark TrxID as used in "Auto Pay"
                    await set(usedTrxRef, {
                        amount: amount,
                        txid: trxId,
                        type: foundPayment.type,
                        agent: foundPayment.agent || 'N/A',
                        usedBy_uid: currentUser.uid,
                        usedBy_email: currentUser.email,
                        timestamp: serverTimestamp()
                    });
                    
                    showTopToast(`Success! ${amount} BDT has been added to your account.`, true);
                    document.getElementById('auto-pay-trxid').value = ''; // Clear input
                    navigate('history');
                    
                } else {
                    showTopToast('Transaction ID not found. Please check and try again.', false);
                }
            } else {
                showTopToast('No payments found to verify against. Please contact support.', false);
            }
        }


        // Manual Pay Functions
        window.showStep = (stepNum) => {
            document.querySelectorAll('.step-container').forEach(el => el.classList.remove('active-step'));
            if (stepNum === 1) document.getElementById('add-step-1').classList.add('active-step');
            else if (stepNum === 2) document.getElementById('add-step-2').classList.add('active-step');
            else if (stepNum === 'bkash') document.getElementById('add-step-bkash').classList.add('active-step');
        };

        window.goToPaymentMethods = () => {
            const val = document.getElementById('add-amount-input').value;
            // Note: Min deposit check is handled by settings visual, but logic is here
            if (val < 20) return showTopToast("Minimum Add: 20 BDT", false);
            addMoneyAmount = val;
            document.getElementById('display-amount-step2').innerText = val + " ৳";
            document.querySelectorAll('.final-amount-display').forEach(el => el.innerText = val);
            showStep(2);
        };

        window.showPaymentDetails = (method) => {
            if (method === 'Bkash' || method === 'bKash') showStep('bkash');
        };

        window.verifyPayment = async (method) => {
            const trx = document.getElementById('bkash-trx').value.trim();
            const sender = document.getElementById('bkash-sender').value.trim();

            if (!sender || !trx) {
                showTopToast('Please Fill The Number and Transaction Id', false);
                return;
            }

            if (!currentUser) {
                return showAuthPage('login');
            }

            try {
                const trxRef = ref(db, 'transactions/' + currentUser.uid);
                await push(trxRef, {
                    type: 'Deposit',
                    method: method,
                    amount: addMoneyAmount,
                    sender: sender,
                    trxId: trx,
                    status: 'Pending',
                    date: new Date().toLocaleString()
                });

                showTopToast('Submitted Success Admin will approve', true);
                document.getElementById('bkash-sender').value = '';
                document.getElementById('bkash-trx').value = '';
            } catch (error) {
                console.error('Deposit submission failed:', error);
                showTopToast('Submission failed. Please try again.', false);
            }
        };

        window.submitWithdraw = () => {
            const amount = document.getElementById('withdraw-amount').value;
            const number = document.getElementById('withdraw-number').value;
            const method = document.getElementById('withdraw-method').value;

            if (amount < 100) return showTopToast("Minimum Withdraw 100 BDT", false);
            if (amount > winningBal) return showTopToast("Insufficient Winning Balance!", false);
            if (!number) return showTopToast("Enter account number", false);

            const trxRef = ref(db, 'transactions/' + currentUser.uid);
            push(trxRef, {
                type: 'Withdraw',
                method: method,
                amount: amount,
                account: number,
                status: 'Pending',
                date: new Date().toLocaleString()
            }).then(() => {
                showTopToast("Withdraw Request Sent! Admin will review your request.", true);
                document.getElementById('withdraw-amount').value = "";
                navigate('history');
            });
        };

        function loadHistory() {
            if (!currentUser) return;
            const historyList = document.getElementById('history-list');
            const trxRef = ref(db, 'transactions/' + currentUser.uid);
            onValue(trxRef, (snapshot) => {
                historyList.innerHTML = "";
                const data = snapshot.val();
                if (data) {
                    const entries = Object.values(data).reverse();
                    entries.forEach(trx => {
                        const isWithdraw = trx.type === 'Withdraw';
                        const color = isWithdraw ? 'red' : 'green';
                        const sign = isWithdraw ? '-' : '+';
                        const html = `
                         <div style="display:flex; justify-content:space-between; padding:15px; border-bottom:1px solid #eee;">
                            <div>
                                <h4 style="font-size:14px; color:#333;">${trx.type} (${trx.method})</h4>
                                <p style="font-size:11px; color:#888;">${trx.date}</p>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-weight:700; color:${color};">${sign}${trx.amount}৳</div>
                                <span style="font-size:10px; padding:2px 6px; border-radius:4px; background:#eee; color:#666;">${trx.status}</span>
                            </div>
                        </div>`;
                        historyList.innerHTML += html;
                    });
                } else {
                    historyList.innerHTML = "<div style='text-align:center; padding:30px; color:#999;'>No transactions found.</div>";
                }
            });
        }