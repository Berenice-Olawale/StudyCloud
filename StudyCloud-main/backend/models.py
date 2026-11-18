
from datetime import datetime

from extensions import db


class Student(db.Model):
    __tablename__ = "students"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    courses = db.relationship(
        "Course",
        back_populates="student",
        cascade="all, delete-orphan"
    )

    tasks = db.relationship(
        "Task",
        back_populates="student",
        cascade="all, delete-orphan"
    )

    materials = db.relationship(
        "StudyMaterial",
        back_populates="student",
        cascade="all, delete-orphan"
    )


class Course(db.Model):
    __tablename__ = "courses"

    id = db.Column(db.Integer, primary_key=True)
    course_name = db.Column(db.String(100), nullable=False)
    course_code = db.Column(db.String(30))
    description = db.Column(db.Text)

    student_id = db.Column(
        db.Integer,
        db.ForeignKey("students.id"),
        nullable=False
    )

    student = db.relationship("Student", back_populates="courses")

    tasks = db.relationship(
        "Task",
        back_populates="course",
        cascade="all, delete-orphan"
    )

    materials = db.relationship(
        "StudyMaterial",
        back_populates="course",
        cascade="all, delete-orphan"
    )


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text)
    due_date = db.Column(db.DateTime, nullable=False)
    priority = db.Column(db.String(20), default="medium")
    is_completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    student_id = db.Column(
        db.Integer,
        db.ForeignKey("students.id"),
        nullable=False
    )

    course_id = db.Column(
        db.Integer,
        db.ForeignKey("courses.id"),
        nullable=True
    )

    student = db.relationship("Student", back_populates="tasks")
    course = db.relationship("Course", back_populates="tasks")


class StudyMaterial(db.Model):
    __tablename__ = "study_materials"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text)
    file_name = db.Column(db.String(255), nullable=False)
    s3_key = db.Column(db.String(500))
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    student_id = db.Column(
        db.Integer,
        db.ForeignKey("students.id"),
        nullable=False
    )

    course_id = db.Column(
        db.Integer,
        db.ForeignKey("courses.id"),
        nullable=True
    )

    student = db.relationship("Student", back_populates="materials")
    course = db.relationship("Course", back_populates="materials")
