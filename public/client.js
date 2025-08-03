// public/client.js
let userState = { loggedIn: false, user: null, position: null };
let map, socket;
const userMarkers = {};
const activityIcons = { dating: '❤️', coffee: '☕', food: '🍕', sport: '🏀', park: '🌳', movie: '🎬', culture: '🎭', travel: '✈️', study: '📚', game: '🎮' };
let chatPartnerId = null;

let loader, welcomeUserEl, logoutBtn, activityButtons, activityDescriptionInput, visibilityDurationSelect,
    updateActivityBtn, cancelActivityBtn, viewRadiusSlider, viewRadiusValue, visibilityRadiusSlider,
    visibilityRadiusValue, userList, profileSettingsForm, profilePictureUrlInput, profileDescriptionInput,
    profileAgeInput, profileInterestsInput, profileInstagramInput, profileTiktokInput, chatContainer,
    chatPartnerName, chatPartnerLink, chatActivityDescription, closeChatBtn, chatMessages, chatForm,
    chatInput, profileModal, profileModalContent, closeProfileModalBtn, menuToggleBtn, sidebar, sidebarOverlay, sidebarCloseBtn;

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.querySelector('.js-show-register');
    const showLoginLink = document.querySelector('.js-show-login');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    if (showRegisterLink) showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); loginView.classList.add('hidden'); registerView.classList.remove('hidden'); });
    if (showLoginLink) showLoginLink.addEventListener('click', (e) => { e.preventDefault(); registerView.classList.add('hidden'); loginView.classList.remove('hidden'); });
    
    checkSession();
});

function assignElements() {
    loader = document.getElementById('loader');
    welcomeUserEl = document.getElementById('welcome-user');
    logoutBtn = document.getElementById('logout-btn');
    activityButtons = document.querySelectorAll('#activity-buttons button');
    activityDescriptionInput = document.getElementById('activity-description');
    visibilityDurationSelect = document.getElementById('visibility-duration');
    updateActivityBtn = document.getElementById('update-activity-btn');
    cancelActivityBtn = document.getElementById('cancel-activity-btn');
    viewRadiusSlider = document.getElementById('view-radius');
    viewRadiusValue = document.getElementById('view-radius-value');
    visibilityRadiusSlider = document.getElementById('visibility-radius');
    visibilityRadiusValue = document.getElementById('visibility-radius-value');
    userList = document.getElementById('user-list');
    profileSettingsForm = document.getElementById('profile-settings-form');
    profilePictureUrlInput = document.getElementById('profile-picture-url');
    profileDescriptionInput = document.getElementById('profile-description');
    profileAgeInput = document.getElementById('profile-age');
    profileInterestsInput = document.getElementById('profile-interests');
    profileInstagramInput = document.getElementById('profile-instagram');
    profileTiktokInput = document.getElementById('profile-tiktok');
    chatContainer = document.getElementById('chat-container');
    chatPartnerName = document.getElementById('chat-partner-name');
    chatPartnerLink = document.getElementById('chat-partner-link');
    chatActivityDescription = document.getElementById('chat-activity-description');
    closeChatBtn = document.getElementById('close-chat-btn');
    chatMessages = document.getElementById('chat-messages');
    chatForm = document.getElementById('chat-form');
    chatInput = document.getElementById('chat-input');
    profileModal = document.getElementById('profile-modal');
    profileModalContent = document.getElementById('profile-modal-content');
    closeProfileModalBtn = document.getElementById('close-profile-modal-btn');
    menuToggleBtn = document.getElementById('menu-toggle-btn');
    sidebar = document.getElementById('sidebar');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    sidebarCloseBtn = document.getElementById('sidebar-close-btn');
}

