
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models import Task, Course

tasks_bp = Blueprint("tasks", __name__)


# Helper: find a task belonging to the logged-in student
def get_student_task(task_id, student_id):
    return Task.query.filter_by(
        id=task_id,
        student_id=student_id
    ).first()


# CREATE A TASK
@tasks_bp.route("/", methods=["POST"])
@jwt_required()
def create_task():

    student_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    due_date = data.get("due_date")
    priority = data.get("priority", "medium").lower()
    course_id = data.get("course_id")

    if not title or not due_date:
        return jsonify({
            "error": "Task title and due date are required."
        }), 400

    if priority not in ["low", "medium", "high"]:
        return jsonify({
            "error": "Priority must be low, medium or high."
        }), 400

    try:
        parsed_date = datetime.fromisoformat(due_date)
    except (ValueError, TypeError):
        return jsonify({
            "error": "Invalid due date. Use YYYY-MM-DDTHH:MM:SS."
        }), 400

    # Check that the selected course belongs to this student
    if course_id is not None:
        course = Course.query.filter_by(
            id=course_id,
            student_id=student_id
        ).first()

        if not course:
            return jsonify({
                "error": "Course not found."
            }), 404

    new_task = Task(
        title=title,
        description=description or None,
        due_date=parsed_date,
        priority=priority,
        student_id=student_id,
        course_id=course_id
    )

    db.session.add(new_task)
    db.session.commit()

    return jsonify({
        "message": "Task created successfully!",
        "task": {
            "id": new_task.id,
            "title": new_task.title,
            "description": new_task.description,
            "due_date": new_task.due_date.isoformat(),
            "priority": new_task.priority,
            "is_completed": new_task.is_completed,
            "course_id": new_task.course_id
        }
    }), 201


# GET ALL TASKS
@tasks_bp.route("/", methods=["GET"])
@jwt_required()
def get_tasks():

    student_id = int(get_jwt_identity())

    tasks = Task.query.filter_by(
        student_id=student_id
    ).order_by(Task.due_date.asc()).all()

    task_list = []

    for task in tasks:
        task_list.append({
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "due_date": task.due_date.isoformat(),
            "priority": task.priority,
            "is_completed": task.is_completed,
            "course_id": task.course_id
        })

    return jsonify({
        "tasks": task_list
    }), 200


# GET ONE TASK
@tasks_bp.route("/<int:task_id>", methods=["GET"])
@jwt_required()
def get_task(task_id):

    student_id = int(get_jwt_identity())

    task = get_student_task(task_id, student_id)

    if not task:
        return jsonify({"error": "Task not found."}), 404

    return jsonify({
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "due_date": task.due_date.isoformat(),
        "priority": task.priority,
        "is_completed": task.is_completed,
        "course_id": task.course_id
    }), 200


# UPDATE A TASK
@tasks_bp.route("/<int:task_id>", methods=["PUT"])
@jwt_required()
def update_task(task_id):

    student_id = int(get_jwt_identity())

    task = get_student_task(task_id, student_id)

    if not task:
        return jsonify({"error": "Task not found."}), 404

    data = request.get_json(silent=True) or {}

    if "title" in data:
        if not isinstance(data["title"], str) or not data["title"].strip():
            return jsonify({"error": "Title cannot be empty."}), 400
        task.title = data["title"].strip()

    if "description" in data:
        if data["description"] is not None and not isinstance(data["description"], str):
            return jsonify({"error": "Description must be text."}), 400
        task.description = data["description"].strip() if data["description"] else None

    if "due_date" in data:
        try:
            task.due_date = datetime.fromisoformat(data["due_date"])
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid due date."}), 400

    if "priority" in data:
        priority = data["priority"].lower()
        if priority not in ["low", "medium", "high"]:
            return jsonify({"error": "Invalid priority."}), 400
        task.priority = priority

    if "is_completed" in data:
        if not isinstance(data["is_completed"], bool):
            return jsonify({"error": "is_completed must be true or false."}), 400
        task.is_completed = data["is_completed"]

    if "course_id" in data:
        course_id = data["course_id"]

        if course_id is not None:
            course = Course.query.filter_by(
                id=course_id,
                student_id=student_id
            ).first()

            if not course:
                return jsonify({"error": "Course not found."}), 404

        task.course_id = course_id

    db.session.commit()

    return jsonify({
        "message": "Task updated successfully!"
    }), 200


# DELETE A TASK
@tasks_bp.route("/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):

    student_id = int(get_jwt_identity())

    task = get_student_task(task_id, student_id)

    if not task:
        return jsonify({"error": "Task not found."}), 404

    db.session.delete(task)
    db.session.commit()

    return jsonify({
        "message": "Task deleted successfully!"
    }), 200


# GET TASKS BY COMPLETION STATUS
@tasks_bp.route("/status/<string:status>", methods=["GET"])
@jwt_required()
def filter_tasks(status):

    student_id = int(get_jwt_identity())

    if status not in ["completed", "pending"]:
        return jsonify({
            "error": "Status must be completed or pending."
        }), 400

    completed = status == "completed"

    tasks = Task.query.filter_by(
        student_id=student_id,
        is_completed=completed
    ).order_by(Task.due_date.asc()).all()

    return jsonify({
        "tasks": [
            {
                "id": task.id,
                "title": task.title,
                "due_date": task.due_date.isoformat(),
                "priority": task.priority,
                "is_completed": task.is_completed,
                "course_id": task.course_id
            }
            for task in tasks
        ]
    }), 200
