
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models import Student, Course

courses_bp = Blueprint("courses", __name__)


# Helper function: find a course belonging to the logged-in student
def get_student_course(course_id, student_id):
    return Course.query.filter_by(
        id=course_id,
        student_id=student_id
    ).first()


# CREATE A COURSE
@courses_bp.route("/", methods=["POST"])
@jwt_required()
def create_course():

    student_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    course_name = data.get("course_name", "").strip()
    course_code = data.get("course_code", "").strip()
    description = data.get("description", "").strip()

    if not course_name:
        return jsonify({"error": "Course name is required."}), 400

    student = db.session.get(Student, student_id)

    if not student:
        return jsonify({"error": "Student not found."}), 404

    new_course = Course(
        course_name=course_name,
        course_code=course_code or None,
        description=description or None,
        student_id=student_id
    )

    db.session.add(new_course)
    db.session.commit()

    return jsonify({
        "message": "Course created successfully!",
        "course": {
            "id": new_course.id,
            "course_name": new_course.course_name,
            "course_code": new_course.course_code,
            "description": new_course.description
        }
    }), 201


# GET ALL COURSES FOR THE LOGGED-IN STUDENT
@courses_bp.route("/", methods=["GET"])
@jwt_required()
def get_courses():

    student_id = int(get_jwt_identity())

    courses = Course.query.filter_by(
        student_id=student_id
    ).order_by(Course.id.desc()).all()

    course_list = []

    for course in courses:
        course_list.append({
            "id": course.id,
            "course_name": course.course_name,
            "course_code": course.course_code,
            "description": course.description
        })

    return jsonify({
        "courses": course_list
    }), 200


# GET ONE COURSE
@courses_bp.route("/<int:course_id>", methods=["GET"])
@jwt_required()
def get_course(course_id):

    student_id = int(get_jwt_identity())

    course = get_student_course(course_id, student_id)

    if not course:
        return jsonify({"error": "Course not found."}), 404

    return jsonify({
        "id": course.id,
        "course_name": course.course_name,
        "course_code": course.course_code,
        "description": course.description
    }), 200


# UPDATE A COURSE
@courses_bp.route("/<int:course_id>", methods=["PUT"])
@jwt_required()
def update_course(course_id):

    student_id = int(get_jwt_identity())

    course = get_student_course(course_id, student_id)

    if not course:
        return jsonify({"error": "Course not found."}), 404

    data = request.get_json(silent=True) or {}

    if "course_name" in data:
        course_name = data["course_name"]

        if not isinstance(course_name, str) or not course_name.strip():
            return jsonify({"error": "Course name cannot be empty."}), 400

        course.course_name = course_name.strip()

    if "course_code" in data:
        course_code = data["course_code"]

        if not isinstance(course_code, str):
            return jsonify({"error": "Course code must be text."}), 400

        course.course_code = course_code.strip() or None

    if "description" in data:
        description = data["description"]

        if not isinstance(description, str):
            return jsonify({"error": "Description must be text."}), 400

        course.description = description.strip() or None

    db.session.commit()

    return jsonify({
        "message": "Course updated successfully!"
    }), 200


# DELETE A COURSE
@courses_bp.route("/<int:course_id>", methods=["DELETE"])
@jwt_required()
def delete_course(course_id):

    student_id = int(get_jwt_identity())

    course = get_student_course(course_id, student_id)

    if not course:
        return jsonify({"error": "Course not found."}), 404

    db.session.delete(course)
    db.session.commit()

    return jsonify({
        "message": "Course deleted successfully!"
    }), 200