function showLoader() { document.getElementById('loader').classList.remove('hidden'); }
function hideLoader() { document.getElementById('loader').classList.add('hidden'); }
function toggleView(isLoggedIn) { 
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    if (isLoggedIn) {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        if (!map) initMap();
    } else {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
}

async function checkSession() { showLoader(); try { const response = await fetch('/api/session'); const data = await response.json(); if (data.loggedIn && data.user) { userState = { ...userState, loggedIn: true, user: data.user }; toggleView(true); initAppLogic(); } else { toggleView(false); } } catch (error) { console.error("Session-Check fehlgeschlagen:", error); toggleView(false); } finally { hideLoader(); } }
async function handleLogin(e) { e.preventDefault(); showLoader(); const username = document.getElementById('login-username').value; const password = document.getElementById('login-password').value; try { const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); const data = await response.json(); if (response.ok && data.user) { userState = { loggedIn: true, user: data.user }; toggleView(true); initAppLogic(); } else { alert(data.message || "Ein Fehler ist aufgetreten."); } } catch (error) { alert("Login fehlgeschlagen."); } finally { hideLoader(); } }
async function handleRegister(e) { e.preventDefault(); showLoader(); const username = document.getElementById('register-username').value; const email = document.getElementById('register-email').value; const password = document.getElementById('register-password').value; try { const response = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, password }) }); const data = await response.json(); if (response.status === 201 && data.user) { userState = { loggedIn: true, user: data.user }; toggleView(true); initAppLogic(); } else { alert(data.message || "Ein Fehler ist aufgetreten."); } } catch (error) { alert("Registrierung fehlgeschlagen."); } finally { hideLoader(); } }
async function handleLogout() { await fetch('/api/logout', { method: 'POST' }); if (socket) socket.disconnect(); userState = { loggedIn: false, user: null, position: null }; document.location.reload(); }
async function handleProfileSave(e) { e.preventDefault(); const profileData = { profilePictureUrl: profilePictureUrlInput.value, profileDescription: profileDescriptionInput.value, age: profileAgeInput.value, interests: profileInterestsInput.value, instagram: profileInstagramInput.value, tiktok: profileTiktokInput.value }; try { const response = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileData) }); const data = await response.json(); if (response.ok) { alert("Profil erfolgreich gespeichert!"); userState.user = data.user; } else { alert(data.message); } } catch (error) { alert("Fehler beim Speichern des Profils."); } }
async function toggleFavorite(targetUserId) { if (!userState.user) return; const isCurrentlyFavorite = userState.user.favorites.includes(targetUserId); if (isCurrentlyFavorite) { userState.user.favorites = userState.user.favorites.filter(id => id !== targetUserId); } else { userState.user.favorites.push(targetUserId); } const allFavButtonsForUser = document.querySelectorAll(`.favorite-btn[data-userid="${targetUserId}"]`); allFavButtonsForUser.forEach(btn => { btn.classList.toggle('is-favorite', !isCurrentlyFavorite); btn.innerHTML = !isCurrentlyFavorite ? '★' : '☆'; }); try { const response = await fetch(`/api/favorite/${targetUserId}`, { method: 'POST' }); if (!response.ok) { throw new Error("Server-Anfrage fehlgeschlagen"); } const data = await response.json(); userState.user.favorites = data.favorites; await sendDataToServer(); } catch (error) { console.error("Fehler beim Favorisieren:", error); } }

