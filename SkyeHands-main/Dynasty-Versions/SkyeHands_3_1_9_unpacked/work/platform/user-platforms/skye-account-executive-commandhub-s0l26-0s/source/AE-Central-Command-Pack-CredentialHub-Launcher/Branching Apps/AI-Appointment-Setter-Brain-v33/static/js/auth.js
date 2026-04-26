window.addEventListener('DOMContentLoaded', async () => {
  await loadPublicConfig();

  const loginForm = document.getElementById('login-form');
  const loginStatus = document.getElementById('login-status');
  const changeWrap = document.getElementById('change-password-wrap');
  const changeForm = document.getElementById('change-password-form');
  const changeStatus = document.getElementById('change-password-status');
  const changeHint = document.getElementById('change-password-hint');
  const params = new URLSearchParams(window.location.search);
  const forceFromQuery = params.get('must_change') === '1';

  function showChangePassword(message = '') {
    changeWrap.hidden = false;
    loginForm.closest('.panel').querySelector('.eyebrow').textContent = 'Password hardening';
    loginForm.hidden = true;
    if (message) changeHint.textContent = message;
  }

  try {
    const me = await authMe();
    if (me?.user?.must_change_password) {
      showChangePassword('Set a real password before entering the admin surface.');
      return;
    }
    if (me?.user) {
      window.location.href = nextPathOrDefault('/admin/index.html');
      return;
    }
  } catch (error) {
    if (forceFromQuery) showChangePassword('This account must rotate the bootstrap password before use.');
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(loginForm).entries());
    loginStatus.textContent = 'Logging in…';
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, { redirectOn401: false });
      if (data.user?.must_change_password) {
        loginStatus.textContent = 'Bootstrap password accepted. Rotation required now.';
        showChangePassword('Enter the current password and set a stronger one.');
        document.querySelector('#change-password-form [name="current_password"]').value = payload.password || '';
        return;
      }
      loginStatus.textContent = `${data.user.display_name} authenticated.`;
      window.location.href = nextPathOrDefault('/admin/index.html');
    } catch (error) {
      loginStatus.textContent = error.message;
    }
  });

  changeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(changeForm).entries());
    changeStatus.textContent = 'Updating password…';
    try {
      const data = await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, { redirectOn401: false });
      changeStatus.textContent = `${data.user.display_name} password updated.`;
      window.location.href = nextPathOrDefault('/admin/index.html');
    } catch (error) {
      changeStatus.textContent = error.message;
    }
  });
});
