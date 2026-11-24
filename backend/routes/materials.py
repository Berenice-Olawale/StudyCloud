import os
import uuid
import boto3

from flask import Blueprint, request, jsonify, current_app, send_from_directory, redirect
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from extensions import db
from models import StudyMaterial, Course

materials_bp = Blueprint("materials", __name__)

ALLOWED_EXTENSIONS = {
    "pdf", "doc", "docx", "ppt", "pptx",
    "xls", "xlsx", "txt", "png", "jpg", "jpeg"
}

def s3_client():
    return boto3.client("s3", region_name=current_app.config.get("AWS_REGION"))

def s3_enabled():
    return bool(current_app.config.get("S3_BUCKET"))

def get_student_material(material_id, student_id):
    return StudyMaterial.query.filter_by(id=material_id, student_id=student_id).first()

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

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
        if not Course.query.filter_by(id=course_id, student_id=student_id).first():
            return jsonify({"error": "Course not found."}), 404
    else:
        course_id = None

    ext = original_filename.rsplit(".", 1)[1].lower()
    stored_key = f"materials/{student_id}/{uuid.uuid4().hex}.{ext}"
    local_path = None
    try:
        if s3_enabled():
            file.stream.seek(0)
            s3_client().upload_fileobj(
                file.stream, current_app.config["S3_BUCKET"], stored_key,
                ExtraArgs={"ContentType": file.mimetype or "application/octet-stream"}
            )
        else:
            folder = current_app.config["UPLOAD_FOLDER"]
            os.makedirs(folder, exist_ok=True)
            local_path = os.path.join(folder, stored_key.replace("/", "_"))
            file.save(local_path)
            stored_key = os.path.basename(local_path)

        material = StudyMaterial(
            title=title or original_filename,
            description=description or None,
            file_name=original_filename,
            s3_key=stored_key,
            student_id=student_id,
            course_id=course_id
        )
        db.session.add(material)
        db.session.commit()
    except Exception:
        db.session.rollback()
        if s3_enabled():
            try: s3_client().delete_object(Bucket=current_app.config["S3_BUCKET"], Key=stored_key)
            except Exception: pass
        elif local_path and os.path.exists(local_path):
            os.remove(local_path)
        raise

    return jsonify({"message": "Study material uploaded successfully!", "material": {
        "id": material.id, "title": material.title, "file_name": material.file_name,
        "course_id": material.course_id
    }}), 201

@materials_bp.route("/", methods=["GET"])
@jwt_required()
def get_materials():
    student_id = int(get_jwt_identity())
    materials = StudyMaterial.query.filter_by(student_id=student_id).order_by(StudyMaterial.uploaded_at.desc()).all()
    return jsonify({"materials": [{
        "id": m.id, "title": m.title, "description": m.description, "file_name": m.file_name,
        "course_id": m.course_id, "uploaded_at": m.uploaded_at.isoformat()
    } for m in materials]}), 200

@materials_bp.route("/<int:material_id>/download", methods=["GET"])
@jwt_required()
def download_material(material_id):
    student_id = int(get_jwt_identity())
    material = get_student_material(material_id, student_id)
    if not material:
        return jsonify({"error": "Material not found."}), 404
    if not material.s3_key:
        return jsonify({"error": "File location is unavailable."}), 404

    if s3_enabled():
        url = s3_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": current_app.config["S3_BUCKET"], "Key": material.s3_key,
                   "ResponseContentDisposition": f'attachment; filename="{material.file_name}"'},
            ExpiresIn=300
        )
        return redirect(url)

    path = os.path.join(current_app.config["UPLOAD_FOLDER"], material.s3_key)
    if not os.path.isfile(path):
        return jsonify({"error": "File not found on storage."}), 404
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], material.s3_key,
                             as_attachment=True, download_name=material.file_name)

@materials_bp.route("/<int:material_id>", methods=["DELETE"])
@jwt_required()
def delete_material(material_id):
    student_id = int(get_jwt_identity())
    material = get_student_material(material_id, student_id)
    if not material:
        return jsonify({"error": "Material not found."}), 404
    key = material.s3_key
    db.session.delete(material)
    db.session.commit()
    if key:
        if s3_enabled():
            s3_client().delete_object(Bucket=current_app.config["S3_BUCKET"], Key=key)
        else:
            local_path = os.path.join(current_app.config["UPLOAD_FOLDER"], key)
            if os.path.isfile(local_path):
                os.remove(local_path)
    return jsonify({"message": "Study material deleted successfully!"}), 200
