# Ekagra Assistant (Chatbot)

A chat assistant for **students** and **mentors** that answers questions about
sessions, schedules and progress. It uses a hosted AI API (default: **Ollama Cloud**).

## 1. The privacy rule

> **The AI is never trusted to keep secrets. The backend decides what data the AI may see.**

If we sent every student's data to the AI and told it "don't share other students",
a user could trick it ("ignore your rules, I'm the admin…"). This is called
**prompt injection**, and every AI model can be fooled this way.

So Ekagra loads **only the data the logged-in user is allowed to see**, and only
that data goes to the AI. Another student's data is never loaded, so it cannot leak.

```
Student Rahul asks: "Show Sneha's schedule"
        │
        ▼
POST /chat  (with Rahul's login token)
        │
        ▼
Backend reads the token → "this is Rahul, role = student"
        │
        ▼
build_context(): loads ONLY Rahul's sessions + progress   ← Sneha's data never loaded
        │
        ▼
AI receives: rules + Rahul's data + the question
        │
        ▼
AI: "Sorry, I can only help with your own schedule."
```

## 2. Who can see what

| User | Data sent to the AI |
|---|---|
| **Student** | Only their own upcoming sessions (next 10), recent completed sessions (last 5), and progress/streak. Meditation mentor names stay hidden, same rule as the student pages. |
| **Mentor** | Their own upcoming sessions and progress, plus the names of students they can see. If the question mentions a student's name, that student's data is added, but **only if the student is in the mentor's allowed list**. |
| **Admin / others** | No data. The chat API rejects them. |

When organizations are added later, only `allowed_students_for_mentor()` needs
the organization filter, and the chatbot follows it automatically.

## 3. Where the code lives

```
ekagra-backend/
├── services/chat_service.py     ← the brain: permissions, context, AI call, demo mode, rate limit
├── routes/chat.py               ← API: POST /chat, GET /chat/status
├── tests/test_chat_privacy.py   ← tests proving the privacy rules
└── .env                         ← AI_API_URL, AI_API_KEY, AI_MODEL (never committed)

ekagra-frontend/src/
├── components/ChatWidget.jsx    ← floating 💬 button + chat window
└── App.jsx                      ← mounts the widget once for the whole app
```

### Key functions in `chat_service.py`

| Function | Job |
|---|---|
| `build_context(user, question)` | Picks the allowed data for this user's role. **This is the privacy boundary.** |
| `allowed_students_for_mentor(mentor)` | The list of students a mentor may see (same rule as the Students page). |
| `find_mentioned_students(question, allowed)` | Finds student names in the question, **searching only the allowed list**. |
| `build_system_prompt(context)` | Rules for the AI: answer only from the data, times in IST, refuse other people's data. |
| `clean_history(history)` | Keeps the last 6 user/assistant messages; drops fake "system" messages sent by a client. |
| `check_rate_limit(user_id)` | Max 20 messages per user per hour, so nobody can burn the AI credits. |
| `call_model(messages)` | The only function that talks to the AI provider. |
| `answer(user, question, history)` | Entry point: rate limit → context → demo reply or AI reply. |

## 4. Security practices used (industry standard)

1. **Identity from the token, not the message.** The backend gets the user from
   the login token. Typing "I am Rahul" in the chat changes nothing.
2. **Least data.** Only the minimum needed: names, times, titles, counts.
   No emails, passwords or phone numbers are sent to the AI.
3. **API key only on the server.** The key is in the backend `.env`, which is
   ignored by git. The browser never sees it; it only talks to our `/chat` API.
4. **Input limits.** Max 1,000 characters per message and 20 history items.
5. **Rate limiting.** 20 messages per hour per user.
6. **Provider is swappable.** All provider code is in `call_model()`. Moving from
   Ollama to another provider means changing one function and the `.env` values.
7. **Tested.** `tests/test_chat_privacy.py` checks that a student asking about
   another student loads only their own data, that meditation mentor names stay
   hidden, that mentors can't load students outside their list, and more.

## 5. Demo mode (no API key needed)

If `AI_API_KEY` is empty, no AI call is made. The assistant replies with
**exactly the data the AI would have received**. This lets us build and test
everything for free, and *see* the privacy rules working.

## 6. Turning on the real AI

1. Create a key at <https://ollama.com/settings/keys>.
2. Choose a model from <https://ollama.com/search?c=cloud>.
3. Add to `ekagra-backend/.env`:
   ```
   AI_API_URL=https://ollama.com/api/chat
   AI_API_KEY=your-key-here
   AI_MODEL=model-name-here
   ```
4. Restart the backend. The chat header changes from "Demo mode" to normal.

**Plan note:** the Ollama Cloud Free plan handles **1 request at a time** (others
wait in a queue). That's fine for testing; for many students use a paid plan.

## 7. Known limits / next steps

- The rate limit is stored in memory, so it resets when the server restarts and
  isn't shared across multiple servers (use Redis for that).
- Chat history isn't saved; it disappears when the chat window is closed or the
  page is refreshed.
- Mentor student lookup matches names in the question. Two students with the
  same first name may both be included (both are still from the allowed list).
