// Internally mentors have role 'coach'; the UI and URLs call them "mentor".

/** Home page for a logged-in user's role. */
export function homePathForRole(role) {
  if (role === 'admin') return '/admin';
  if (role === 'coach') return '/mentor/home';
  return '/student/home';
}
