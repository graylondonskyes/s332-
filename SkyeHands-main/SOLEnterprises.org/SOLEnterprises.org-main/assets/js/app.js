import { auth } from "/assets/js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

function setNavAuthed(isAuthed) {
  const login = document.getElementById("nav-login");
  const profile = document.getElementById("nav-profile");
  const logout = document.getElementById("nav-logout");

  if (login) login.style.display = isAuthed ? "none" : "inline-block";
  if (profile) profile.style.display = isAuthed ? "inline-block" : "none";
  if (logout) logout.style.display = isAuthed ? "inline-block" : "none";
}

async function logout() {
  await signOut(auth);
  window.location.href = "/index.html";
}

window.SOLE = { logout };

onAuthStateChanged(auth, (user) => {
  setNavAuthed(!!user);
});
