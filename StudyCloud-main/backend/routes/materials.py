
import os
import uuid

from flask import (
    Blueprint, request, jsonify, current_app, send_from_directory
)
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from extensions import db
from models import StudyMaterial, Course

materials_bp = Blueprint("materials", __name__)

ALLOWED_EXTENSIONS = {
    "pdf", "doc", "docx", "ppt", "pptx",
    "xls", "xlsx", "txt", "png", "jpg", "jpeg"
}


def get_student_material(material_id, student_id):
    return StudyMaterial.query.filter_by(
        id=material_id,
        student_id=student_id
    ).first()


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


# UPLOAD A STUDY MATERIAL
@materials_bp.route("/", methods=["POST"])
@jwt_required()
def upload_material():

    student_id = int(get_jwt_identity())

    if "file" not in request.files:
        return jsonify({"error": "No file was provided."}), 400

    file = request.files["file"]

    if not file.filename:
        return jsonify({"error": "Please select a file."}), 400

    original_filename = secure_filename(file.filename)

    if not original_filename or not allowed_file(original_filename):
        return jsonify({"error": "File type is not supported."}), 400

    title = request.form.get("title", "").strip()
    description = request.form.get("description", "").strip()
    course_id = request.form.get("course_id")

    if course_id:
        try:
            course_id = int(course_id)
        except ValueError:
            return jsonify({"error": "Invalid course ID."}), 400

        course = Course.query.filter_by(
            id=course_id,
            student_id=student_id
        ).first()

        if not course:
            return jsonify({"error": "Course not found."}), 404
    else:
        course_id = None

    # Generate a unique stored filename
    extension = original_filename.rsplit(".", 1)[1].lower()
    stored_filename = f"{uuid.uuid4().hex}.{extension}"

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)

    file.save(os.path.join(upload_folder, stored_filename))

    new_material = StudyMaterial(
        title=title or original_filename,
        description=description or None,
        file_name=original_filename,
        s3_key=stored_filename,
        student_id=student_id,
        course_id=course_id
    )

    try:
        db.session.add(new_material)
        db.session.commit()
    except Exception:
        db.session.rollback()
        os.remove(os.path.join(upload_folder, stored_filename))
        raise

    return jsonify({
        "message": "Study material uploaded successfully!",
        "material": {
            "id": new_material.id,
            "title": new_material.title,
            "file_name": new_material.file_name,
            "course_id": new_material.course_id
        }
    }), 201


# GET ALL STUDY MATERIALS
@materials_bp.route("/", methods=["GET"])
@jwt_required()
def get_materials():

    student_id = int(get_jwt_identity())

    materials = StudyMaterial.query.filter_by(
        student_id=student_id
    ).order_by(StudyMaterial.uploaded_at.desc()).all()

    return jsonify({
        "materials": [
            {
                "id": material.id,
                "title": material.title,
                "description": material.description,
                "file_name": material.file_name,
                "course_id": material.course_id,
                "uploaded_at": material.uploaded_at.isoformat()
            }
            for material in materials
        ]
    }), 200


# DOWNLOAD A STUDY MATERIAL
@materials_bp.route("/<int:material_id>/download", methods=["GET"])
@jwt_required()
def download_material(material_id):

    student_id = int(get_jwt_identity())

    material = get_student_material(material_id, student_id)

    if not material:
        return jsonify({"error": "Material not found."}), 404

    upload_folder = current_app.config["UPLOAD_FOLDER"]

    if not material.s3_key:
        return jsonify({"error": "File location is unavailable."}), 404

    if not os.path.isfile(os.path.join(upload_folder, material.s3_key)):
        return jsonify({"error": "File not found on storage."}), 404

    return send_from_directory(
        upload_folder,
        material.s3_key,
        as_attachment=True,
        download_name=material.file_name
    )


# DELETE A STUDY MATERIAL
@materials_bp.route("/<int:material_id>", methods=["DELETE"])
@jwt_required()
def delete_material(material_id):

    student_id = int(get_jwt_identity())

    material = get_student_material(material_id, student_id)

    if not material:
        return jsonify({"error": "Material not found."}), 404

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    stored_path = (
        os.path.join(upload_folder, material.s3_key)
        if material.s3_key else None
    )

    db.session.delete(material)
    db.session.commit()

    if stored_path and os.path.isfile(stored_path):
        os.remove(stored_path)

    return jsonify({
        "message": "Study material deleted successfully!"
    }), 200
