"""
Unit and Integration Tests for Ekagra Session System.

Validates:
1. Time conflict detection logic (overlap detection, back-to-back non-conflict)
2. Coach rotation logic (round-robin assignment over alternate days)
3. Schema-level privacy for student motivation sessions
4. Streak calculation algorithm
5. Pydantic request validation constraints
"""

import unittest
from datetime import datetime, date, time, timedelta, timezone
from pydantic import ValidationError

from schemas.session import (
    BookStudySessionRequest,
    BookMotivationSeriesRequest,
    RescheduleSessionRequest,
    StudentMotivationSessionResponse,
    StudentStudySessionResponse,
    StudentUpcomingResponse,
)
from services.session_service import calculate_streak
from services.scheduling_service import normalize_to_utc


class TestSchedulingIntervals(unittest.TestCase):
    """Test mathematical interval overlap detection."""

    def test_back_to_back_sessions_do_not_conflict(self):
        """
        Session 1: 10:00 - 10:45
        Session 2: 10:45 - 11:30 (Immediately after)
        Must NOT conflict.
        """
        s1_start = datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc)
        s1_end = s1_start + timedelta(minutes=45)

        s2_start = datetime(2026, 10, 1, 10, 45, tzinfo=timezone.utc)
        s2_end = s2_start + timedelta(minutes=45)

        # Interval overlap condition: cand_start < existing_end and existing_start < cand_end
        overlap_after = (s2_start < s1_end) and (s1_start < s2_end)
        self.assertFalse(overlap_after, "Back-to-back session immediately after must NOT conflict.")

        # Test session immediately before: 09:15 - 10:00
        s0_start = datetime(2026, 10, 1, 9, 15, tzinfo=timezone.utc)
        s0_end = s0_start + timedelta(minutes=45)
        overlap_before = (s0_start < s1_end) and (s1_start < s0_end)
        self.assertFalse(overlap_before, "Back-to-back session immediately before must NOT conflict.")

    def test_partial_overlap_conflicts(self):
        """
        Existing: 10:00 - 10:45
        Candidate: 10:30 - 11:15
        Must conflict.
        """
        s1_start = datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc)
        s1_end = s1_start + timedelta(minutes=45)

        cand_start = datetime(2026, 10, 1, 10, 30, tzinfo=timezone.utc)
        cand_end = cand_start + timedelta(minutes=45)

        overlap = (cand_start < s1_end) and (s1_start < cand_end)
        self.assertTrue(overlap, "Partial overlap must conflict.")

    def test_enclosing_overlap_conflicts(self):
        """
        Existing: 10:15 - 10:30
        Candidate: 10:00 - 11:00
        Must conflict.
        """
        s1_start = datetime(2026, 10, 1, 10, 15, tzinfo=timezone.utc)
        s1_end = s1_start + timedelta(minutes=15)

        cand_start = datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc)
        cand_end = cand_start + timedelta(minutes=60)

        overlap = (cand_start < s1_end) and (s1_start < cand_end)
        self.assertTrue(overlap, "Enclosing session must conflict.")


