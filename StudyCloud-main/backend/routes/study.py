from datetime import datetime, date, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models import Student, Course, StudySession


study_bp = Blueprint("study", __name__)


# GET WEEKLY STUDY PROGRESS
@study_bp.route("/summary", methods=["GET"])
@jwt_required()
def get_study_summary():

    student_id = int(get_jwt_identity())

    student = db.session.get(Student, student_id)

    if not student:
        return jsonify({"error": "Student not found."}), 404

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    sessions = StudySession.query.filter(
        StudySession.student_id == student_id,
        StudySession.study_date >= week_start,
        StudySession.study_date <= week_end
    ).all()

    daily_hours = [0.0] * 7

    for session in sessions:
        day_index = session.study_date.weekday()
        daily_hours[day_index] += session.hours

    total_hours = sum(daily_hours)
    goal = student.weekly_goal_hours

    percentage = (
        min(round((total_hours / goal) * 100), 100)
        if goal > 0 else 0
    )

    return jsonify({
        "total_hours": round(total_hours, 2),
        "weekly_goal": goal,
        "percentage": percentage,
        "daily_hours": daily_hours
    }), 200


# ADD A STUDY SESSION
@study_bp.route("/sessions", methods=["POST"])
@jwt_required()
def add_study_session():

    student_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    study_date_value = data.get("study_date")
    hours_value = data.get("hours")
    course_id = data.get("course_id")

    if not study_date_value or hours_value is None:
        return jsonify({
            "error": "Date and study hours are required."
        }), 400

    try:
        study_date = date.fromisoformat(study_date_value)
        hours = float(hours_value)
    except (ValueError, TypeError):
        return jsonify({
            "error": "Please enter a valid date and number of hours."
        }), 400

    if hours <= 0 or hours > 24:
        return jsonify({
            "error": "Study hours must be greater than 0 and no more than 24."
        }), 400

    if study_date > date.today():
        return jsonify({
            "error": "You cannot record a future study session."
        }), 400

    if course_id is not None:
        course = Course.query.filter_by(
            id=course_id,
            student_id=student_id
        ).first()

        if not course:
            return jsonify({
                "error": "Course not found."
            }), 404

    session = StudySession(
        student_id=student_id,
        course_id=course_id,
        study_date=study_date,
        hours=hours
    )

    db.session.add(session)
    db.session.commit()

    return jsonify({
        "message": "Study session saved successfully."
    }), 201


# UPDATE WEEKLY STUDY GOAL
@study_bp.route("/goal", methods=["PUT"])
@jwt_required()
def update_study_goal():

    student_id = int(get_jwt_identity())
    student = db.session.get(Student, student_id)

    if not student:
        return jsonify({"error": "Student not found."}), 404

    data = request.get_json(silent=True) or {}

    try:
        goal = float(data.get("weekly_goal"))
    except (ValueError, TypeError):
        return jsonify({
            "error": "Please enter a valid weekly goal."
        }), 400

    if goal <= 0 or goal > 168:
        return jsonify({
            "error": "Weekly goal must be between 0 and 168 hours."
        }), 400

    student.weekly_goal_hours = goal
    db.session.commit()

    return jsonify({
        "message": "Weekly goal updated successfully.",
        "weekly_goal": student.weekly_goal_hours
    }), 200