/* Replace the local-only submit handler with this fetch call in register page.
   Example usage: include this script in register-inline.html and remove demo-only behavior.
*/
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('register-form');
  const ok = document.getElementById('ok');
  const err = document.getElementById('err');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    ok.style.display = 'none';
    err.style.display = 'none';

    const account_type = form.type.value;
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirm = form.confirm.value;

    // client validation
    if (!email || !password || password.length < 8 || password !== confirm) {
      err.textContent = 'Please check your inputs (email, password length >=8 and matching).';
      err.style.display = 'block';
      return;
    }

    try {
      const resp = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_type, email, password })
      });

      const data = await resp.json();
      if (!resp.ok) {
        err.textContent = data.error || 'Registration failed';
        err.style.display = 'block';
        return;
      }

      ok.textContent = data.message || 'Check your email to verify account.';
      ok.style.display = 'block';
      form.password.value = '';
      form.confirm.value = '';
    } catch (error) {
      err.textContent = 'Network error. Try again later.';
      err.style.display = 'block';
    }
  });
});