function initMap() { map = L.map('map').setView([52.52, 13.40], 13); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map); navigator.geolocation.watchPosition(position => { const newPos = { lat: position.coords.latitude, lng: position.coords.longitude }; if (!userState.position || Math.abs(newPos.lat - userState.position.lat) > 0.0001 || Math.abs(newPos.lng - userState.position.lng) > 0.0001) { userState.position = newPos; if (userMarkers['own']) { userMarkers['own'].setLatLng(newPos); } else { userMarkers['own'] = L.marker(newPos).addTo(map).bindPopup('<b>Das bist du!</b>').openPopup(); } map.panTo(newPos); sendDataToServer(); } }, () => { alert('Wir konnten deine Position nicht abrufen. Bitte erlaube den Zugriff.'); }, { enableHighAccuracy: true }); }
function initAppLogic() { if (!userState.user) return; assignElements(); welcomeUserEl.textContent = `Hi, ${userState.user.username}!`; populateProfileForm(); initSocket(); addAppEventListeners(); }
function populateProfileForm() { const u = userState.user; if (!u) return; profilePictureUrlInput.value = (u.profilePicture && !u.profilePicture.startsWith('/')) ? u.profilePicture : ''; profileDescriptionInput.value = u.profileDescription || ''; profileAgeInput.value = u.age || ''; profileInterestsInput.value = u.interests ? u.interests.join(', ') : ''; profileInstagramInput.value = u.socialLinks ? u.socialLinks.instagram : ''; profileTiktokInput.value = u.socialLinks ? u.socialLinks.tiktok : ''; }
function addAppEventListeners() {
    logoutBtn.addEventListener('click', handleLogout);
    profileSettingsForm.addEventListener('submit', handleProfileSave);
    activityButtons.forEach(button => button.addEventListener('click', handleActivityButtonClick));
    updateActivityBtn.addEventListener('click', () => { sendDataToServer(); alert('Aktivität erfolgreich gestartet/aktualisiert!'); });
    cancelActivityBtn.addEventListener('click', cancelActivity);
    viewRadiusSlider.addEventListener('input', () => { viewRadiusValue.textContent = viewRadiusSlider.value; sendDataToServer(); });
    visibilityRadiusSlider.addEventListener('input', () => { visibilityRadiusValue.textContent = visibilityRadiusSlider.value; });
    closeChatBtn.addEventListener('click', () => chatContainer.classList.add('hidden'));
    chatForm.addEventListener('submit', handleSendMessage);
    closeProfileModalBtn.addEventListener('click', () => profileModal.classList.add('hidden'));
    chatPartnerLink.addEventListener('click', (e) => { e.preventDefault(); if (chatPartnerId) showUserProfile(chatPartnerId); });
    
    // FIX: Überarbeitete Logik für das mobile Menü
    const closeMenu = () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    };
    menuToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    });
    sidebarOverlay.addEventListener('click', closeMenu);
    sidebarCloseBtn.addEventListener('click', closeMenu);

    document.body.addEventListener('click', (e) => {
        const favBtn = e.target.closest('.favorite-btn');
        if (favBtn && favBtn.dataset.userid) { toggleFavorite(favBtn.dataset.userid); return; }
        const chatBtn = e.target.closest('.chat-btn');
        if (chatBtn && chatBtn.dataset.userid) { startChat({ _id: chatBtn.dataset.userid, username: chatBtn.dataset.username, activityDescription: chatBtn.dataset.activitydesc }); return; }
        const userListItem = e.target.closest('.user-list-item');
        if (userListItem && !e.target.closest('.user-item-controls')) { showUserProfile(userListItem.dataset.userid); }
    });
}
function initSocket() { if (socket) return; socket = io({ autoConnect: true }); socket.on('connect', () => { if (userState.position) sendDataToServer(); }); socket.on('users-update', renderUsers); socket.on('user-disconnected', removeUser); socket.on('privateMessage', handleIncomingMessage); }
function sendDataToServer() { if (!socket || !userState.position || !userState.loggedIn) return; const selectedButton = document.querySelector('#activity-buttons button.active'); const data = { position: userState.position, radii: { view: parseInt(viewRadiusSlider.value, 10), visibility: parseInt(visibilityRadiusSlider.value, 10) }, activity: { category: selectedButton ? selectedButton.dataset.category : 'none', description: activityDescriptionInput.value, visibilityDuration: parseInt(visibilityDurationSelect.value, 10) } }; socket.emit('update-data', data); }
function handleActivityButtonClick(e) { activityButtons.forEach(btn => btn.classList.remove('active')); e.currentTarget.classList.add('active'); }
function cancelActivity() { activityButtons.forEach(btn => btn.classList.remove('active')); activityDescriptionInput.value = ''; sendDataToServer(); }
function startChat(partner) { chatPartnerId = partner._id; chatPartnerName.textContent = partner.username; chatActivityDescription.textContent = partner.activityDescription || ''; chatMessages.innerHTML = ''; chatContainer.classList.remove('hidden'); chatInput.focus(); }
function handleSendMessage(e) { e.preventDefault(); const message = chatInput.value.trim(); if (message && chatPartnerId) { socket.emit('privateMessage', { recipientId: chatPartnerId, message }); const msgElement = document.createElement('div'); msgElement.className = 'message own'; msgElement.textContent = message; chatMessages.appendChild(msgElement); chatMessages.scrollTop = chatMessages.scrollHeight; chatInput.value = ''; } }
function handleIncomingMessage({ senderId, senderUsername, message }) { if (chatContainer.classList.contains('hidden') || chatPartnerId !== senderId) { startChat({ _id: senderId, username: senderUsername, activityDescription: '' }); } const msgElement = document.createElement('div'); msgElement.className = 'message other'; msgElement.textContent = message; chatMessages.appendChild(msgElement); chatMessages.scrollTop = chatMessages.scrollHeight; }
async function showUserProfile(userId) {
    showLoader();
    try {
        const response = await fetch(`/api/user/${userId}`);
        const user = await response.json();
        if (response.ok) {
            const isFavorite = userState.user.favorites.includes(user._id);
            let interestsHTML = user.interests && user.interests.length > 0 ? user.interests.map(tag => `<span class="interest-tag">${tag}</span>`).join('') : '<p>Keine Interessen angegeben.</p>';
            let socialHTML = '';
            if (user.socialLinks) {
                if (user.socialLinks.instagram) socialHTML += `<a href="https://instagram.com/${user.socialLinks.instagram}" target="_blank">Instagram</a>`;
                if (user.socialLinks.tiktok) socialHTML += `<a href="https://tiktok.com/@${user.socialLinks.tiktok}" target="_blank">TikTok</a>`;
            }
            if (!socialHTML.trim()) socialHTML = '<p>Keine Social Media Links.</p>';
            
            profileModalContent.innerHTML = `
                <div class="profile-header">
                    <div class="profile-header-info">
                        <img src="${user.profilePicture || '/default-avatar.png'}" alt="Profilbild" class="profile-avatar">
                        <div class="profile-name-age">
                            <h2>${user.username}</h2>
                            <p>${user.age ? user.age + ' Jahre' : 'Kein Alter angegeben'}</p>
                        </div>
                    </div>
                    <button class="favorite-btn ${isFavorite ? 'is-favorite' : ''}" data-userid="${user._id}" title="Favorisieren">${isFavorite ? '★' : '☆'}</button>
                </div>
                <div class="profile-section"><h3>Über mich</h3><p>${user.profileDescription || 'Keine Beschreibung vorhanden.'}</p></div>
                <div class="profile-section"><h3>Interessen</h3><div class="profile-interests-list">${interestsHTML}</div></div>
                <div class="profile-section"><h3>Social Media</h3><div class="social-links">${socialHTML}</div></div>`;
            
            profileModal.classList.remove('hidden');
        } else { alert(user.message); }
    } catch (error) { console.error("Profil konnte nicht geladen werden:", error); alert("Profil konnte nicht geladen werden."); }
    finally { hideLoader(); }
}
function renderUsers(users) {
    if (!userState.user) return;
    for (const id in userMarkers) { if (id !== 'own') { userMarkers[id].remove(); delete userMarkers[id]; } }
    users.sort((a, b) => { if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1; const aIsFav = userState.user.favorites.includes(a._id); const bIsFav = userState.user.favorites.includes(b._id); return bIsFav - aIsFav; });
    userList.innerHTML = '';
    const visibleUsers = users.filter(user => user._id !== userState.user._id);
    if (visibleUsers.length === 0) { userList.innerHTML = '<p style="padding: 10px; text-align: center; color: #6c757d;">Keine aktiven User im Umkreis.</p>'; return; }
    visibleUsers.forEach(user => {
        const iconHtml = activityIcons[user.currentActivity] || '❓';
        const icon = L.divIcon({ className: 'map-icon', html: iconHtml });
        const marker = L.marker([user.location.coordinates[1], user.location.coordinates[0]], { icon }).addTo(map);
        marker.on('click', () => {
            if (!chatContainer.classList.contains('hidden') && chatPartnerId === user._id) {
                showUserProfile(user._id);
            } else {
                startChat(user);
            }
        });
        userMarkers[user._id] = marker;
        const isFavorite = userState.user.favorites.includes(user._id);
        const adminBadge = user.isAdmin ? '<span class="admin-badge">Admin</span>' : '';
        const listItem = document.createElement('div');
        listItem.className = 'user-list-item';
        listItem.dataset.userid = user._id;
        listItem.dataset.username = user.username;
        listItem.dataset.activitydesc = user.activityDescription || '';
        listItem.innerHTML = `
            <div class="user-info">
                <img src="${user.profilePicture || '/default-avatar.png'}" class="list-avatar">
                <div class="user-text">
                    <span class="username">${user.username} ${adminBadge}</span>
                    <span class="activity">${iconHtml} ${user.currentActivity}</span>
                </div>
            </div>
            <div class="user-item-controls">
                <button class="favorite-btn ${isFavorite ? 'is-favorite' : ''}" data-userid="${user._id}" title="Favorisieren">${isFavorite ? '★' : '☆'}</button>
                <button class="chat-btn" data-userid="${user._id}" data-username="${user.username}" data-activitydesc="${user.activityDescription || ''}" title="Chat starten">💬</button>
            </div>`;
        userList.appendChild(listItem);
    });
}
function removeUser(disconnectedUserId) { if (userMarkers[disconnectedUserId]) { userMarkers[disconnectedUserId].remove(); delete userMarkers[disconnectedUserId]; } const userListItem = document.querySelector(`.user-list-item[data-userid="${disconnectedUserId}"]`); if (userListItem) userListItem.remove(); }






































