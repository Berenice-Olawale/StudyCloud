
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from extensions import db
from models import Student

auth_bp = Blueprint("auth", __name__)


# STUDENT REGISTRATION
@auth_bp.route("/register", methods=["POST"])
def register():

    data = request.get_json(silent=True) or {}

    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    # Validate input
    if not full_name or not email or not password:
        return jsonify({
            "error": "All fields are required."
        }), 400

    if len(password) < 8:
        return jsonify({
            "error": "Password must contain at least 8 characters."
        }), 400

    # Check if email already exists
    existing_student = Student.query.filter_by(email=email).first()

    if existing_student:
        return jsonify({
            "error": "An account with this email already exists."
        }), 409

    # Hash password
    hashed_password = generate_password_hash(password)

    # Create student
    new_student = Student(
        full_name=full_name,
        email=email,
        password_hash=hashed_password
    )

    db.session.add(new_student)
    db.session.commit()

    return jsonify({
        "message": "Registration successful!",
        "student": {
            "id": new_student.id,
            "full_name": new_student.full_name,
            "email": new_student.email
        }
    }), 201


# STUDENT LOGIN
@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({
            "error": "Email and password are required."
        }), 400

    student = Student.query.filter_by(email=email).first()

    if not student or not check_password_hash(
        student.password_hash, password
    ):
        return jsonify({
            "error": "Invalid email or password."
        }), 401

    # Generate authentication token
    access_token = create_access_token(
        identity=str(student.id)
    )

    return jsonify({
        "message": "Login successful!",
        "access_token": access_token,
        "student": {
            "id": student.id,
            "full_name": student.full_name,
            "email": student.email
        }
    }), 200


# GET LOGGED-IN STUDENT PROFILE
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_profile():

    student_id = int(get_jwt_identity())

    student = db.session.get(Student, student_id)

    if not student:
        return jsonify({
            "error": "Student not found."
        }), 404

    return jsonify({
        "id": student.id,
        "full_name": student.full_name,
        "email": student.email
    }), 200