class TestCoachRotation(unittest.TestCase):
    """Test 3-coach rotation over 6 motivation sessions on alternate days."""

    def test_rotation_distribution_and_dates(self):
        coach_ids = ["Coach_A", "Coach_B", "Coach_C"]
        start_date = date(2026, 10, 1)  # Day 0
        series_time = time(19, 0)
        number_of_sessions = 6

        planned = []
        for i in range(number_of_sessions):
            session_date = start_date + timedelta(days=2 * i)
            session_dt = datetime.combine(session_date, series_time, tzinfo=timezone.utc)
            assigned_coach = coach_ids[i % len(coach_ids)]
            planned.append({
                "session_num": i + 1,
                "date": session_date,
                "dt": session_dt,
                "coach": assigned_coach,
            })

        # Verify alternate days: Oct 1, Oct 3, Oct 5, Oct 7, Oct 9, Oct 11
        expected_dates = [
            date(2026, 10, 1),
            date(2026, 10, 3),
            date(2026, 10, 5),
            date(2026, 10, 7),
            date(2026, 10, 9),
            date(2026, 10, 11),
        ]
        self.assertEqual([p["date"] for p in planned], expected_dates)

        # Verify coach round-robin assignment: A, B, C, A, B, C
        expected_coaches = ["Coach_A", "Coach_B", "Coach_C", "Coach_A", "Coach_B", "Coach_C"]
        self.assertEqual([p["coach"] for p in planned], expected_coaches)

        # Verify Coach A query filter simulation (coach_id == "Coach_A")
        coach_a_sessions = [p for p in planned if p["coach"] == "Coach_A"]
        self.assertEqual(len(coach_a_sessions), 2)
        self.assertEqual([p["session_num"] for p in coach_a_sessions], [1, 4])

        # Verify Coach B query filter simulation (coach_id == "Coach_B")
        coach_b_sessions = [p for p in planned if p["coach"] == "Coach_B"]
        self.assertEqual(len(coach_b_sessions), 2)
        self.assertEqual([p["session_num"] for p in coach_b_sessions], [2, 5])

        # Verify Coach C query filter simulation (coach_id == "Coach_C")
        coach_c_sessions = [p for p in planned if p["coach"] == "Coach_C"]
        self.assertEqual(len(coach_c_sessions), 2)
        self.assertEqual([p["session_num"] for p in coach_c_sessions], [3, 6])


class TestPrivacyEnforcement(unittest.TestCase):
    """Test schema-level privacy hiding coach identity for student motivation views."""

    def test_student_motivation_model_omits_coach_fields(self):
        now_dt = datetime.now(timezone.utc)
        motivation_item = StudentMotivationSessionResponse(
            id="sess-100",
            scheduled_at=now_dt,
            duration_minutes=45,
            zoom_link="https://zoom.us/j/123",
            status="upcoming",
            session_type="motivation",
            session_title="Evening Reflection Session",
        )

        serialized = motivation_item.model_dump()
        self.assertNotIn("coach_id", serialized)
        self.assertNotIn("coach_name", serialized)
        self.assertEqual(serialized["session_type"], "motivation")
        self.assertEqual(serialized["session_title"], "Evening Reflection Session")

    def test_student_study_model_includes_coach_fields(self):
        now_dt = datetime.now(timezone.utc)
        study_item = StudentStudySessionResponse(
            id="sess-200",
            scheduled_at=now_dt,
            duration_minutes=45,
            zoom_link="https://zoom.us/j/456",
            status="upcoming",
            session_type="study",
            session_title="1:1 Calculus Study",
            topic="Calculus",
            coach_id="coach-uuid-123",
            coach_name="Coach Jane",
        )

        serialized = study_item.model_dump()
        self.assertIn("coach_id", serialized)
        self.assertEqual(serialized["coach_id"], "coach-uuid-123")
        self.assertEqual(serialized["coach_name"], "Coach Jane")


class TestStreakCalculation(unittest.TestCase):
    """Test attendance streak calculation logic."""

    def test_consecutive_completed_streak(self):
        now = datetime.now(timezone.utc)
        sessions = [
            {"scheduled_at": (now - timedelta(days=6)).isoformat(), "status": "completed"},
            {"scheduled_at": (now - timedelta(days=4)).isoformat(), "status": "completed"},
            {"scheduled_at": (now - timedelta(days=2)).isoformat(), "status": "completed"},
        ]
        self.assertEqual(calculate_streak(sessions), 3)

    def test_cancelled_session_breaks_streak(self):
        now = datetime.now(timezone.utc)
        sessions = [
            {"scheduled_at": (now - timedelta(days=8)).isoformat(), "status": "completed"},
            {"scheduled_at": (now - timedelta(days=6)).isoformat(), "status": "completed"},
            {"scheduled_at": (now - timedelta(days=4)).isoformat(), "status": "cancelled"},
            {"scheduled_at": (now - timedelta(days=2)).isoformat(), "status": "completed"},
        ]
        # Most recent is completed (days=2) -> streak = 1; then cancelled (days=4) breaks it
        self.assertEqual(calculate_streak(sessions), 1)

    def test_most_recent_cancelled_yields_zero_streak(self):
        now = datetime.now(timezone.utc)
        sessions = [
            {"scheduled_at": (now - timedelta(days=4)).isoformat(), "status": "completed"},
            {"scheduled_at": (now - timedelta(days=2)).isoformat(), "status": "cancelled"},
        ]
        self.assertEqual(calculate_streak(sessions), 0)


