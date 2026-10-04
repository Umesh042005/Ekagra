"""
Create a mentor account from the terminal (backup option).

Normally mentors are created from the Admin Panel in the website; this script
does the same thing without needing the frontend.

Usage (from the ekagra-backend folder):
    python create_mentor.py --name "Priya Sharma" --email priya@example.com

You will be prompted for the password (typing is hidden — that's normal).
"""

from create_admin import prompt_and_create

if __name__ == "__main__":
    # Mentors are stored with role 'coach' internally
    prompt_and_create("coach", "Mentor")
