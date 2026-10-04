"""
Create an admin account — run this ONCE to bootstrap the first admin.
After that, mentors are created from the Admin Panel in the website.

Usage (from the ekagra-backend folder):
    python create_admin.py --name "Umesh" --email you@example.com

You will be prompted for the password (typing is hidden — that's normal).
Requires migrations/003_admin_role.sql to have been run in Supabase.
"""

import argparse
import getpass
import sys

from services.user_service import UserServiceError, create_user_account


def prompt_and_create(role: str, label: str) -> None:
    parser = argparse.ArgumentParser(description=f"Create an Ekagra {label} account.")
    parser.add_argument("--name", required=True, help=f"{label}'s full name")
    parser.add_argument("--email", required=True, help=f"{label}'s login email")
    args = parser.parse_args()

    password = getpass.getpass(f"Password for the {label} (min 6 chars, typing is hidden): ")
    if getpass.getpass("Confirm password: ") != password:
        sys.exit("Passwords do not match.")

    try:
        profile = create_user_account(args.name, args.email, password, role)
    except UserServiceError as e:
        sys.exit(str(e))

    print(f"{label} created: {profile['name']} <{profile['email']}> (id {profile['id']})")


if __name__ == "__main__":
    prompt_and_create("admin", "Admin")