class TestRequestValidation(unittest.TestCase):
    """Test Pydantic request body validation rules."""

    def test_reject_past_or_too_soon_booking(self):
        now = datetime.now(timezone.utc)
        # Attempt to book only 10 minutes in future (requires >= 30 min)
        invalid_dt = now + timedelta(minutes=10)
        with self.assertRaises(ValidationError):
            BookStudySessionRequest(
                student_id="student-1",
                scheduled_at=invalid_dt,
                duration_minutes=45,
            )

    def test_accept_valid_future_booking(self):
        now = datetime.now(timezone.utc)
        valid_dt = now + timedelta(hours=2)
        req = BookStudySessionRequest(
            student_id="student-1",
            scheduled_at=valid_dt,
            duration_minutes=45,
        )
        self.assertEqual(req.duration_minutes, 45)

    def test_reject_invalid_time_of_day(self):
        with self.assertRaises(ValidationError):
            BookMotivationSeriesRequest(
                student_id="student-1",
                start_date=date(2026, 10, 1),
                time_of_day="25:99",  # Invalid time
                number_of_sessions=5,
                coach_ids=["coach-1"],
            )

    def test_booked_time_slot_schema(self):
        from schemas.session import BookedTimeSlot
        slot = BookedTimeSlot(
            id="slot-123",
            scheduled_at=datetime(2026, 10, 15, 14, 0, tzinfo=timezone.utc),
            duration_minutes=45,
            status="upcoming",
            session_type="study",
            session_title="Calculus Review",
        )
        self.assertEqual(slot.id, "slot-123")
        self.assertEqual(slot.duration_minutes, 45)
        self.assertEqual(slot.session_type, "study")


class TestOngoingSeries(unittest.TestCase):
    """Test rolling-window generation for ongoing motivation series."""

    def setUp(self):
        from services.series_service import IST_TIMEZONE
        self.ist = IST_TIMEZONE
        # 15:30 IST on 1 Oct 2026
        self.now = datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc)
        self.series = {
            "id": "series-1", "student_id": "stu", "coach_ids": ["A", "B", "C"],
            "start_date": "2026-10-01", "time_of_day": "19:00", "interval_days": 2,
            "duration_minutes": 45, "max_sessions": None, "next_index": 0,
        }

    def test_time_of_day_is_ist(self):
        from services.series_service import occurrence
        _, start, _ = occurrence(self.series, 0)
        self.assertEqual(start, datetime(2026, 10, 1, 13, 30, tzinfo=timezone.utc))
        self.assertEqual(start.astimezone(self.ist).hour, 19)

    def test_window_covers_two_weeks_with_rotation(self):
        from services.series_service import plan_window
        planned, next_index = plan_window(self.series, self.now)
        self.assertEqual(len(planned), 7)
        self.assertEqual(next_index, 7)
        self.assertEqual([c for _, _, c in planned], ["A", "B", "C", "A", "B", "C", "A"])

    def test_fixed_length_series_stops(self):
        from services.series_service import plan_window
        planned, next_index = plan_window({**self.series, "max_sessions": 3}, self.now)
        self.assertEqual(len(planned), 3)
        self.assertEqual(next_index, 3)

    def test_top_up_adds_only_new_dates(self):
        from services.series_service import plan_window
        series = {**self.series, "next_index": 7}
        planned, _ = plan_window(series, self.now + timedelta(days=1))
        self.assertEqual([i for i, _, _ in planned], [7])

    def test_resume_skips_past_dates(self):
        from services.series_service import first_bookable_index, occurrence
        later = self.now + timedelta(days=9)  # 10 Oct, 15:30 IST
        index = first_bookable_index(self.series, later)
        self.assertEqual(index, 5)
        self.assertEqual(occurrence(self.series, index)[1].astimezone(self.ist).day, 11)

    def test_number_of_sessions_optional(self):
        req = BookMotivationSeriesRequest(
            student_id="stu", start_date=date(2026, 10, 2), time_of_day="19:00", coach_ids=["A"],
        )
        self.assertIsNone(req.number_of_sessions)


if __name__ == "__main__":
    unittest.main()


