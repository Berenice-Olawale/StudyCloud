
from datetime import datetime, timedelta

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import Student, Course, Task, StudyMaterial


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/summary", methods=["GET"])
@jwt_required()
def get_dashboard_summary():

    # Identify the currently logged-in student
    student_id = int(get_jwt_identity())

    student = Student.query.get(student_id)

    if not student:
        return jsonify({"error": "Student not found."}), 404

    # Get the current time and the next seven days
    now = datetime.utcnow()
    next_seven_days = now + timedelta(days=7)

    # Count the student's courses
    total_courses = Course.query.filter_by(
        student_id=student_id
    ).count()

    # Get all tasks belonging to this student
    tasks = Task.query.filter_by(
        student_id=student_id
    ).all()

    total_tasks = len(tasks)

    completed_tasks = sum(
        1 for task in tasks if task.is_completed
    )

    pending_tasks = sum(
        1 for task in tasks if not task.is_completed
    )

    # Find incomplete tasks whose deadlines have passed
    overdue_tasks = [
        task for task in tasks
        if not task.is_completed and task.due_date < now
    ]

    # Find incomplete tasks due within the next seven days
    upcoming_tasks = [
        task for task in tasks
        if (
            not task.is_completed
            and now <= task.due_date <= next_seven_days
        )
    ]

    # Sort upcoming tasks by deadline
    upcoming_tasks.sort(key=lambda task: task.due_date)

    # Get the five most recently uploaded materials
    recent_materials = (
        StudyMaterial.query
        .filter_by(student_id=student_id)
        .order_by(StudyMaterial.uploaded_at.desc())
        .limit(5)
        .all()
    )

    return jsonify({
        "student": {
            "id": student.id,
            "full_name": student.full_name,
            "email": student.email
        },

        "summary": {
            "total_courses": total_courses,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "overdue_tasks": len(overdue_tasks),
            "upcoming_tasks": len(upcoming_tasks)
        },

        "upcoming_tasks": [
            {
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "due_date": task.due_date.isoformat(),
                "priority": task.priority,
                "course": task.course.course_name if task.course else None
            }
            for task in upcoming_tasks
        ],

        "recent_materials": [
            {
                "id": material.id,
                "title": material.title,
                "file_name": material.file_name,
                "uploaded_at": material.uploaded_at.isoformat()
            }
            for material in recent_materials
        ]
    }), 200
